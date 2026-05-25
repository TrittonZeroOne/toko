package service

import (
	"bytes"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type MidtransItem struct {
	ID       string
	Price    int64
	Quantity int
	Name     string
}

type MidtransCustomer struct {
	Name  string
	Email string
	Phone string
}

type MidtransPaymentRequest struct {
	OrderID       string
	Amount        int64
	Items         []MidtransItem
	Customer      MidtransCustomer
	PaymentMethod string
	NotifyURL     string
	ReturnURL     string
	CancelURL     string
}

type MidtransPaymentResponse struct {
	Token       string
	RedirectURL string
	Raw         map[string]any
}

type MidtransWebhookPayload struct {
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	PaymentType       string `json:"payment_type"`
	TransactionID     string `json:"transaction_id"`
}

func MidtransServerKey() string {
	return strings.TrimSpace(os.Getenv("MIDTRANS_SERVER_KEY"))
}

func MidtransClientKey() string {
	return strings.TrimSpace(os.Getenv("MIDTRANS_CLIENT_KEY"))
}

func MidtransIsProduction() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("MIDTRANS_IS_PRODUCTION")))
	return v == "true" || v == "1" || v == "yes"
}

func UsesMidtrans(paymentMethod string) bool {
	pm := strings.TrimSpace(strings.ToLower(paymentMethod))
	return pm == "" || pm == "midtrans" || strings.HasPrefix(pm, "midtrans_")
}

func MidtransEnabledPayment(paymentMethod string) string {
	switch strings.TrimSpace(strings.ToLower(paymentMethod)) {
	case "", "midtrans", "midtrans_va_bca":
		return "bca_va"
	case "midtrans_va_bni":
		return "bni_va"
	case "midtrans_va_bri":
		return "bri_va"
	case "midtrans_va_mandiri":
		return "echannel"
	case "midtrans_va_permata":
		return "permata_va"
	case "midtrans_qris":
		// Snap menampilkan QRIS melalui channel GoPay/e-wallet kompatibel,
		// terutama saat pelanggan membuka halaman pembayaran dari desktop.
		return "gopay"
	case "midtrans_gopay":
		return "gopay"
	case "midtrans_shopeepay":
		return "shopeepay"
	case "midtrans_credit_card":
		return "credit_card"
	case "midtrans_cstore":
		return "cstore"
	default:
		return ""
	}
}

func CreateMidtransPayment(req MidtransPaymentRequest) (MidtransPaymentResponse, error) {
	if MidtransServerKey() == "" {
		return MidtransPaymentResponse{}, fmt.Errorf("server key pembayaran kosong")
	}
	payload := midtransSnapBody(req)
	raw, err := midtransPost(midtransSnapEndpointURL(), payload)
	if err != nil {
		return MidtransPaymentResponse{}, err
	}
	out := MidtransPaymentResponse{Raw: raw}
	out.Token = findString(raw, "token")
	out.RedirectURL = findString(raw, "redirect_url", "redirectUrl")
	if out.RedirectURL == "" {
		return out, fmt.Errorf("gateway pembayaran tanpa redirect_url: %s", compactJSON(raw))
	}
	return out, nil
}

func MidtransPaymentInstructions(resp MidtransPaymentResponse) string {
	if resp.RedirectURL != "" {
		return ""
	}
	return "Transaksi pembayaran berhasil dibuat. Buka halaman pembayaran dari respons gateway pembayaran."
}

func midtransSnapEndpointURL() string {
	if MidtransIsProduction() {
		return "https://app.midtrans.com/snap/v1/transactions"
	}
	return "https://app.sandbox.midtrans.com/snap/v1/transactions"
}

func midtransStatusEndpointURL(orderID string) string {
	host := "https://api.sandbox.midtrans.com"
	if MidtransIsProduction() {
		host = "https://api.midtrans.com"
	}
	return host + "/v2/" + url.PathEscape(strings.TrimSpace(orderID)) + "/status"
}

func GetMidtransTransactionStatus(orderID string) (MidtransWebhookPayload, map[string]any, error) {
	if MidtransServerKey() == "" {
		return MidtransWebhookPayload{}, nil, fmt.Errorf("server key pembayaran kosong")
	}
	httpReq, err := http.NewRequest(http.MethodGet, midtransStatusEndpointURL(orderID), nil)
	if err != nil {
		return MidtransWebhookPayload{}, nil, err
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(MidtransServerKey()+":")))

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return MidtransWebhookPayload{}, nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return MidtransWebhookPayload{}, nil, fmt.Errorf("gateway pembayaran status %d: %s", resp.StatusCode, string(raw))
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return MidtransWebhookPayload{}, nil, err
	}
	p := MidtransWebhookPayload{
		OrderID:           findString(out, "order_id"),
		StatusCode:        findString(out, "status_code"),
		GrossAmount:       findString(out, "gross_amount"),
		TransactionStatus: findString(out, "transaction_status"),
		FraudStatus:       findString(out, "fraud_status"),
		PaymentType:       findString(out, "payment_type"),
		TransactionID:     findString(out, "transaction_id"),
	}
	return p, out, nil
}

func midtransSnapBody(req MidtransPaymentRequest) map[string]any {
	items := make([]map[string]any, 0, len(req.Items))
	for _, it := range req.Items {
		items = append(items, map[string]any{
			"id":       it.ID,
			"price":    it.Price,
			"quantity": it.Quantity,
			"name":     it.Name,
		})
	}
	body := map[string]any{
		"transaction_details": map[string]any{
			"order_id":     req.OrderID,
			"gross_amount": req.Amount,
		},
		"item_details": items,
		"customer_details": map[string]any{
			"first_name": req.Customer.Name,
			"email":      req.Customer.Email,
			"phone":      req.Customer.Phone,
		},
	}
	if enabled := MidtransEnabledPayment(req.PaymentMethod); enabled != "" {
		body["enabled_payments"] = []string{enabled}
	}
	callbacks := map[string]any{}
	if req.ReturnURL != "" {
		callbacks["finish"] = req.ReturnURL
	}
	if req.CancelURL != "" {
		callbacks["unfinish"] = req.CancelURL
		callbacks["error"] = req.CancelURL
	}
	if len(callbacks) > 0 {
		body["callbacks"] = callbacks
	}
	if req.NotifyURL != "" {
		body["notification_url"] = req.NotifyURL
	}
	return body
}

func midtransPost(fullURL string, body map[string]any) (map[string]any, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequest(http.MethodPost, fullURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(MidtransServerKey()+":")))

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		if resp.StatusCode == http.StatusUnauthorized {
			mode := "sandbox"
			if MidtransIsProduction() {
				mode = "production"
			}
			return nil, fmt.Errorf("gateway pembayaran 401 unauthorized (%s): server key ditolak. Pastikan mode dashboard sesuai dan salin ulang Server Key, bukan Client Key. Detail: %s", mode, string(raw))
		}
		return nil, fmt.Errorf("gateway pembayaran %d: %s", resp.StatusCode, string(raw))
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func VerifyMidtransSignature(p MidtransWebhookPayload) bool {
	if p.SignatureKey == "" || MidtransServerKey() == "" {
		return false
	}
	sum := sha512.Sum512([]byte(p.OrderID + p.StatusCode + p.GrossAmount + MidtransServerKey()))
	expected := hex.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(strings.ToLower(p.SignatureKey)), []byte(expected)) == 1
}

func MapMidtransOrderStatus(transactionStatus, fraudStatus string) string {
	status := strings.ToLower(strings.TrimSpace(transactionStatus))
	fraud := strings.ToLower(strings.TrimSpace(fraudStatus))
	switch status {
	case "capture":
		if fraud == "" || fraud == "accept" {
			return "dikemas"
		}
		return "belum_dibayar"
	case "settlement":
		return "dikemas"
	case "pending":
		return "belum_dibayar"
	case "deny", "cancel", "expire", "failure", "refund", "partial_refund", "chargeback", "partial_chargeback":
		return "dibatalkan"
	default:
		return "belum_dibayar"
	}
}

func ParseMidtransAmount(values ...string) (int64, error) {
	for _, s := range values {
		s = strings.TrimSpace(strings.ReplaceAll(s, ",", ""))
		if s == "" {
			continue
		}
		if i, err := strconv.ParseInt(s, 10, 64); err == nil {
			return i, nil
		}
		if f, err := strconv.ParseFloat(s, 64); err == nil {
			return int64(f + 0.5), nil
		}
	}
	return 0, fmt.Errorf("kosong")
}

func findString(v any, keys ...string) string {
	keyset := map[string]bool{}
	for _, k := range keys {
		keyset[strings.ToLower(k)] = true
	}
	switch x := v.(type) {
	case map[string]any:
		for k, val := range x {
			if keyset[strings.ToLower(k)] {
				if s := strings.TrimSpace(fmt.Sprint(val)); s != "" && s != "<nil>" {
					return s
				}
			}
			if s := findString(val, keys...); s != "" {
				return s
			}
		}
	case []any:
		for _, val := range x {
			if s := findString(val, keys...); s != "" {
				return s
			}
		}
	}
	return ""
}

func compactJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

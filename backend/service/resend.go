package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"strconv"
	"strings"
)

func appName() string {
	if v := strings.TrimSpace(os.Getenv("APP_NAME")); v != "" {
		return v
	}
	return "Toko"
}

func frontendURL() string {
	if v := strings.TrimSpace(os.Getenv("FRONTEND_PUBLIC_URL")); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://localhost:5173"
}

func SendEmail(to, subject, body string) error {
	if key := strings.TrimSpace(os.Getenv("RESEND_API_KEY")); key != "" {
		return sendResendEmail(key, to, subject, body)
	}
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if from == "" {
		from = strings.TrimSpace(os.Getenv("SMTP_USER"))
	}
	if host == "" || from == "" {
		log.Printf("email disabled: to=%s subject=%q body=%q", to, subject, body)
		return nil
	}
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := os.Getenv("SMTP_PASSWORD")
	addr := host + ":" + port
	msg := strings.Join([]string{
		"From: " + from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")
	var auth smtp.Auth
	if user != "" || pass != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}
	return smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
}

func sendResendEmail(apiKey, to, subject, body string) error {
	from := strings.TrimSpace(os.Getenv("RESEND_FROM"))
	if from == "" {
		from = strings.TrimSpace(os.Getenv("SMTP_FROM"))
	}
	if from == "" {
		from = fmt.Sprintf("%s <onboarding@resend.dev>", appName())
	}
	payload := map[string]any{
		"from":    from,
		"to":      []string{to},
		"subject": subject,
		"text":    body,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := (&http.Client{}).Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	resBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("resend HTTP %d: %s", res.StatusCode, string(resBody))
	}
	return nil
}

func SendVerificationEmail(to, token string) error {
	link := fmt.Sprintf("%s/verify-email?token=%s", frontendURL(), token)
	body := fmt.Sprintf("Halo,\n\nKlik link berikut untuk verifikasi email akun %s:\n%s\n\nJika Anda tidak merasa mendaftar, abaikan email ini.", appName(), link)
	return SendEmail(to, "Verifikasi email "+appName(), body)
}

func SendPasswordResetOTP(to, otp string, minutes int) error {
	body := fmt.Sprintf("Kode OTP reset password %s Anda: %s\n\nKode berlaku %s menit. Abaikan jika Anda tidak meminta reset password.", appName(), otp, strconv.Itoa(minutes))
	return SendEmail(to, "OTP reset password "+appName(), body)
}

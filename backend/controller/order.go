package controller

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"toko/backend/model"
	"toko/backend/service"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type OrderController struct {
	DB *gorm.DB
}

type checkoutItem struct {
	ProductID uint `json:"product_id"`
	VariantID uint `json:"variant_id"`
	Qty       int  `json:"qty"`
}

type checkoutBody struct {
	Items              []checkoutItem `json:"items"`
	PaymentMethod      string         `json:"payment_method"`
	ShippingPhone      string         `json:"shipping_phone"`
	ShippingAddress    string         `json:"shipping_address"`
	ShippingCityID     string         `json:"shipping_city_id"`
	ShippingProvince   string         `json:"shipping_province"`
	ShippingCity       string         `json:"shipping_city"`
	ShippingPostalCode string         `json:"shipping_postal_code"`
	Courier            string         `json:"courier"`
	ShippingService    string         `json:"shipping_service"`
	// Slug kota tujuan untuk Binderbyte (dari nama kab/kota, huruf kecil tanpa spasi)
	DestinationSlug string `json:"destination_slug"`
}

func midtransItemsWithShipping(items []service.MidtransItem, ord model.Order) []service.MidtransItem {
	if ord.ShippingCost <= 0 {
		return items
	}
	name := "Ongkos kirim"
	if ord.Courier != "" && ord.ShippingService != "" {
		name = fmt.Sprintf("Ongkir %s %s", strings.ToUpper(ord.Courier), ord.ShippingService)
	}
	return append(items, service.MidtransItem{
		ID: "ONGKIR", Price: ord.ShippingCost, Quantity: 1, Name: name,
	})
}

func normalizePaymentMethod(s string) string {
	m := strings.ToLower(strings.TrimSpace(s))
	switch m {
	case "midtrans_va_bca", "midtrans_va_bni", "midtrans_va_bri", "midtrans_va_mandiri", "midtrans_va_permata", "midtrans_qris", "midtrans_gopay", "midtrans_shopeepay", "midtrans_credit_card", "midtrans_cstore", "cod", "bank_transfer":
		return m
	default:
		return "midtrans_va_bca"
	}
}

func orderRefID(uid uint, paymentMethod string) string {
	prefix := "TOKO"
	switch paymentMethod {
	case "cod":
		prefix = "COD"
	case "bank_transfer":
		prefix = "TF"
	}
	return fmt.Sprintf("%s-%d-%d", prefix, uid, time.Now().UnixNano())
}

func paymentInstructions(pm string) string {
	switch pm {
	case "cod":
		return "Pesanan diproses. Silakan siapkan pembayaran tunai saat barang diterima (COD). Status dapat diubah oleh admin setelah pengiriman."
	case "bank_transfer":
		if n := strings.TrimSpace(os.Getenv("BANK_TRANSFER_NOTE")); n != "" {
			return n
		}
		return "Transfer sesuai total ke rekening toko (atur di .env BANK_TRANSFER_NOTE). Cantumkan nomor order di berita transfer. Admin akan memverifikasi pembayaran manual."
	default:
		return ""
	}
}

func initialOrderStatus(paymentMethod string) string {
	if service.UsesMidtrans(paymentMethod) || paymentMethod == "bank_transfer" {
		return "belum_dibayar"
	}
	return "pending"
}

func canPayOrderStatus(status string) bool {
	return status == "belum_dibayar" || status == "pending"
}

func canCustomerCancelOrderStatus(status string) bool {
	return status == "belum_dibayar"
}

func normalizeMidtransURL(raw string) string {
	u := strings.TrimSpace(raw)
	if u == "" {
		return ""
	}
	return strings.TrimRight(u, "/")
}

func normalizeMidtransNotifyURL(raw string) string {
	u := normalizeMidtransURL(raw)
	if u == "" {
		return ""
	}
	parsed, err := url.Parse(u)
	if err != nil {
		return u
	}
	path := strings.TrimSpace(parsed.Path)
	if path == "" || path == "/" {
		parsed.Path = "/api/midtrans-webhook"
		return parsed.String()
	}
	return u
}

func frontendPublicURL() string {
	if base := normalizeMidtransURL(os.Getenv("FRONTEND_PUBLIC_URL")); base != "" {
		return base
	}
	return "http://localhost:5173"
}

func midtransReturnURL() string {
	if u := normalizeMidtransURL(os.Getenv("MIDTRANS_RETURN_URL")); u != "" {
		return u
	}
	return fmt.Sprintf("%s/orders", frontendPublicURL())
}

func midtransCancelURL() string {
	if u := normalizeMidtransURL(os.Getenv("MIDTRANS_CANCEL_URL")); u != "" {
		return u
	}
	return fmt.Sprintf("%s/orders", frontendPublicURL())
}

func midtransCustomer(u model.User) service.MidtransCustomer {
	fn := strings.TrimSpace(u.FirstName)
	ln := strings.TrimSpace(u.LastName)
	name := strings.TrimSpace(fn + " " + ln)
	if name == "" {
		parts := strings.Split(u.Email, "@")
		name = parts[0]
		if name == "" {
			name = "Customer"
		}
	}
	return service.MidtransCustomer{Name: name, Email: u.Email, Phone: strings.TrimSpace(u.Phone)}
}

func (o *OrderController) adminOriginSlug() (string, error) {
	var admin model.User
	if err := o.DB.Where("role = ?", "admin").Order("id asc").First(&admin).Error; err != nil {
		if origin := service.BinderbyteOriginSlug(); origin != "" {
			return origin, nil
		}
		return "", fiber.NewError(fiber.StatusServiceUnavailable, "alamat admin belum tersedia untuk origin ongkir, atau isi BINDERBYTE_ORIGIN")
	}
	origin := service.ShippingOriginSlug(admin.SubdistrictName, admin.DistrictName, admin.CityName)
	if origin == "" {
		if envOrigin := service.BinderbyteOriginSlug(); envOrigin != "" {
			return envOrigin, nil
		}
		return "", fiber.NewError(fiber.StatusServiceUnavailable, "lengkapi alamat admin: kab/kota dan kecamatan/kelurahan, atau isi BINDERBYTE_ORIGIN")
	}
	return origin, nil
}

func (o *OrderController) orderSender(userID ...uint) *model.User {
	var admin model.User
	if len(userID) > 0 && userID[0] > 0 {
		if err := o.DB.Where("id = ? AND role = ?", userID[0], "admin").First(&admin).Error; err == nil {
			return &admin
		}
	}
	if err := o.DB.Where("role = ?", "admin").Order("id asc").First(&admin).Error; err != nil {
		return nil
	}
	return &admin
}

func senderJSON(sender *model.User) fiber.Map {
	if sender == nil {
		return nil
	}
	return fiber.Map{
		"id":               sender.ID,
		"first_name":       sender.FirstName,
		"last_name":        sender.LastName,
		"role":             sender.Role,
		"phone":            sender.Phone,
		"address":          sender.Address,
		"province_id":      sender.ProvinceID,
		"city_id":          sender.CityID,
		"district_id":      sender.DistrictID,
		"district_name":    sender.DistrictName,
		"subdistrict_id":   sender.SubdistrictID,
		"subdistrict_name": sender.SubdistrictName,
		"province_name":    sender.ProvinceName,
		"city_name":        sender.CityName,
		"postal_code":      sender.PostalCode,
	}
}

func orderResponse(ord model.Order, sender *model.User) fiber.Map {
	return fiber.Map{
		"id":                   ord.ID,
		"user_id":              ord.UserID,
		"user":                 ord.User,
		"sender":               senderJSON(sender),
		"midtrans_order_id":    ord.MidtransOrderID,
		"subtotal":             ord.Subtotal,
		"shipping_cost":        ord.ShippingCost,
		"total":                ord.Total,
		"status":               ord.Status,
		"gross_amount":         ord.GrossAmount,
		"payment_method":       ord.PaymentMethod,
		"ship_to_name":         ord.ShipToName,
		"shipping_phone":       ord.ShippingPhone,
		"shipping_address":     ord.ShippingAddress,
		"shipping_province":    ord.ShippingProvince,
		"shipping_city":        ord.ShippingCity,
		"shipping_postal_code": ord.ShippingPostalCode,
		"shipping_city_id":     ord.ShippingCityID,
		"courier":              ord.Courier,
		"shipping_service":     ord.ShippingService,
		"tracking_number":      ord.TrackingNumber,
		"items":                ord.Items,
		"reviews":              ord.Reviews,
		"created_at":           ord.CreatedAt,
		"updated_at":           ord.UpdatedAt,
	}
}

// Checkout membuat order; Midtrans opsional sesuai metode pembayaran.
func (o *OrderController) Checkout(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	var body checkoutBody
	if err := c.BodyParser(&body); err != nil || len(body.Items) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "keranjang kosong atau tidak valid")
	}
	pm := normalizePaymentMethod(body.PaymentMethod)

	var subtotal int64
	var weightGram int
	var midtransItems []service.MidtransItem
	var lines []model.OrderItem

	err := o.DB.Transaction(func(tx *gorm.DB) error {
		for _, it := range body.Items {
			if it.Qty < 1 {
				return fmt.Errorf("qty minimal 1")
			}
			var p model.Product
			if err := tx.Preload("Variants").First(&p, it.ProductID).Error; err != nil {
				return fmt.Errorf("produk %d tidak ditemukan", it.ProductID)
			}
			lineName := p.Name
			linePrice := p.Price
			lineWeight := p.WeightGram
			var variantID *uint
			var variantName string
			if len(p.Variants) > 0 {
				if it.VariantID == 0 {
					return fmt.Errorf("pilih varian untuk %s", p.Name)
				}
				var v model.ProductVariant
				if err := tx.Where("id = ? AND product_id = ?", it.VariantID, p.ID).First(&v).Error; err != nil {
					return fmt.Errorf("varian %s tidak ditemukan", p.Name)
				}
				if v.Stock < it.Qty {
					return fmt.Errorf("stok %s - %s tidak cukup", p.Name, v.Name)
				}
				vid := v.ID
				variantID = &vid
				variantName = v.Name
				lineName = p.Name + " - " + v.Name
				linePrice = v.Price
				if linePrice < 1 {
					linePrice = p.Price + v.PriceDelta
				}
				if linePrice < 0 {
					linePrice = 0
				}
				lineWeight = v.WeightGram
				if err := tx.Model(&v).Update("stock", v.Stock-it.Qty).Error; err != nil {
					return err
				}
			} else {
				if p.Stock < it.Qty {
					return fmt.Errorf("stok %s tidak cukup", p.Name)
				}
				if err := tx.Model(&p).Update("stock", p.Stock-it.Qty).Error; err != nil {
					return err
				}
			}
			lineTotal := linePrice * int64(it.Qty)
			subtotal += lineTotal
			wg := lineWeight
			if wg < 1 {
				wg = 500
			}
			weightGram += wg * it.Qty
			midtransItems = append(midtransItems, service.MidtransItem{
				ID: fmt.Sprint(p.ID), Price: linePrice, Quantity: it.Qty, Name: lineName,
			})
			lines = append(lines, model.OrderItem{
				ProductID: p.ID, ProductVariantID: variantID, VariantName: variantName, Qty: it.Qty, Price: linePrice,
			})
		}
		return nil
	})
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	var u model.User
	if err := o.DB.First(&u, uid).Error; err != nil {
		return fiber.ErrInternalServerError
	}

	hasBB := service.BinderbyteAPIKey() != ""
	var shippingCost int64
	destSlug := strings.TrimSpace(strings.ToLower(body.DestinationSlug))
	if destSlug == "" {
		destSlug = service.CityNameToBinderSlug(u.CityName)
	}
	courier := strings.TrimSpace(strings.ToLower(body.Courier))
	if courier == "" {
		courier = "jne"
	}
	serviceCode := strings.TrimSpace(body.ShippingService)

	if hasBB {
		if destSlug == "" || serviceCode == "" {
			return fiber.NewError(fiber.StatusBadRequest, "pilih kab/kota tujuan dan layanan pengiriman (Binderbyte aktif), atau isi destination_slug")
		}
		origin, err := o.adminOriginSlug()
		if err != nil {
			return err
		}
		quotes, err := service.GetShippingCost(origin, destSlug, weightGram, courier)
		if err != nil {
			return fiber.NewError(fiber.StatusBadGateway, "ongkir: "+err.Error())
		}
		price, ok := service.MatchShippingPrice(quotes, courier, serviceCode)
		if !ok {
			return fiber.NewError(fiber.StatusBadRequest, "layanan pengiriman tidak valid atau tidak tersedia — pilih ulang ongkir")
		}
		shippingCost = price
	}

	shipPhone := strings.TrimSpace(body.ShippingPhone)
	if shipPhone == "" {
		shipPhone = strings.TrimSpace(u.Phone)
	}
	shipAddr := strings.TrimSpace(body.ShippingAddress)
	if shipAddr == "" {
		shipAddr = strings.TrimSpace(u.Address)
	}
	shipProv := strings.TrimSpace(body.ShippingProvince)
	if shipProv == "" {
		shipProv = strings.TrimSpace(u.ProvinceName)
	}
	shipCity := strings.TrimSpace(body.ShippingCity)
	if shipCity == "" {
		shipCity = strings.TrimSpace(u.CityName)
	}
	postal := strings.TrimSpace(body.ShippingPostalCode)
	if postal == "" {
		postal = strings.TrimSpace(u.PostalCode)
	}
	if shipAddr == "" || shipPhone == "" {
		return fiber.NewError(fiber.StatusBadRequest, "alamat lengkap dan nomor telepon pengiriman wajib diisi (profil atau checkout)")
	}

	shipTo := strings.TrimSpace(strings.TrimSpace(u.FirstName) + " " + strings.TrimSpace(u.LastName))
	if shipTo == "" {
		shipTo = u.Email
	}

	totalAmt := subtotal + shippingCost
	ref := orderRefID(uid, pm)
	grossStr := fmt.Sprintf("%d", totalAmt)

	ord := model.Order{
		UserID:             uid,
		MidtransOrderID:    ref,
		Subtotal:           subtotal,
		ShippingCost:       shippingCost,
		Total:              totalAmt,
		Status:             initialOrderStatus(pm),
		GrossAmount:        grossStr,
		PaymentMethod:      pm,
		ShipToName:         shipTo,
		ShippingPhone:      shipPhone,
		ShippingAddress:    shipAddr,
		ShippingProvince:   shipProv,
		ShippingCity:       shipCity,
		ShippingPostalCode: postal,
		ShippingCityID:     destSlug,
		Courier:            courier,
		ShippingService:    serviceCode,
	}
	if err := o.DB.Create(&ord).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	for i := range lines {
		lines[i].OrderID = ord.ID
	}
	if err := o.DB.Create(&lines).Error; err != nil {
		return fiber.ErrInternalServerError
	}

	if !service.UsesMidtrans(pm) {
		_ = o.DB.Preload("Items.Product").First(&ord, ord.ID)
		return c.JSON(fiber.Map{
			"order":                ord,
			"payment_url":          "",
			"payment_method":       pm,
			"payment_instructions": paymentInstructions(pm),
		})
	}

	req := service.MidtransPaymentRequest{
		OrderID:       ref,
		Amount:        totalAmt,
		Items:         midtransItemsWithShipping(midtransItems, ord),
		Customer:      midtransCustomer(u),
		ReturnURL:     midtransReturnURL(),
		NotifyURL:     normalizeMidtransNotifyURL(os.Getenv("MIDTRANS_NOTIFY_URL")),
		CancelURL:     midtransCancelURL(),
		PaymentMethod: pm,
	}
	if req.NotifyURL == "" {
		if base := normalizeMidtransURL(os.Getenv("APP_PUBLIC_URL")); base != "" {
			req.NotifyURL = base + "/api/midtrans-webhook"
		}
	}
	payment, err := service.CreateMidtransPayment(req)
	if err != nil {
		_ = o.DB.Model(&ord).Update("status", "dibatalkan")
		for _, li := range lines {
			if li.ProductVariantID != nil {
				_ = o.DB.Model(&model.ProductVariant{}).Where("id = ?", *li.ProductVariantID).
					Update("stock", gorm.Expr("stock + ?", li.Qty))
			} else {
				_ = o.DB.Model(&model.Product{}).Where("id = ?", li.ProductID).
					Update("stock", gorm.Expr("stock + ?", li.Qty))
			}
		}
		return fiber.NewError(fiber.StatusBadGateway, "gagal membuat pembayaran: "+err.Error())
	}

	_ = o.DB.Preload("Items.Product").First(&ord, ord.ID)
	return c.JSON(fiber.Map{
		"order":                ord,
		"payment_url":          payment.RedirectURL,
		"payment_token":        payment.Token,
		"payment_method":       pm,
		"payment_instructions": service.MidtransPaymentInstructions(payment),
		"midtrans":             payment.Raw,
	})
}

type createTransactionBody struct {
	OrderID uint `json:"order_id"`
}

func (o *OrderController) CreateTransaction(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	var body createTransactionBody
	if err := c.BodyParser(&body); err != nil || body.OrderID == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "order_id wajib")
	}
	var ord model.Order
	if err := o.DB.Preload("Items.Product").Preload("Items.ProductVariant").First(&ord, body.OrderID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
	}
	if ord.UserID != uid {
		return fiber.ErrForbidden
	}
	if !canPayOrderStatus(ord.Status) {
		return fiber.NewError(fiber.StatusBadRequest, "hanya order belum dibayar yang bisa dibayar ulang")
	}
	if !service.UsesMidtrans(ord.PaymentMethod) {
		return fiber.NewError(fiber.StatusBadRequest, "order ini tidak memakai pembayaran online")
	}

	var u model.User
	_ = o.DB.First(&u, uid)

	var midtransItems []service.MidtransItem
	for _, it := range ord.Items {
		name := it.Product.Name
		if it.VariantName != "" {
			name += " - " + it.VariantName
		}
		midtransItems = append(midtransItems, service.MidtransItem{
			ID: fmt.Sprint(it.ProductID), Price: it.Price, Quantity: it.Qty, Name: name,
		})
	}
	newRef := orderRefID(uid, ord.PaymentMethod)
	if err := o.DB.Model(&ord).Update("midtrans_order_id", newRef).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	ord.MidtransOrderID = newRef
	req := service.MidtransPaymentRequest{
		OrderID:       ord.MidtransOrderID,
		Amount:        ord.Total,
		Items:         midtransItemsWithShipping(midtransItems, ord),
		Customer:      midtransCustomer(u),
		ReturnURL:     midtransReturnURL(),
		NotifyURL:     normalizeMidtransNotifyURL(os.Getenv("MIDTRANS_NOTIFY_URL")),
		CancelURL:     midtransCancelURL(),
		PaymentMethod: ord.PaymentMethod,
	}
	if req.NotifyURL == "" {
		if base := normalizeMidtransURL(os.Getenv("APP_PUBLIC_URL")); base != "" {
			req.NotifyURL = base + "/api/midtrans-webhook"
		}
	}
	payment, err := service.CreateMidtransPayment(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, err.Error())
	}
	return c.JSON(fiber.Map{
		"payment_url":          payment.RedirectURL,
		"payment_token":        payment.Token,
		"payment_instructions": service.MidtransPaymentInstructions(payment),
		"order_id":             ord.ID,
		"midtrans":             payment.Raw,
	})
}

func (o *OrderController) MyOrders(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	var list []model.Order
	if err := o.DB.Preload("Items.Product").Preload("Items.ProductVariant").Preload("Reviews").Where("user_id = ?", uid).Order("id desc").Find(&list).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	o.syncMidtransOrderList(list)
	return c.JSON(list)
}

func (o *OrderController) syncMidtransOrderList(list []model.Order) {
	for i := range list {
		_ = o.syncMidtransOrderStatus(&list[i])
	}
}

func (o *OrderController) syncMidtransOrderStatus(ord *model.Order) error {
	if ord == nil || !service.UsesMidtrans(ord.PaymentMethod) || !canPayOrderStatus(ord.Status) || strings.TrimSpace(ord.MidtransOrderID) == "" {
		return nil
	}
	p, _, err := service.GetMidtransTransactionStatus(ord.MidtransOrderID)
	if err != nil {
		return err
	}
	if gross, err := service.ParseMidtransAmount(p.GrossAmount); err == nil && gross > 0 && ord.Total != gross {
		return fmt.Errorf("jumlah tidak cocok")
	}
	newStatus := service.MapMidtransOrderStatus(p.TransactionStatus, p.FraudStatus)
	if newStatus == ord.Status {
		return nil
	}
	return o.updateOrderStatus(ord, newStatus)
}

func (o *OrderController) restoreOrderStock(tx *gorm.DB, ordID uint) error {
	var items []model.OrderItem
	if err := tx.Where("order_id = ?", ordID).Find(&items).Error; err != nil {
		return err
	}
	for _, it := range items {
		if it.ProductVariantID != nil {
			if err := tx.Model(&model.ProductVariant{}).Where("id = ?", *it.ProductVariantID).
				Update("stock", gorm.Expr("stock + ?", it.Qty)).Error; err != nil {
				return err
			}
			continue
		}
		if err := tx.Model(&model.Product{}).Where("id = ?", it.ProductID).
			Update("stock", gorm.Expr("stock + ?", it.Qty)).Error; err != nil {
			return err
		}
	}
	return nil
}

func (o *OrderController) updateOrderStatus(ord *model.Order, status string) error {
	return o.DB.Transaction(func(tx *gorm.DB) error {
		prevStatus := ord.Status
		if prevStatus != "dibatalkan" && status == "dibatalkan" {
			if err := o.restoreOrderStock(tx, ord.ID); err != nil {
				return err
			}
		}
		if err := tx.Model(ord).Update("status", status).Error; err != nil {
			return err
		}
		ord.Status = status
		return nil
	})
}

func (o *OrderController) CancelOrder(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	id, _ := strconv.Atoi(c.Params("id"))
	var ord model.Order
	if err := o.DB.First(&ord, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
	}
	if ord.UserID != uid {
		return fiber.ErrForbidden
	}
	if !canCustomerCancelOrderStatus(ord.Status) {
		return fiber.NewError(fiber.StatusBadRequest, "hanya pesanan belum dibayar yang bisa dibatalkan")
	}
	if err := o.updateOrderStatus(&ord, "dibatalkan"); err != nil {
		return fiber.ErrInternalServerError
	}
	_ = o.DB.Preload("Items.Product").Preload("Items.ProductVariant").Preload("Reviews").First(&ord, ord.ID)
	return c.JSON(ord)
}

type updateStatusBody struct {
	Status         string `json:"status"`
	TrackingNumber string `json:"tracking_number"`
}

func validOrderStatus(status string) bool {
	switch status {
	case "dikemas", "dikirim", "dibatalkan":
		return true
	default:
		return false
	}
}

func (o *OrderController) AdminUpdateStatus(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var body updateStatusBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	body.Status = strings.TrimSpace(strings.ToLower(body.Status))
	if !validOrderStatus(body.Status) {
		return fiber.NewError(fiber.StatusBadRequest, "status tidak valid")
	}
	body.TrackingNumber = strings.TrimSpace(body.TrackingNumber)
	if body.Status == "dikirim" && body.TrackingNumber == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nomor resi wajib diisi saat status dikirim")
	}
	var ord model.Order
	if err := o.DB.First(&ord, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
	}
	if ord.Status == "dibatalkan" && body.Status != "dibatalkan" {
		return fiber.NewError(fiber.StatusBadRequest, "pesanan yang sudah dibatalkan tidak bisa diubah statusnya")
	}
	if ord.Status == "belum_dibayar" || ord.Status == "pending" {
		return fiber.NewError(fiber.StatusBadRequest, "pesanan belum bayar tidak bisa diubah status oleh admin")
	}
	if ord.Status == "dikirim" && body.Status == "dibatalkan" {
		return fiber.NewError(fiber.StatusBadRequest, "pesanan yang sudah dikirim tidak bisa dibatalkan")
	}
	if err := o.updateOrderStatus(&ord, body.Status); err != nil {
		return fiber.ErrInternalServerError
	}
	if body.Status == "dikirim" || body.TrackingNumber != "" {
		if err := o.DB.Model(&ord).Update("tracking_number", body.TrackingNumber).Error; err != nil {
			return fiber.ErrInternalServerError
		}
		ord.TrackingNumber = body.TrackingNumber
	}
	return c.JSON(ord)
}

func (o *OrderController) AdminListOrders(c *fiber.Ctx) error {
	var list []model.Order
	if err := o.DB.Preload("User").Preload("Items.Product").Preload("Items.ProductVariant").Preload("Reviews").Order("id desc").Find(&list).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	o.syncMidtransOrderList(list)
	return c.JSON(list)
}

// GetOrder order milik user yang login.
func (o *OrderController) GetOrder(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	id, _ := strconv.Atoi(c.Params("id"))
	var ord model.Order
	if err := o.DB.Preload("User").Preload("Items.Product").Preload("Items.ProductVariant").Preload("Reviews").First(&ord, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
	}
	if ord.UserID != uid {
		return fiber.ErrForbidden
	}
	_ = o.syncMidtransOrderStatus(&ord)
	return c.JSON(orderResponse(ord, o.orderSender()))
}

// AdminGetOrder satu order lengkap untuk admin / cetak.
func (o *OrderController) AdminGetOrder(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var ord model.Order
	if err := o.DB.Preload("User").Preload("Items.Product").Preload("Items.ProductVariant").Preload("Reviews").First(&ord, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
	}
	_ = o.syncMidtransOrderStatus(&ord)
	uid, _ := c.Locals("user_id").(uint)
	return c.JSON(orderResponse(ord, o.orderSender(uid)))
}

type salesDayRow struct {
	Day     string `json:"day" gorm:"column:day"`
	Orders  int64  `json:"orders" gorm:"column:cnt"`
	Revenue int64  `json:"revenue" gorm:"column:revenue"`
}

type reviewBody struct {
	ProductID uint   `json:"product_id"`
	Rating    int    `json:"rating"`
	Comment   string `json:"comment"`
}

func (o *OrderController) CreateReview(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	id, _ := strconv.Atoi(c.Params("id"))
	var body reviewBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if body.ProductID == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "produk wajib dipilih")
	}
	if body.Rating < 1 || body.Rating > 5 {
		return fiber.NewError(fiber.StatusBadRequest, "rating harus 1 sampai 5")
	}

	var ord model.Order
	if err := o.DB.Preload("Items").First(&ord, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
	}
	if ord.UserID != uid {
		return fiber.ErrForbidden
	}
	if ord.Status != "dikirim" {
		return fiber.NewError(fiber.StatusBadRequest, "ulasan hanya bisa dibuat setelah pesanan dikirim")
	}

	purchased := false
	for _, it := range ord.Items {
		if it.ProductID == body.ProductID {
			purchased = true
			break
		}
	}
	if !purchased {
		return fiber.NewError(fiber.StatusForbidden, "hanya bisa mengulas produk yang pernah dibeli")
	}

	var review model.ProductReview
	err := o.DB.Where("order_id = ? AND product_id = ? AND user_id = ?", ord.ID, body.ProductID, uid).First(&review).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return fiber.ErrInternalServerError
	}
	review.ProductID = body.ProductID
	review.UserID = uid
	review.OrderID = ord.ID
	review.Rating = body.Rating
	review.Comment = strings.TrimSpace(body.Comment)
	if review.ID == 0 {
		if err := o.DB.Create(&review).Error; err != nil {
			return fiber.ErrInternalServerError
		}
	} else if err := o.DB.Save(&review).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	_ = o.DB.Preload("User").Preload("Product").First(&review, review.ID)
	return c.JSON(review)
}

// AdminSalesSummary ringkasan penjualan (order dikemas/dikirim).
func (o *OrderController) AdminSalesSummary(c *fiber.Ctx) error {
	from := strings.TrimSpace(c.Query("from"))
	to := strings.TrimSpace(c.Query("to"))
	if from == "" || to == "" {
		to = time.Now().Format("2006-01-02")
		from = time.Now().AddDate(0, 0, -29).Format("2006-01-02")
	}

	var totalRev int64
	var orderCnt int64
	o.DB.Model(&model.Order{}).
		Where("status IN ? AND DATE(created_at) BETWEEN ? AND ?", []string{"dikemas", "dikirim"}, from, to).
		Select("COALESCE(SUM(total),0)").Scan(&totalRev)
	o.DB.Model(&model.Order{}).
		Where("status IN ? AND DATE(created_at) BETWEEN ? AND ?", []string{"dikemas", "dikirim"}, from, to).
		Count(&orderCnt)

	var days []salesDayRow
	_ = o.DB.Raw(`
		SELECT DATE(created_at) AS day, COUNT(*) AS cnt, COALESCE(SUM(total),0) AS revenue
		FROM orders
		WHERE status IN ('dikemas', 'dikirim') AND DATE(created_at) BETWEEN ? AND ?
		GROUP BY DATE(created_at)
		ORDER BY day ASC
	`, from, to).Scan(&days).Error

	var pendingCnt int64
	o.DB.Model(&model.Order{}).Where("status IN ?", []string{"belum_dibayar", "pending"}).Count(&pendingCnt)

	return c.JSON(fiber.Map{
		"from":           from,
		"to":             to,
		"paid_orders":    orderCnt,
		"paid_revenue":   totalRev,
		"pending_orders": pendingCnt,
		"daily":          days,
	})
}

func (o *OrderController) MidtransWebhook(c *fiber.Ctx) error {
	var p service.MidtransWebhookPayload
	if err := c.BodyParser(&p); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "payload tidak valid")
	}

	var ord model.Order
	if err := o.DB.Where("midtrans_order_id = ?", strings.TrimSpace(p.OrderID)).First(&ord).Error; err != nil {
		return c.SendStatus(fiber.StatusOK)
	}
	if !service.UsesMidtrans(ord.PaymentMethod) {
		return c.SendStatus(fiber.StatusOK)
	}
	if !service.VerifyMidtransSignature(p) {
		return fiber.NewError(fiber.StatusBadRequest, "signature pembayaran tidak valid")
	}
	if gross, err := service.ParseMidtransAmount(p.GrossAmount); err == nil && gross > 0 && ord.Total != gross {
		return fiber.NewError(fiber.StatusBadRequest, "jumlah tidak cocok")
	}

	newStatus := service.MapMidtransOrderStatus(p.TransactionStatus, p.FraudStatus)
	if ord.Status == "dibatalkan" {
		return c.JSON(fiber.Map{"ok": true})
	}

	if err := o.updateOrderStatus(&ord, newStatus); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

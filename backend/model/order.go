package model

import "time"

type Order struct {
	ID                 uint            `gorm:"primaryKey" json:"id"`
	UserID             uint            `gorm:"index;not null" json:"user_id"`
	User               User            `json:"user,omitempty"`
	Sender             *User           `gorm:"-" json:"sender,omitempty"`
	MidtransOrderID    string          `gorm:"size:64;uniqueIndex" json:"midtrans_order_id"`         // reference id pembayaran (legacy nama kolom)
	Subtotal           int64           `gorm:"not null;default:0" json:"subtotal"`                   // total barang
	ShippingCost       int64           `gorm:"not null;default:0" json:"shipping_cost"`              // ongkir
	Total              int64           `gorm:"not null" json:"total"`                                // subtotal + ongkir
	Status             string          `gorm:"size:20;not null;default:belum_dibayar" json:"status"` // belum_dibayar | pending | dikemas | dikirim | dibatalkan
	GrossAmount        string          `gorm:"size:32" json:"gross_amount"`
	PaymentMethod      string          `gorm:"size:40;not null;default:midtrans_va_bca" json:"payment_method"` // midtrans_va_* | midtrans_qris | midtrans_gopay | midtrans_shopeepay | midtrans_credit_card | midtrans_cstore | cod | bank_transfer
	ShipToName         string          `gorm:"size:200;default:''" json:"ship_to_name"`
	ShippingPhone      string          `gorm:"size:32;default:''" json:"shipping_phone"`
	ShippingAddress    string          `gorm:"type:text" json:"shipping_address"`
	ShippingProvince   string          `gorm:"size:120;default:''" json:"shipping_province"`
	ShippingCity       string          `gorm:"size:120;default:''" json:"shipping_city"`
	ShippingPostalCode string          `gorm:"size:20;default:''" json:"shipping_postal_code"`
	ShippingCityID     string          `gorm:"size:64;default:''" json:"shipping_city_id"` // slug kota tujuan Binderbyte (cost) / legacy id
	Courier            string          `gorm:"size:32;default:''" json:"courier"`          // jne, pos, tiki, ...
	ShippingService    string          `gorm:"size:64;default:''" json:"shipping_service"` // REG, dll.
	TrackingNumber     string          `gorm:"size:120;default:''" json:"tracking_number"` // nomor resi pengiriman
	Items              []OrderItem     `json:"items,omitempty"`
	Reviews            []ProductReview `json:"reviews,omitempty" gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

type OrderItem struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	OrderID          uint           `gorm:"index;not null" json:"order_id"`
	ProductID        uint           `gorm:"not null" json:"product_id"`
	Product          Product        `json:"product,omitempty"`
	ProductVariantID *uint          `gorm:"index" json:"product_variant_id,omitempty"`
	ProductVariant   ProductVariant `json:"product_variant,omitempty"`
	VariantName      string         `gorm:"size:120;default:''" json:"variant_name"`
	Qty              int            `gorm:"not null" json:"qty"`
	Price            int64          `gorm:"not null" json:"price"`
}

package model

import "time"

// ProductImage satu file galeri per produk (banyak gambar per produk).
type ProductImage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ProductID uint      `gorm:"index;not null" json:"product_id"`
	ImageURL  string    `gorm:"size:512;not null" json:"image_url"`
	SortOrder int       `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

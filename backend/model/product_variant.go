package model

import "time"

type ProductVariant struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ProductID  uint      `gorm:"index;not null" json:"product_id"`
	Name       string    `gorm:"size:120;not null" json:"name"`
	SKU        string    `gorm:"size:80;default:''" json:"sku"`
	Price      int64     `gorm:"not null;default:0" json:"price"`
	PriceDelta int64     `gorm:"not null;default:0" json:"price_delta"`
	Stock      int       `gorm:"not null;default:0" json:"stock"`
	WeightGram int       `gorm:"not null;default:500" json:"weight_gram"`
	SortOrder  int       `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

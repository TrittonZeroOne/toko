package model

import (
	"time"

	"gorm.io/gorm"
)

type Product struct {
	ID          uint             `gorm:"primaryKey" json:"id"`
	Name        string           `gorm:"size:255;not null" json:"name"`
	Description string           `gorm:"type:text" json:"description"`
	Price       int64            `gorm:"not null" json:"price"`                   // IDR
	WeightGram  int              `gorm:"not null;default:500" json:"weight_gram"` // berat per unit (gram), untuk ongkir
	Stock       int              `gorm:"not null;default:0" json:"stock"`
	ImageURL    string           `gorm:"size:512" json:"image_url"`
	CategoryID  uint             `json:"category_id"`
	Category    Category         `json:"category,omitempty"`
	Images      []ProductImage   `json:"images,omitempty" gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE"`
	Variants    []ProductVariant `json:"variants,omitempty" gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE"`
	Reviews     []ProductReview  `json:"reviews,omitempty" gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
	DeletedAt   gorm.DeletedAt   `gorm:"index" json:"deleted_at,omitempty"`
}

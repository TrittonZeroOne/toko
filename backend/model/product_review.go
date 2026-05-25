package model

import "time"

type ProductReview struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ProductID uint      `gorm:"index;uniqueIndex:idx_review_order_product_user;not null" json:"product_id"`
	Product   Product   `json:"product,omitempty"`
	UserID    uint      `gorm:"index;uniqueIndex:idx_review_order_product_user;not null" json:"user_id"`
	User      User      `json:"user,omitempty"`
	OrderID   uint      `gorm:"index;uniqueIndex:idx_review_order_product_user;not null" json:"order_id"`
	Rating    int       `gorm:"not null" json:"rating"`
	Comment   string    `gorm:"type:text" json:"comment"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

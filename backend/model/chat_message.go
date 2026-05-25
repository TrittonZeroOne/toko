package model

import "time"

type ChatMessage struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	OrderID    *uint     `gorm:"index" json:"order_id,omitempty"`
	Order      Order     `json:"order,omitempty" gorm:"constraint:OnDelete:SET NULL,OnUpdate:CASCADE"`
	ProductID  *uint     `gorm:"index" json:"product_id,omitempty"`
	Product    Product   `json:"product,omitempty" gorm:"constraint:OnDelete:SET NULL,OnUpdate:CASCADE"`
	UserID     uint      `gorm:"index;not null" json:"user_id"`
	User       User      `json:"user,omitempty"`
	SenderID   uint      `gorm:"index;not null" json:"sender_id"`
	Sender     User      `json:"sender,omitempty"`
	SenderRole string    `gorm:"size:20;not null" json:"sender_role"` // admin | customer
	Message    string    `gorm:"type:text;not null" json:"message"`
	CreatedAt  time.Time `json:"created_at"`
}

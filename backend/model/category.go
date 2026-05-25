package model

import "time"

type Category struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:191;not null" json:"name"`
	Slug      string    `gorm:"uniqueIndex;size:191;not null" json:"slug"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Products  []Product `gorm:"foreignKey:CategoryID" json:"products,omitempty"`
}

package model

import "time"

type User struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	Email             string     `gorm:"uniqueIndex;size:191;not null" json:"email"`
	Password          string     `gorm:"size:255;not null" json:"-"`
	FirstName         string     `gorm:"size:100;not null;default:''" json:"first_name"`
	LastName          string     `gorm:"size:100;not null;default:''" json:"last_name"`
	Role              string     `gorm:"size:20;not null;default:customer" json:"role"` // admin | customer
	Phone             string     `gorm:"size:32;default:''" json:"phone"`
	Address           string     `gorm:"type:text" json:"address"`              // alamat jalan
	ProvinceID        string     `gorm:"size:32;default:''" json:"province_id"` // Binderbyte wilayah: id provinsi
	CityID            string     `gorm:"size:32;default:''" json:"city_id"`     // id kab/kota
	DistrictID        string     `gorm:"size:32;default:''" json:"district_id"` // kecamatan
	DistrictName      string     `gorm:"size:120;default:''" json:"district_name"`
	SubdistrictID     string     `gorm:"size:32;default:''" json:"subdistrict_id"` // kelurahan/desa
	SubdistrictName   string     `gorm:"size:120;default:''" json:"subdistrict_name"`
	ProvinceName      string     `gorm:"size:120;default:''" json:"province_name"`
	CityName          string     `gorm:"size:120;default:''" json:"city_name"` // label kab/kota (untuk slug ongkir Binderbyte)
	PostalCode        string     `gorm:"size:20;default:''" json:"postal_code"`
	EmailVerifiedAt   *time.Time `json:"email_verified_at,omitempty"`
	EmailVerifyToken  string     `gorm:"size:128;index" json:"-"`
	EmailVerifySentAt *time.Time `json:"-"`
	ResetOTP          string     `gorm:"size:16" json:"-"`
	ResetOTPSentAt    *time.Time `json:"-"`
	ResetOTPExpiresAt *time.Time `json:"-"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

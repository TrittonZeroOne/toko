package controller

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"
	"toko/backend/middleware"
	"toko/backend/model"
	"toko/backend/service"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthController struct {
	DB *gorm.DB
}

type registerBody struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func userJSON(u model.User) fiber.Map {
	return fiber.Map{
		"id":               u.ID,
		"email":            u.Email,
		"first_name":       u.FirstName,
		"last_name":        u.LastName,
		"role":             u.Role,
		"phone":            u.Phone,
		"address":          u.Address,
		"province_id":      u.ProvinceID,
		"city_id":          u.CityID,
		"district_id":      u.DistrictID,
		"district_name":    u.DistrictName,
		"subdistrict_id":   u.SubdistrictID,
		"subdistrict_name": u.SubdistrictName,
		"province_name":    u.ProvinceName,
		"city_name":        u.CityName,
		"postal_code":      u.PostalCode,
		"email_verified":   u.EmailVerifiedAt != nil,
	}
}

func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func randomOTP() string {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	return fmt.Sprintf("%06d", n.Int64())
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Me mengembalikan profil user yang sedang login (dari database).
func (a *AuthController) Me(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	var u model.User
	if err := a.DB.Select(
		"id", "email", "first_name", "last_name", "role",
		"phone", "address", "province_id", "city_id",
		"district_id", "district_name", "subdistrict_id", "subdistrict_name",
		"province_name", "city_name", "postal_code",
	).First(&u, uid).Error; err != nil {
		return fiber.ErrUnauthorized
	}
	return c.JSON(userJSON(u))
}

func (a *AuthController) Register(c *fiber.Ctx) error {
	var body registerBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	body.FirstName = strings.TrimSpace(body.FirstName)
	body.LastName = strings.TrimSpace(body.LastName)
	body.Email = normalizeEmail(body.Email)
	if body.Email == "" || len(body.Password) < 6 {
		return fiber.NewError(fiber.StatusBadRequest, "email wajib, password minimal 6 karakter")
	}
	if body.FirstName == "" || body.LastName == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama depan dan nama belakang wajib")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	u := model.User{
		Email:            body.Email,
		Password:         string(hash),
		FirstName:        body.FirstName,
		LastName:         body.LastName,
		Role:             "customer",
		EmailVerifyToken: randomToken(32),
	}
	if err := a.DB.Create(&u).Error; err != nil {
		return fiber.NewError(fiber.StatusConflict, "email sudah terdaftar")
	}
	now := time.Now()
	_ = a.DB.Model(&u).Update("email_verify_sent_at", &now).Error
	_ = service.SendVerificationEmail(u.Email, u.EmailVerifyToken)
	return c.JSON(fiber.Map{
		"ok":      true,
		"message": "Akun dibuat. Cek email untuk verifikasi sebelum login.",
		"user":    userJSON(u),
	})
}

func (a *AuthController) Login(c *fiber.Ctx) error {
	var body loginBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	var u model.User
	body.Email = normalizeEmail(body.Email)
	if err := a.DB.Where("email = ?", body.Email).First(&u).Error; err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "email atau password salah")
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(body.Password)) != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "email atau password salah")
	}
	if u.Role != "admin" && u.EmailVerifiedAt == nil {
		return fiber.NewError(fiber.StatusForbidden, "email belum diverifikasi. Kirim ulang verifikasi dari halaman login.")
	}
	token, err := middleware.GenerateToken(u.ID, u.Role)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"token": token, "user": userJSON(u)})
}

type emailBody struct {
	Email string `json:"email"`
}

type verifyEmailBody struct {
	Token string `json:"token"`
}

func (a *AuthController) ResendVerification(c *fiber.Ctx) error {
	var body emailBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	email := normalizeEmail(body.Email)
	var u model.User
	if err := a.DB.Where("email = ?", email).First(&u).Error; err != nil {
		return c.JSON(fiber.Map{"ok": true})
	}
	if u.EmailVerifiedAt != nil {
		return c.JSON(fiber.Map{"ok": true, "message": "Email sudah diverifikasi."})
	}
	u.EmailVerifyToken = randomToken(32)
	now := time.Now()
	u.EmailVerifySentAt = &now
	if err := a.DB.Save(&u).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	if err := service.SendVerificationEmail(u.Email, u.EmailVerifyToken); err != nil {
		return fiber.NewError(fiber.StatusBadGateway, "gagal mengirim email verifikasi")
	}
	return c.JSON(fiber.Map{"ok": true, "message": "Email verifikasi dikirim ulang."})
}

func (a *AuthController) VerifyEmail(c *fiber.Ctx) error {
	var body verifyEmailBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	token := strings.TrimSpace(body.Token)
	if token == "" {
		return fiber.NewError(fiber.StatusBadRequest, "token wajib")
	}
	var u model.User
	if err := a.DB.Where("email_verify_token = ?", token).First(&u).Error; err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "token verifikasi tidak valid")
	}
	now := time.Now()
	u.EmailVerifiedAt = &now
	u.EmailVerifyToken = ""
	if err := a.DB.Save(&u).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true, "message": "Email berhasil diverifikasi."})
}

type resetPasswordBody struct {
	Email       string `json:"email"`
	OTP         string `json:"otp"`
	NewPassword string `json:"new_password"`
}

func (a *AuthController) ForgotPassword(c *fiber.Ctx) error {
	var body emailBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	email := normalizeEmail(body.Email)
	if email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email wajib diisi")
	}
	var u model.User
	if err := a.DB.Where("email = ?", email).First(&u).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "email tidak ditemukan")
	}
	otp := randomOTP()
	now := time.Now()
	exp := now.Add(15 * time.Minute)
	u.ResetOTP = otp
	u.ResetOTPSentAt = &now
	u.ResetOTPExpiresAt = &exp
	if err := a.DB.Save(&u).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	if err := service.SendPasswordResetOTP(u.Email, otp, 15); err != nil {
		return fiber.NewError(fiber.StatusBadGateway, "gagal mengirim OTP")
	}
	return c.JSON(fiber.Map{"ok": true, "message": "OTP reset password sudah dikirim ke email Anda."})
}

func (a *AuthController) ResetPassword(c *fiber.Ctx) error {
	var body resetPasswordBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if len(body.NewPassword) < 6 {
		return fiber.NewError(fiber.StatusBadRequest, "password baru minimal 6 karakter")
	}
	var u model.User
	if err := a.DB.Where("email = ?", normalizeEmail(body.Email)).First(&u).Error; err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "OTP tidak valid")
	}
	if u.ResetOTP == "" || strings.TrimSpace(body.OTP) != u.ResetOTP || u.ResetOTPExpiresAt == nil || time.Now().After(*u.ResetOTPExpiresAt) {
		return fiber.NewError(fiber.StatusBadRequest, "OTP tidak valid atau kedaluwarsa")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	u.Password = string(hash)
	u.ResetOTP = ""
	u.ResetOTPExpiresAt = nil
	u.ResetOTPSentAt = nil
	if err := a.DB.Save(&u).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true, "message": "Password berhasil diubah. Silakan login."})
}

type updateProfileBody struct {
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	Phone           string `json:"phone"`
	Address         string `json:"address"`
	ProvinceID      string `json:"province_id"`
	CityID          string `json:"city_id"`
	DistrictID      string `json:"district_id"`
	DistrictName    string `json:"district_name"`
	SubdistrictID   string `json:"subdistrict_id"`
	SubdistrictName string `json:"subdistrict_name"`
	ProvinceName    string `json:"province_name"`
	CityName        string `json:"city_name"`
	PostalCode      string `json:"postal_code"`
}

func (a *AuthController) UpdateProfile(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	var body updateProfileBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	var u model.User
	if err := a.DB.First(&u, uid).Error; err != nil {
		return fiber.ErrUnauthorized
	}
	body.FirstName = strings.TrimSpace(body.FirstName)
	body.LastName = strings.TrimSpace(body.LastName)
	if body.FirstName != "" {
		u.FirstName = body.FirstName
	}
	if body.LastName != "" {
		u.LastName = body.LastName
	}
	u.Phone = strings.TrimSpace(body.Phone)
	u.Address = strings.TrimSpace(body.Address)
	u.ProvinceID = strings.TrimSpace(body.ProvinceID)
	u.CityID = strings.TrimSpace(body.CityID)
	u.DistrictID = strings.TrimSpace(body.DistrictID)
	u.DistrictName = strings.TrimSpace(body.DistrictName)
	u.SubdistrictID = strings.TrimSpace(body.SubdistrictID)
	u.SubdistrictName = strings.TrimSpace(body.SubdistrictName)
	u.ProvinceName = strings.TrimSpace(body.ProvinceName)
	u.CityName = strings.TrimSpace(body.CityName)
	u.PostalCode = strings.TrimSpace(body.PostalCode)
	if err := a.DB.Save(&u).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(userJSON(u))
}

type updatePasswordBody struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (a *AuthController) UpdatePassword(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	var body updatePasswordBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if len(body.NewPassword) < 6 {
		return fiber.NewError(fiber.StatusBadRequest, "password baru minimal 6 karakter")
	}
	var u model.User
	if err := a.DB.First(&u, uid).Error; err != nil {
		return fiber.ErrUnauthorized
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(body.CurrentPassword)) != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "kata sandi saat ini salah")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	u.Password = string(hash)
	if err := a.DB.Save(&u).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

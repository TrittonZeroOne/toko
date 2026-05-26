package service

import (
	"fmt"
	"net/smtp"
	"os"
	"strconv"
	"strings"
)

func appName() string {
	if v := strings.TrimSpace(os.Getenv("APP_NAME")); v != "" {
		return v
	}
	return "Toko"
}

func frontendURL() string {
	if v := strings.TrimSpace(os.Getenv("FRONTEND_PUBLIC_URL")); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://localhost:5173"
}

func SendEmail(to, subject, body string) error {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if from == "" {
		from = strings.TrimSpace(os.Getenv("SMTP_USER"))
	}
	if host == "" || from == "" {
		return fmt.Errorf("email service not configured: set SMTP_HOST and SMTP_FROM")
	}
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := os.Getenv("SMTP_PASSWORD")
	addr := host + ":" + port
	msg := strings.Join([]string{
		"From: " + from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")
	var auth smtp.Auth
	if user != "" || pass != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}
	return smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
}

func SendVerificationEmail(to, token string) error {
	link := fmt.Sprintf("%s/verify-email?token=%s", frontendURL(), token)
	body := fmt.Sprintf("Halo,\n\nKlik link berikut untuk verifikasi email akun %s:\n%s\n\nJika Anda tidak merasa mendaftar, abaikan email ini.", appName(), link)
	return SendEmail(to, "Verifikasi email "+appName(), body)
}

func SendPasswordResetOTP(to, otp string, minutes int) error {
	body := fmt.Sprintf("Kode OTP reset password %s Anda: %s\n\nKode berlaku %s menit. Abaikan jika Anda tidak meminta reset password.", appName(), otp, strconv.Itoa(minutes))
	return SendEmail(to, "OTP reset password "+appName(), body)
}

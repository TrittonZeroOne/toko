package middleware

import (
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type TokenClaims struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func JWTSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		return []byte("dev-only-change-in-production")
	}
	return []byte(s)
}

func GenerateToken(userID uint, role string) (string, error) {
	claims := TokenClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(JWTSecret())
}

func JWTMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		h := c.Get("Authorization")
		if h == "" || !strings.HasPrefix(h, "Bearer ") {
			return fiber.ErrUnauthorized
		}
		raw := strings.TrimPrefix(h, "Bearer ")
		claims := &TokenClaims{}
		_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
			return JWTSecret(), nil
		})
		if err != nil {
			return fiber.ErrUnauthorized
		}
		c.Locals("user_id", claims.UserID)
		c.Locals("role", claims.Role)
		return c.Next()
	}
}

func RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals("role").(string)
		for _, r := range roles {
			if role == r {
				return c.Next()
			}
		}
		return fiber.ErrForbidden
	}
}

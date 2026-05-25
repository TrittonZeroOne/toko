package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"toko/backend/config"
	"toko/backend/model"
	"toko/backend/route"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func main() {
	loadEnv()

	db, err := config.ConnectDB()
	if err != nil {
		log.Fatal("database: ", err)
	}
	if err := autoMigrate(db); err != nil {
		log.Fatal("migrate: ", err)
	}
	if err := ensureOrderItemVariantFK(db); err != nil {
		log.Fatal("order item variant fk: ", err)
	}
	if err := backfillProductImages(db); err != nil {
		log.Fatal("backfill product_images: ", err)
	}
	if err := backfillOrdersLegacy(db); err != nil {
		log.Fatal("backfill orders: ", err)
	}
	if err := backfillOrderStatuses(db); err != nil {
		log.Fatal("backfill order statuses: ", err)
	}
	if err := backfillProductVariants(db); err != nil {
		log.Fatal("backfill product variants: ", err)
	}
	if err := backfillExistingVerifiedUsers(db); err != nil {
		log.Fatal("backfill verified users: ", err)
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	if abs, err := filepath.Abs(uploadDir); err == nil {
		uploadDir = abs
	}
	if err := os.MkdirAll(filepath.Join(uploadDir, "products"), 0755); err != nil {
		log.Fatal("upload dir: ", err)
	}

	app := fiber.New(fiber.Config{
		BodyLimit: 25 * 1024 * 1024,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins(),
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowCredentials: true,
	}))

	app.Static("/uploads", uploadDir)

	route.Mount(app, db, uploadDir)

	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8000"
	}
	log.Println("backend jalan di :" + port)
	log.Fatal(app.Listen(":" + port))
}

func loadEnv() {
	var candidates []string
	if _, err := os.Stat(".env"); err == nil {
		candidates = append(candidates, ".env")
	}
	if _, err := os.Stat(filepath.Join("backend", ".env")); err == nil {
		candidates = append(candidates, filepath.Join("backend", ".env"))
	}
	if len(candidates) > 0 {
		_ = godotenv.Overload(candidates...)
	}
}

func allowedOrigins() string {
	defaults := []string{"http://localhost:5173", "http://127.0.0.1:5173"}
	seen := map[string]bool{}
	var origins []string
	add := func(raw string) {
		for _, part := range strings.Split(raw, ",") {
			origin := strings.TrimRight(strings.TrimSpace(part), "/")
			if origin == "" || seen[origin] {
				continue
			}
			seen[origin] = true
			origins = append(origins, origin)
		}
	}
	for _, origin := range defaults {
		add(origin)
	}
	add(os.Getenv("FRONTEND_PUBLIC_URL"))
	add(os.Getenv("CORS_ALLOWED_ORIGINS"))
	return strings.Join(origins, ",")
}

func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.User{},
		&model.Category{},
		&model.Product{},
		&model.ProductImage{},
		&model.ProductVariant{},
		&model.Order{},
		&model.OrderItem{},
		&model.ProductReview{},
		&model.ChatMessage{},
	)
}

func ensureOrderItemVariantFK(db *gorm.DB) error {
	if db.Dialector.Name() == "postgres" {
		return nil
	}

	type fkRow struct {
		ConstraintName string
	}
	var rows []fkRow
	if err := db.Raw(`
		SELECT CONSTRAINT_NAME AS constraint_name
		FROM information_schema.KEY_COLUMN_USAGE
		WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'order_items'
		AND COLUMN_NAME = 'product_variant_id'
		AND REFERENCED_TABLE_NAME = 'product_variants'
	`).Scan(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		if row.ConstraintName == "" {
			continue
		}
		if err := db.Exec("ALTER TABLE order_items DROP FOREIGN KEY " + quoteMySQLIdentifier(row.ConstraintName)).Error; err != nil {
			return err
		}
	}
	return db.Exec(`
		ALTER TABLE order_items
		ADD CONSTRAINT fk_order_items_product_variant
		FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
		ON DELETE SET NULL ON UPDATE CASCADE
	`).Error
}

func quoteMySQLIdentifier(name string) string {
	return "`" + strings.ReplaceAll(name, "`", "``") + "`"
}

// Memindahkan image_url lama ke baris product_images (sekali per produk).
func backfillProductImages(db *gorm.DB) error {
	return db.Exec(`
		INSERT INTO product_images (product_id, image_url, sort_order, created_at, updated_at)
		SELECT p.id, p.image_url, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM products p
		WHERE p.image_url IS NOT NULL AND TRIM(p.image_url) != ''
		AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)
	`).Error
}

// Mengisi subtotal untuk order lama (tanpa ongkir).
func backfillOrdersLegacy(db *gorm.DB) error {
	return db.Exec(`
		UPDATE orders SET subtotal = total, shipping_cost = 0
		WHERE (subtotal IS NULL OR subtotal = 0) AND total > 0
	`).Error
}

func backfillOrderStatuses(db *gorm.DB) error {
	return db.Exec(`
		UPDATE orders
		SET status = CASE
			WHEN status = 'paid' THEN 'dikemas'
			WHEN status = 'failed' THEN 'dibatalkan'
			WHEN status = 'pending' AND payment_method LIKE 'midtrans_%' THEN 'belum_dibayar'
			ELSE status
		END
		WHERE status IN ('paid', 'failed')
		OR (status = 'pending' AND payment_method LIKE 'midtrans_%')
	`).Error
}

func backfillProductVariants(db *gorm.DB) error {
	if db.Dialector.Name() == "postgres" {
		if err := db.Exec(`
			UPDATE product_variants pv
			SET price = GREATEST(0, p.price + pv.price_delta)
			FROM products p
			WHERE p.id = pv.product_id
			AND (pv.price IS NULL OR pv.price = 0)
			AND (p.price + pv.price_delta) > 0
		`).Error; err != nil {
			return err
		}
		return db.Exec(`
			UPDATE product_variants pv
			SET weight_gram = CASE
				WHEN p.weight_gram > 0 THEN p.weight_gram
				ELSE 500
			END
			FROM products p
			WHERE p.id = pv.product_id
			AND (pv.weight_gram IS NULL OR pv.weight_gram < 1)
		`).Error
	}

	if err := db.Exec(`
		UPDATE product_variants pv
		JOIN products p ON p.id = pv.product_id
		SET pv.price = GREATEST(0, p.price + pv.price_delta)
		WHERE (pv.price IS NULL OR pv.price = 0)
		AND (p.price + pv.price_delta) > 0
	`).Error; err != nil {
		return err
	}
	return db.Exec(`
		UPDATE product_variants pv
		JOIN products p ON p.id = pv.product_id
		SET pv.weight_gram = CASE
			WHEN p.weight_gram > 0 THEN p.weight_gram
			ELSE 500
		END
		WHERE pv.weight_gram IS NULL OR pv.weight_gram < 1
	`).Error
}

func backfillExistingVerifiedUsers(db *gorm.DB) error {
	return db.Exec(`
		UPDATE users
		SET email_verified_at = CURRENT_TIMESTAMP
		WHERE email_verified_at IS NULL
		AND (email_verify_token IS NULL OR email_verify_token = '')
	`).Error
}

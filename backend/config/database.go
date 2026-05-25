package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func ConnectDB() (*gorm.DB, error) {
	driver := strings.ToLower(getenv("DB_DRIVER", "mysql"))
	host := getenv("DB_HOST", "127.0.0.1")
	port := getenv("DB_PORT", "3306")
	user := getenv("DB_USER", "root")
	pass := os.Getenv("DB_PASSWORD")
	name := getenv("DB_NAME", "toko")

	if driver == "postgres" || driver == "postgresql" {
		dsn, err := PostgresDSN(host, port, user, pass, name)
		if err != nil {
			return nil, err
		}
		return gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		user, pass, host, port, name,
	)
	return gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
}

func PostgresDSN(host, port, user, pass, name string) (string, error) {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn != "" {
		return dsn, nil
	}
	if strings.TrimSpace(os.Getenv("SUPABASE_URL")) != "" {
		if strings.TrimSpace(pass) == "" {
			return "", errors.New("isi DATABASE_URL dari Supabase Database connection string, atau isi DB_PASSWORD dengan password database Supabase")
		}
		if strings.TrimSpace(host) == "" {
			ref, err := supabaseProjectRef(os.Getenv("SUPABASE_URL"))
			if err != nil {
				return "", err
			}
			host = "db." + ref + ".supabase.co"
		}
		if strings.TrimSpace(port) == "" {
			port = "5432"
		}
		if strings.TrimSpace(user) == "" {
			user = "postgres"
		}
		if strings.TrimSpace(name) == "" {
			name = "postgres"
		}
	}
	sslMode := getenv("DB_SSLMODE", "require")
	timeZone := getenv("DB_TIMEZONE", "Asia/Jakarta")
	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
		host, user, pass, name, port, sslMode, timeZone,
	), nil
}

func getenv(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func supabaseProjectRef(rawURL string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || u.Hostname() == "" {
		return "", errors.New("SUPABASE_URL tidak valid")
	}
	host := u.Hostname()
	ref := strings.TrimSuffix(host, ".supabase.co")
	if ref == "" || ref == host {
		return "", errors.New("SUPABASE_URL harus berupa https://PROJECT_REF.supabase.co")
	}
	return ref, nil
}

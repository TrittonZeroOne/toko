package storage

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var allowedExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

// SaveProductImage menyimpan file upload ke Supabase Storage jika dikonfigurasi,
// atau fallback ke dirBase/products/ dan mengembalikan path URL (/uploads/products/...).
func SaveProductImage(dirBase string, file *multipart.FileHeader) (string, error) {
	if file == nil {
		return "", fmt.Errorf("file kosong")
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		exts, _ := mime.ExtensionsByType(file.Header.Get("Content-Type"))
		if len(exts) > 0 {
			ext = strings.ToLower(exts[0])
		}
	}
	if !allowedExt[ext] {
		return "", fmt.Errorf("ekstensi tidak diizinkan (jpg, png, webp, gif)")
	}
	if file.Size > 5<<20 {
		return "", fmt.Errorf("file maksimal 5MB")
	}
	name := randomName() + ext
	if supabaseStorageEnabled() {
		return saveSupabaseProductImage(file, name)
	}
	sub := filepath.Join(dirBase, "products")
	if err := os.MkdirAll(sub, 0755); err != nil {
		return "", err
	}
	dst := filepath.Join(sub, name)
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()
	out, err := os.Create(dst)
	if err != nil {
		return "", err
	}
	defer out.Close()
	if _, err := io.Copy(out, src); err != nil {
		_ = os.Remove(dst)
		return "", err
	}
	return "/uploads/products/" + name, nil
}

func randomName() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// RemoveProductImage menghapus file Supabase Storage jika URL berasal dari bucket,
// atau file lokal jika path dari aplikasi ini (/uploads/products/...).
func RemoveProductImage(dirBase, publicPath string) {
	if supabaseStorageEnabled() && removeSupabaseProductImage(publicPath) {
		return
	}
	if publicPath == "" || !strings.HasPrefix(publicPath, "/uploads/products/") {
		return
	}
	name := strings.TrimPrefix(publicPath, "/uploads/products/")
	if name == "" || strings.Contains(name, "..") || strings.Contains(name, string(filepath.Separator)) {
		return
	}
	_ = os.Remove(filepath.Join(dirBase, "products", name))
}

func supabaseStorageEnabled() bool {
	return strings.TrimSpace(os.Getenv("SUPABASE_URL")) != "" &&
		strings.TrimSpace(supabaseStorageKey()) != ""
}

func supabaseStorageKey() string {
	if v := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY")); v != "" {
		return v
	}
	return strings.TrimSpace(os.Getenv("SUPABASE_ANON_KEY"))
}

func supabaseBucket() string {
	if v := strings.TrimSpace(os.Getenv("SUPABASE_STORAGE_BUCKET")); v != "" {
		return v
	}
	return "product-images"
}

func supabaseBaseURL() string {
	return strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/")
}

func saveSupabaseProductImage(file *multipart.FileHeader, name string) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	objectPath := "products/" + name
	endpoint := supabaseBaseURL() + "/storage/v1/object/" + url.PathEscape(supabaseBucket()) + "/" + objectPath
	req, err := http.NewRequest(http.MethodPost, endpoint, src)
	if err != nil {
		return "", err
	}
	key := supabaseStorageKey()
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("apikey", key)
	req.Header.Set("Content-Type", file.Header.Get("Content-Type"))
	req.Header.Set("x-upsert", "false")

	client := &http.Client{Timeout: 30 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		return "", fmt.Errorf("gagal upload Supabase Storage: %s %s", res.Status, strings.TrimSpace(string(body)))
	}
	return supabaseBaseURL() + "/storage/v1/object/public/" + url.PathEscape(supabaseBucket()) + "/" + objectPath, nil
}

func removeSupabaseProductImage(publicPath string) bool {
	objectPath := supabaseObjectPath(publicPath)
	if objectPath == "" {
		return false
	}
	endpoint := supabaseBaseURL() + "/storage/v1/object/" + url.PathEscape(supabaseBucket())
	body := strings.NewReader(fmt.Sprintf(`{"prefixes":["%s"]}`, strings.ReplaceAll(objectPath, `"`, `\"`)))
	req, err := http.NewRequest(http.MethodDelete, endpoint, body)
	if err != nil {
		return false
	}
	key := supabaseStorageKey()
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("apikey", key)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return false
	}
	defer res.Body.Close()
	return res.StatusCode >= 200 && res.StatusCode < 300
}

func supabaseObjectPath(publicPath string) string {
	if publicPath == "" {
		return ""
	}
	base := supabaseBaseURL() + "/storage/v1/object/public/" + supabaseBucket() + "/"
	if strings.HasPrefix(publicPath, base) {
		return strings.TrimPrefix(publicPath, base)
	}
	u, err := url.Parse(publicPath)
	if err != nil {
		return ""
	}
	prefix := "/storage/v1/object/public/" + supabaseBucket() + "/"
	if strings.HasPrefix(u.Path, prefix) {
		path, _ := url.PathUnescape(strings.TrimPrefix(u.Path, prefix))
		return path
	}
	return ""
}

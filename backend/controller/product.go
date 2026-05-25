package controller

import (
	"encoding/json"
	"mime/multipart"
	"strconv"
	"strings"

	"toko/backend/model"
	"toko/backend/storage"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

const maxProductImagesPerProduct = 24
const maxProductImagesPerUpload = 12

type ProductController struct {
	DB        *gorm.DB
	UploadDir string // root folder untuk Static /uploads (mis. ./uploads)
}

type productBody struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Price       int64          `json:"price"`
	Stock       int            `json:"stock"`
	WeightGram  int            `json:"weight_gram"`
	CategoryID  uint           `json:"category_id"`
	ClearImage  bool           `json:"clear_image"`
	Variants    []variantInput `json:"variants"`
}

type variantInput struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	SKU        string `json:"sku"`
	Price      int64  `json:"price"`
	PriceDelta int64  `json:"price_delta"`
	Stock      int    `json:"stock"`
	WeightGram int    `json:"weight_gram"`
	SortOrder  int    `json:"sort_order"`
}

func scopeProductImages(db *gorm.DB) *gorm.DB {
	return db.Preload("Images", func(q *gorm.DB) *gorm.DB {
		return q.Order("product_images.sort_order ASC, product_images.id ASC")
	}).Preload("Variants", func(q *gorm.DB) *gorm.DB {
		return q.Order("product_variants.sort_order ASC, product_variants.id ASC")
	})
}

func (p *ProductController) syncPrimary(productID uint) error {
	var first model.ProductImage
	err := p.DB.Where("product_id = ?", productID).Order("sort_order asc, id asc").First(&first).Error
	if err == gorm.ErrRecordNotFound {
		return p.DB.Model(&model.Product{}).Where("id = ?", productID).Update("image_url", "").Error
	}
	if err != nil {
		return err
	}
	return p.DB.Model(&model.Product{}).Where("id = ?", productID).Update("image_url", first.ImageURL).Error
}

func (p *ProductController) removeAllProductImages(prodID uint) {
	var imgs []model.ProductImage
	p.DB.Where("product_id = ?", prodID).Find(&imgs)
	for _, im := range imgs {
		storage.RemoveProductImage(p.UploadDir, im.ImageURL)
	}
	p.DB.Where("product_id = ?", prodID).Unscoped().Delete(&model.ProductImage{})
	_ = p.DB.Model(&model.Product{}).Where("id = ?", prodID).Update("image_url", "").Error
}

func collectMultipartImageFiles(mf *multipart.Form) []*multipart.FileHeader {
	if mf == nil {
		return nil
	}
	var out []*multipart.FileHeader
	for _, key := range []string{"images", "image"} {
		if fs := mf.File[key]; len(fs) > 0 {
			out = append(out, fs...)
		}
	}
	var valid []*multipart.FileHeader
	for _, f := range out {
		if f != nil && f.Size > 0 {
			valid = append(valid, f)
		}
	}
	return valid
}

func (p *ProductController) AdminList(c *fiber.Ctx) error {
	var list []model.Product
	if err := p.DB.Scopes(scopeProductImages).Preload("Category").Order("id desc").Find(&list).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(list)
}

func (p *ProductController) ListPublic(c *fiber.Ctx) error {
	var list []model.Product
	q := p.DB.Scopes(scopeProductImages).Preload("Category").Order("id desc")
	if cat := c.Query("category_id"); cat != "" {
		q = q.Where("category_id = ?", cat)
	}
	if err := q.Find(&list).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(list)
}

func (p *ProductController) GetOne(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var prod model.Product
	if err := p.DB.Scopes(scopeProductImages).
		Preload("Category").
		Preload("Reviews", func(q *gorm.DB) *gorm.DB {
			return q.Order("product_reviews.created_at DESC")
		}).
		Preload("Reviews.User").
		First(&prod, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "produk tidak ditemukan")
	}
	return c.JSON(prod)
}

// Create hanya menerima multipart + minimal satu file gambar.
func (p *ProductController) Create(c *fiber.Ctx) error {
	ct := strings.ToLower(c.Get("Content-Type"))
	if !strings.HasPrefix(ct, "multipart/form-data") {
		return fiber.NewError(fiber.StatusBadRequest, "gunakan multipart/form-data beserta file gambar produk")
	}
	return p.createMultipart(c)
}

func (p *ProductController) createMultipart(c *fiber.Ctx) error {
	mf, err := c.MultipartForm()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "form multipart tidak valid")
	}
	defer func() { _ = mf.RemoveAll() }()

	name := strings.TrimSpace(firstOrForm(mf, "name", c))
	if name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama wajib")
	}
	price, _ := strconv.ParseInt(firstOrForm(mf, "price", c), 10, 64)
	if price < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "harga tidak valid")
	}
	stock, _ := strconv.Atoi(firstOrForm(mf, "stock", c))
	if stock < 0 {
		stock = 0
	}
	catID, _ := strconv.Atoi(firstOrForm(mf, "category_id", c))
	desc := firstOrForm(mf, "description", c)
	wg, _ := strconv.Atoi(firstOrForm(mf, "weight_gram", c))
	if wg < 1 {
		wg = 500
	}
	variants := parseVariantInputs(firstOrForm(mf, "variants", c))

	files := collectMultipartImageFiles(mf)
	if len(files) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "unggah minimal satu file gambar (field images atau image)")
	}
	if len(files) > maxProductImagesPerUpload {
		return fiber.NewError(fiber.StatusBadRequest, "terlalu banyak file sekaligus (maks "+strconv.Itoa(maxProductImagesPerUpload)+")")
	}
	if len(files) > maxProductImagesPerProduct {
		return fiber.NewError(fiber.StatusBadRequest, "melebihi batas gambar per produk")
	}

	var savedURLs []string
	defer func() {
		for _, u := range savedURLs {
			storage.RemoveProductImage(p.UploadDir, u)
		}
	}()

	for _, f := range files {
		u, err := storage.SaveProductImage(p.UploadDir, f)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		savedURLs = append(savedURLs, u)
	}

	prod := model.Product{
		Name: name, Description: desc, Price: price, Stock: stock, WeightGram: wg,
		ImageURL: "", CategoryID: uint(catID),
	}
	tx := p.DB.Begin()
	if err := tx.Create(&prod).Error; err != nil {
		tx.Rollback()
		return fiber.ErrInternalServerError
	}
	for i, u := range savedURLs {
		row := model.ProductImage{ProductID: prod.ID, ImageURL: u, SortOrder: i}
		if err := tx.Create(&row).Error; err != nil {
			tx.Rollback()
			return fiber.ErrInternalServerError
		}
	}
	if err := replaceProductVariants(tx, prod.ID, variants); err != nil {
		tx.Rollback()
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	if err := p.syncPrimaryWithTx(tx, prod.ID); err != nil {
		tx.Rollback()
		return fiber.ErrInternalServerError
	}
	if err := tx.Commit().Error; err != nil {
		return fiber.ErrInternalServerError
	}
	savedURLs = nil

	_ = p.DB.Scopes(scopeProductImages).Preload("Category").First(&prod, prod.ID)
	return c.Status(fiber.StatusCreated).JSON(prod)
}

func parseVariantInputs(raw string) []variantInput {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var inputs []variantInput
	if err := json.Unmarshal([]byte(raw), &inputs); err != nil {
		return nil
	}
	return inputs
}

func replaceProductVariants(tx *gorm.DB, productID uint, inputs []variantInput) error {
	var variantIDs []uint
	if err := tx.Model(&model.ProductVariant{}).
		Where("product_id = ?", productID).
		Pluck("id", &variantIDs).Error; err != nil {
		return err
	}
	if len(variantIDs) > 0 {
		if err := tx.Model(&model.OrderItem{}).
			Where("product_variant_id IN ?", variantIDs).
			Update("product_variant_id", gorm.Expr("NULL")).Error; err != nil {
			return err
		}
	}
	if err := tx.Where("product_id = ?", productID).Unscoped().Delete(&model.ProductVariant{}).Error; err != nil {
		return err
	}
	for i, in := range inputs {
		name := strings.TrimSpace(in.Name)
		if name == "" {
			continue
		}
		if in.Stock < 0 {
			in.Stock = 0
		}
		if in.Price < 0 {
			in.Price = 0
		}
		if in.WeightGram < 1 {
			in.WeightGram = 500
		}
		row := model.ProductVariant{
			ProductID:  productID,
			Name:       name,
			SKU:        strings.TrimSpace(in.SKU),
			Price:      in.Price,
			PriceDelta: in.PriceDelta,
			Stock:      in.Stock,
			WeightGram: in.WeightGram,
			SortOrder:  i,
		}
		if in.SortOrder > 0 {
			row.SortOrder = in.SortOrder
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func firstOrForm(mf *multipart.Form, key string, c *fiber.Ctx) string {
	if mf != nil {
		if v := mf.Value[key]; len(v) > 0 {
			return v[0]
		}
	}
	return c.FormValue(key)
}

func (p *ProductController) syncPrimaryWithTx(tx *gorm.DB, productID uint) error {
	var first model.ProductImage
	err := tx.Where("product_id = ?", productID).Order("sort_order asc, id asc").First(&first).Error
	if err == gorm.ErrRecordNotFound {
		return tx.Model(&model.Product{}).Where("id = ?", productID).Update("image_url", "").Error
	}
	if err != nil {
		return err
	}
	return tx.Model(&model.Product{}).Where("id = ?", productID).Update("image_url", first.ImageURL).Error
}

func (p *ProductController) Update(c *fiber.Ctx) error {
	ct := strings.ToLower(c.Get("Content-Type"))
	if strings.HasPrefix(ct, "multipart/form-data") {
		return p.updateMultipart(c)
	}
	id, _ := strconv.Atoi(c.Params("id"))
	var prod model.Product
	if err := p.DB.Unscoped().First(&prod, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "produk tidak ditemukan")
	}
	var body productBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if body.Name != "" {
		prod.Name = body.Name
	}
	prod.Description = body.Description
	if body.Price >= 0 {
		prod.Price = body.Price
	}
	prod.Stock = body.Stock
	prod.CategoryID = body.CategoryID
	if body.WeightGram > 0 {
		prod.WeightGram = body.WeightGram
	}
	if body.ClearImage {
		p.removeAllProductImages(prod.ID)
		prod.ImageURL = ""
	}
	tx := p.DB.Begin()
	if err := tx.Save(&prod).Error; err != nil {
		tx.Rollback()
		return fiber.ErrInternalServerError
	}
	if body.Variants != nil {
		if err := replaceProductVariants(tx, prod.ID, body.Variants); err != nil {
			tx.Rollback()
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
	}
	if err := tx.Commit().Error; err != nil {
		return fiber.ErrInternalServerError
	}
	_ = p.syncPrimary(prod.ID)
	_ = p.DB.Scopes(scopeProductImages).Preload("Category").First(&prod, prod.ID)
	return c.JSON(prod)
}

func (p *ProductController) updateMultipart(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var prod model.Product
	if err := p.DB.Unscoped().First(&prod, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "produk tidak ditemukan")
	}

	mf, err := c.MultipartForm()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "form multipart tidak valid")
	}
	defer func() { _ = mf.RemoveAll() }()

	if v := strings.TrimSpace(firstOrForm(mf, "name", c)); v != "" {
		prod.Name = v
	}
	prod.Description = firstOrForm(mf, "description", c)
	if v := firstOrForm(mf, "price", c); v != "" {
		if x, _ := strconv.ParseInt(v, 10, 64); x >= 0 {
			prod.Price = x
		}
	}
	if v := firstOrForm(mf, "stock", c); v != "" {
		if x, _ := strconv.Atoi(v); x >= 0 {
			prod.Stock = x
		}
	}
	cid, _ := strconv.Atoi(firstOrForm(mf, "category_id", c))
	if cid >= 0 {
		prod.CategoryID = uint(cid)
	}
	if v := firstOrForm(mf, "weight_gram", c); v != "" {
		if x, _ := strconv.Atoi(v); x >= 1 {
			prod.WeightGram = x
		}
	}
	variantsRaw := firstOrForm(mf, "variants", c)
	variants := parseVariantInputs(variantsRaw)

	removeAll := firstOrForm(mf, "remove_image", c) == "1" || strings.EqualFold(firstOrForm(mf, "remove_image", c), "true")
	if removeAll {
		p.removeAllProductImages(prod.ID)
	}

	// Hapus per id: remove_image_ids=1,2,3
	if raw := strings.TrimSpace(firstOrForm(mf, "remove_image_ids", c)); raw != "" {
		for _, part := range strings.Split(raw, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			iid, _ := strconv.Atoi(part)
			if iid <= 0 {
				continue
			}
			var img model.ProductImage
			if err := p.DB.Where("id = ? AND product_id = ?", iid, prod.ID).First(&img).Error; err != nil {
				continue
			}
			storage.RemoveProductImage(p.UploadDir, img.ImageURL)
			p.DB.Unscoped().Delete(&img)
		}
	}

	var n int64
	p.DB.Model(&model.ProductImage{}).Where("product_id = ?", prod.ID).Count(&n)

	newFiles := collectMultipartImageFiles(mf)
	if len(newFiles) > maxProductImagesPerUpload {
		return fiber.NewError(fiber.StatusBadRequest, "terlalu banyak file sekaligus (maks "+strconv.Itoa(maxProductImagesPerUpload)+")")
	}
	if int(n)+len(newFiles) > maxProductImagesPerProduct {
		return fiber.NewError(fiber.StatusBadRequest, "total gambar melebihi batas (maks "+strconv.Itoa(maxProductImagesPerProduct)+")")
	}

	startOrder := 0
	var lastImg model.ProductImage
	if err := p.DB.Where("product_id = ?", prod.ID).Order("sort_order DESC").Limit(1).First(&lastImg).Error; err == nil {
		startOrder = lastImg.SortOrder + 1
	}

	var savedURLs []string
	defer func() {
		for _, u := range savedURLs {
			storage.RemoveProductImage(p.UploadDir, u)
		}
	}()

	for _, f := range newFiles {
		u, err := storage.SaveProductImage(p.UploadDir, f)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		savedURLs = append(savedURLs, u)
		row := model.ProductImage{ProductID: prod.ID, ImageURL: u, SortOrder: startOrder}
		startOrder++
		if err := p.DB.Create(&row).Error; err != nil {
			return fiber.ErrInternalServerError
		}
	}
	savedURLs = nil

	if err := p.syncPrimary(prod.ID); err != nil {
		return fiber.ErrInternalServerError
	}
	p.DB.Model(&model.Product{}).Where("id = ?", prod.ID).Select("image_url").Scan(&prod.ImageURL)

	tx := p.DB.Begin()
	if variantsRaw != "" {
		if err := replaceProductVariants(tx, prod.ID, variants); err != nil {
			tx.Rollback()
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
	}
	if err := tx.Save(&prod).Error; err != nil {
		tx.Rollback()
		return fiber.ErrInternalServerError
	}
	if err := tx.Commit().Error; err != nil {
		return fiber.ErrInternalServerError
	}
	_ = p.DB.Scopes(scopeProductImages).Preload("Category").First(&prod, prod.ID)
	return c.JSON(prod)
}

// DeleteProductImage menghapus satu gambar galeri (admin).
func (p *ProductController) DeleteProductImage(c *fiber.Ctx) error {
	pid, _ := strconv.Atoi(c.Params("id"))
	iid, _ := strconv.Atoi(c.Params("imageId"))
	if pid <= 0 || iid <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "id tidak valid")
	}
	var prod model.Product
	if err := p.DB.Unscoped().First(&prod, pid).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "produk tidak ditemukan")
	}
	var img model.ProductImage
	if err := p.DB.Where("id = ? AND product_id = ?", iid, prod.ID).First(&img).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "gambar tidak ditemukan")
	}
	storage.RemoveProductImage(p.UploadDir, img.ImageURL)
	if err := p.DB.Unscoped().Delete(&img).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	_ = p.syncPrimary(uint(pid))
	var out model.Product
	_ = p.DB.Scopes(scopeProductImages).Preload("Category").First(&out, pid)
	return c.JSON(out)
}

func (p *ProductController) Delete(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var prod model.Product
	if err := p.DB.Unscoped().First(&prod, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "produk tidak ditemukan")
	}
	p.removeAllProductImages(prod.ID)
	storage.RemoveProductImage(p.UploadDir, prod.ImageURL)
	if err := p.DB.Delete(&prod).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.SendStatus(fiber.StatusNoContent)
}

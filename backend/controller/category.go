package controller

import (
	"strconv"
	"strings"

	"toko/backend/model"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type CategoryController struct {
	DB *gorm.DB
}

type categoryBody struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	return s
}

func (ct *CategoryController) List(c *fiber.Ctx) error {
	var list []model.Category
	if err := ct.DB.Order("name asc").Find(&list).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(list)
}

func (ct *CategoryController) Create(c *fiber.Ctx) error {
	var body categoryBody
	if err := c.BodyParser(&body); err != nil || body.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama kategori wajib")
	}
	slug := body.Slug
	if slug == "" {
		slug = slugify(body.Name)
	}
	cat := model.Category{Name: body.Name, Slug: slug}
	if err := ct.DB.Create(&cat).Error; err != nil {
		return fiber.NewError(fiber.StatusConflict, "slug sudah dipakai")
	}
	return c.Status(fiber.StatusCreated).JSON(cat)
}

func (ct *CategoryController) Update(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var cat model.Category
	if err := ct.DB.First(&cat, id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "kategori tidak ditemukan")
	}
	var body categoryBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if body.Name != "" {
		cat.Name = body.Name
	}
	if body.Slug != "" {
		cat.Slug = body.Slug
	}
	if err := ct.DB.Save(&cat).Error; err != nil {
		return fiber.NewError(fiber.StatusConflict, "slug sudah dipakai")
	}
	return c.JSON(cat)
}

func (ct *CategoryController) Delete(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	if id < 1 {
		return fiber.NewError(fiber.StatusBadRequest, "id tidak valid")
	}
	// Lepaskan produk dari kategori ini agar penghapusan tidak terblokir
	if err := ct.DB.Model(&model.Product{}).Where("category_id = ?", uint(id)).Update("category_id", 0).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	if err := ct.DB.Delete(&model.Category{}, id).Error; err != nil {
		return fiber.NewError(fiber.StatusConflict, "tidak dapat menghapus kategori")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

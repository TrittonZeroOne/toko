package controller

import (
	"strings"

	"toko/backend/model"
	"toko/backend/service"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ShippingController struct {
	DB *gorm.DB
}

type estimateItem struct {
	ProductID uint `json:"product_id"`
	VariantID uint `json:"variant_id"`
	Qty       int  `json:"qty"`
}

type estimateBody struct {
	Items           []estimateItem `json:"items"`
	DestinationSlug string         `json:"destination_slug"` // slug kota tujuan (Binderbyte), dari nama kab/kota
	Courier         string         `json:"courier"`
}

func (s *ShippingController) adminOriginSlug() (string, error) {
	var admin model.User
	if err := s.DB.Where("role = ?", "admin").Order("id asc").First(&admin).Error; err != nil {
		if origin := service.BinderbyteOriginSlug(); origin != "" {
			return origin, nil
		}
		return "", fiber.NewError(fiber.StatusServiceUnavailable, "alamat admin belum tersedia untuk origin ongkir, atau isi BINDERBYTE_ORIGIN")
	}
	origin := service.ShippingOriginSlug(admin.SubdistrictName, admin.DistrictName, admin.CityName)
	if origin == "" {
		if envOrigin := service.BinderbyteOriginSlug(); envOrigin != "" {
			return envOrigin, nil
		}
		return "", fiber.NewError(fiber.StatusServiceUnavailable, "lengkapi alamat admin: kab/kota dan kecamatan/kelurahan, atau isi BINDERBYTE_ORIGIN")
	}
	return origin, nil
}

func (s *ShippingController) Config(c *fiber.Ctx) error {
	origin, _ := s.adminOriginSlug()
	return c.JSON(fiber.Map{
		"provider":       "binderbyte",
		"api_configured": service.BinderbyteAPIKey() != "",
		"origin_slug":    origin,
	})
}

func (s *ShippingController) Provinces(c *fiber.Ctx) error {
	if service.BinderbyteAPIKey() == "" {
		return fiber.NewError(fiber.StatusServiceUnavailable, "Binderbyte belum dikonfigurasi (BINDERBYTE_API_KEY)")
	}
	list, err := service.BinderbyteProvinces()
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, err.Error())
	}
	return c.JSON(list)
}

func (s *ShippingController) Cities(c *fiber.Ctx) error {
	if service.BinderbyteAPIKey() == "" {
		return fiber.NewError(fiber.StatusServiceUnavailable, "Binderbyte belum dikonfigurasi")
	}
	pid := c.Query("province_id")
	if pid == "" {
		return fiber.NewError(fiber.StatusBadRequest, "province_id wajib")
	}
	list, err := service.BinderbyteCities(pid)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, err.Error())
	}
	return c.JSON(list)
}

func (s *ShippingController) Districts(c *fiber.Ctx) error {
	if service.BinderbyteAPIKey() == "" {
		return fiber.NewError(fiber.StatusServiceUnavailable, "Binderbyte belum dikonfigurasi")
	}
	cid := c.Query("city_id")
	if cid == "" {
		return fiber.NewError(fiber.StatusBadRequest, "city_id wajib")
	}
	list, err := service.BinderbyteDistricts(cid)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, err.Error())
	}
	return c.JSON(list)
}

func (s *ShippingController) Subdistricts(c *fiber.Ctx) error {
	if service.BinderbyteAPIKey() == "" {
		return fiber.NewError(fiber.StatusServiceUnavailable, "Binderbyte belum dikonfigurasi")
	}
	did := c.Query("district_id")
	if did == "" {
		return fiber.NewError(fiber.StatusBadRequest, "district_id wajib")
	}
	list, err := service.BinderbyteSubdistricts(did)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, err.Error())
	}
	return c.JSON(list)
}

type shippingCostBody struct {
	DestinationSlug string `json:"destination_slug"`
	Weight          int    `json:"weight"`
	Courier         string `json:"courier"`
}

func (s *ShippingController) Cost(c *fiber.Ctx) error {
	if service.BinderbyteAPIKey() == "" {
		return fiber.NewError(fiber.StatusServiceUnavailable, "Binderbyte belum dikonfigurasi")
	}
	var body shippingCostBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	slug := strings.TrimSpace(body.DestinationSlug)
	if slug == "" {
		return fiber.NewError(fiber.StatusBadRequest, "destination_slug wajib")
	}
	origin, err := s.adminOriginSlug()
	if err != nil {
		return err
	}
	list, err := service.GetShippingCost(origin, slug, body.Weight, body.Courier)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, err.Error())
	}
	return c.JSON(fiber.Map{
		"quotes":      list,
		"origin_slug": origin,
		"provider":    "binderbyte",
	})
}

func (s *ShippingController) Estimate(c *fiber.Ctx) error {
	if service.BinderbyteAPIKey() == "" {
		return fiber.NewError(fiber.StatusServiceUnavailable, "Binderbyte belum dikonfigurasi")
	}
	var body estimateBody
	if err := c.BodyParser(&body); err != nil || len(body.Items) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "items wajib")
	}
	slug := strings.TrimSpace(body.DestinationSlug)
	if slug == "" {
		return fiber.NewError(fiber.StatusBadRequest, "destination_slug wajib (slug kota dari Binderbyte)")
	}
	weight := 0
	for _, it := range body.Items {
		if it.Qty < 1 {
			continue
		}
		var p model.Product
		if err := s.DB.Select("id", "weight_gram").First(&p, it.ProductID).Error; err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "produk tidak ditemukan")
		}
		wg := p.WeightGram
		if it.VariantID > 0 {
			var v model.ProductVariant
			if err := s.DB.Select("id", "product_id", "weight_gram").Where("id = ? AND product_id = ?", it.VariantID, p.ID).First(&v).Error; err != nil {
				return fiber.NewError(fiber.StatusBadRequest, "varian produk tidak ditemukan")
			}
			wg = v.WeightGram
		}
		if wg < 1 {
			wg = 500
		}
		weight += wg * it.Qty
	}
	if weight < 1 {
		weight = 100
	}
	courier := body.Courier
	if courier == "" {
		courier = "jne"
	}
	origin, err := s.adminOriginSlug()
	if err != nil {
		return err
	}
	list, err := service.GetShippingCost(origin, slug, weight, courier)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, err.Error())
	}
	return c.JSON(fiber.Map{
		"weight_gram": weight,
		"quotes":      list,
		"origin_slug": origin,
		"provider":    "binderbyte",
	})
}

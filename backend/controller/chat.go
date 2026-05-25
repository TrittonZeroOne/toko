package controller

import (
	"strconv"
	"strings"

	"toko/backend/model"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ChatController struct {
	DB *gorm.DB
}

type chatBody struct {
	Message   string `json:"message"`
	UserID    uint   `json:"user_id"`
	OrderID   uint   `json:"order_id"`
	ProductID uint   `json:"product_id"`
}

func (cc *ChatController) findOrderForChat(c *fiber.Ctx, admin bool) (model.Order, error) {
	id, _ := strconv.Atoi(c.Params("id"))
	var ord model.Order
	if err := cc.DB.Preload("User").Preload("Items.Product").Preload("Items.ProductVariant").First(&ord, id).Error; err != nil {
		return ord, fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
	}
	if !admin {
		uid := c.Locals("user_id").(uint)
		if ord.UserID != uid {
			return ord, fiber.ErrForbidden
		}
	}
	return ord, nil
}

func (cc *ChatController) listMessagesByOrder(orderID uint) ([]model.ChatMessage, error) {
	var list []model.ChatMessage
	err := cc.DB.Preload("Sender").Preload("Product.Images").
		Where("order_id = ?", orderID).
		Order("id asc").
		Find(&list).Error
	return list, err
}

func (cc *ChatController) listCustomerMessages(uid uint) ([]model.ChatMessage, error) {
	var list []model.ChatMessage
	err := cc.DB.Preload("Sender").Preload("User").Preload("Product.Images").Preload("Order.Items.Product.Images").Preload("Order.Items.ProductVariant").
		Where("user_id = ?", uid).
		Order("id asc").
		Find(&list).Error
	return list, err
}

func (cc *ChatController) listAllMessages() ([]model.ChatMessage, error) {
	var list []model.ChatMessage
	err := cc.DB.Preload("Sender").Preload("User").Preload("Product.Images").Preload("Order.Items.Product.Images").Preload("Order.Items.ProductVariant").
		Order("id asc").
		Find(&list).Error
	return list, err
}

func (cc *ChatController) CustomerList(c *fiber.Ctx) error {
	ord, err := cc.findOrderForChat(c, false)
	if err != nil {
		return err
	}
	list, err := cc.listMessagesByOrder(ord.ID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"order": orderResponse(ord, nil), "messages": list})
}

func (cc *ChatController) CustomerSend(c *fiber.Ctx) error {
	ord, err := cc.findOrderForChat(c, false)
	if err != nil {
		return err
	}
	return cc.createOrderMessage(c, ord, "customer")
}

func (cc *ChatController) AdminList(c *fiber.Ctx) error {
	ord, err := cc.findOrderForChat(c, true)
	if err != nil {
		return err
	}
	list, err := cc.listMessagesByOrder(ord.ID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"order": orderResponse(ord, nil), "messages": list})
}

func (cc *ChatController) AdminSend(c *fiber.Ctx) error {
	ord, err := cc.findOrderForChat(c, true)
	if err != nil {
		return err
	}
	return cc.createOrderMessage(c, ord, "admin")
}

func (cc *ChatController) CustomerInbox(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	list, err := cc.listCustomerMessages(uid)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(list)
}

func (cc *ChatController) CustomerSendGeneral(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(uint)
	var body chatBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	var orderID *uint
	if body.OrderID > 0 {
		var ord model.Order
		if err := cc.DB.First(&ord, body.OrderID).Error; err != nil {
			return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
		}
		if ord.UserID != uid {
			return fiber.ErrForbidden
		}
		orderID = &ord.ID
	}
	var productID *uint
	if body.ProductID > 0 {
		var p model.Product
		if err := cc.DB.First(&p, body.ProductID).Error; err != nil {
			return fiber.NewError(fiber.StatusNotFound, "produk tidak ditemukan")
		}
		productID = &p.ID
	}
	return cc.createMessage(c, uid, orderID, productID, "customer", body.Message)
}

func (cc *ChatController) AdminInbox(c *fiber.Ctx) error {
	list, err := cc.listAllMessages()
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(list)
}

func (cc *ChatController) AdminSendGeneral(c *fiber.Ctx) error {
	var body chatBody
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if body.UserID == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "customer wajib dipilih")
	}
	var customer model.User
	if err := cc.DB.Where("id = ? AND role = ?", body.UserID, "customer").First(&customer).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "customer tidak ditemukan")
	}
	var orderID *uint
	if body.OrderID > 0 {
		var ord model.Order
		if err := cc.DB.First(&ord, body.OrderID).Error; err != nil {
			return fiber.NewError(fiber.StatusNotFound, "order tidak ditemukan")
		}
		if ord.UserID != customer.ID {
			return fiber.NewError(fiber.StatusBadRequest, "order bukan milik customer")
		}
		orderID = &ord.ID
	}
	var productID *uint
	if body.ProductID > 0 {
		var p model.Product
		if err := cc.DB.First(&p, body.ProductID).Error; err != nil {
			return fiber.NewError(fiber.StatusNotFound, "produk tidak ditemukan")
		}
		productID = &p.ID
	}
	return cc.createMessage(c, customer.ID, orderID, productID, "admin", body.Message)
}

func (cc *ChatController) createOrderMessage(c *fiber.Ctx, ord model.Order, senderRole string) error {
	return cc.createMessage(c, ord.UserID, &ord.ID, nil, senderRole, "")
}

func (cc *ChatController) createMessage(c *fiber.Ctx, customerID uint, orderID *uint, productID *uint, senderRole string, presetMessage string) error {
	uid := c.Locals("user_id").(uint)
	var body chatBody
	if presetMessage == "" {
		if err := c.BodyParser(&body); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
		}
	} else {
		body.Message = presetMessage
	}
	msg := strings.TrimSpace(body.Message)
	if msg == "" {
		return fiber.NewError(fiber.StatusBadRequest, "pesan wajib diisi")
	}
	if len(msg) > 2000 {
		return fiber.NewError(fiber.StatusBadRequest, "pesan maksimal 2000 karakter")
	}
	row := model.ChatMessage{
		OrderID:    orderID,
		ProductID:  productID,
		UserID:     customerID,
		SenderID:   uid,
		SenderRole: senderRole,
		Message:    msg,
	}
	if err := cc.DB.Create(&row).Error; err != nil {
		return fiber.ErrInternalServerError
	}
	_ = cc.DB.Preload("Sender").Preload("User").Preload("Product.Images").Preload("Order.Items.Product.Images").Preload("Order.Items.ProductVariant").First(&row, row.ID)
	return c.JSON(row)
}

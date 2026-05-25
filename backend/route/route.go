package route

import (
	"toko/backend/controller"
	"toko/backend/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func Mount(app *fiber.App, db *gorm.DB, uploadDir string) {
	auth := &controller.AuthController{DB: db}
	pc := &controller.ProductController{DB: db, UploadDir: uploadDir}
	cc := &controller.CategoryController{DB: db}
	oc := &controller.OrderController{DB: db}
	ch := &controller.ChatController{DB: db}
	sh := &controller.ShippingController{DB: db}

	api := app.Group("/api")
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "name": "toko-backend"})
	})
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})

	api.Post("/register", auth.Register)
	api.Post("/login", auth.Login)
	api.Post("/resend-verification", auth.ResendVerification)
	api.Post("/verify-email", auth.VerifyEmail)
	api.Post("/forgot-password", auth.ForgotPassword)
	api.Post("/reset-password", auth.ResetPassword)

	api.Get("/shipping/config", sh.Config)
	api.Get("/shipping/provinces", sh.Provinces)
	api.Get("/shipping/cities", sh.Cities)
	api.Get("/shipping/districts", sh.Districts)
	api.Get("/shipping/subdistricts", sh.Subdistricts)

	api.Get("/products", pc.ListPublic)
	api.Get("/product", pc.ListPublic) // alias singular untuk cek cepat / typo umum
	api.Get("/products/:id", pc.GetOne)
	api.Get("/categories", cc.List)

	api.Post("/midtrans-webhook", oc.MidtransWebhook)

	jwt := middleware.JWTMiddleware()
	api.Get("/me", jwt, auth.Me)
	api.Put("/profile", jwt, auth.UpdateProfile)
	api.Put("/profile/password", jwt, auth.UpdatePassword)
	api.Post("/shipping/cost", jwt, sh.Cost)
	api.Post("/shipping/estimate", jwt, sh.Estimate)
	api.Post("/checkout", jwt, oc.Checkout)
	api.Post("/create-transaction", jwt, oc.CreateTransaction)
	api.Get("/chat", jwt, ch.CustomerInbox)
	api.Post("/chat", jwt, ch.CustomerSendGeneral)
	api.Get("/orders", jwt, oc.MyOrders)
	api.Get("/orders/:id", jwt, oc.GetOrder)
	api.Get("/orders/:id/messages", jwt, ch.CustomerList)
	api.Post("/orders/:id/messages", jwt, ch.CustomerSend)
	api.Post("/orders/:id/cancel", jwt, oc.CancelOrder)
	api.Post("/orders/:id/reviews", jwt, oc.CreateReview)

	admin := api.Group("/admin", jwt, middleware.RequireRole("admin"))
	admin.Get("/products", pc.AdminList)
	admin.Post("/products", pc.Create)
	admin.Put("/products/:id", pc.Update)
	admin.Delete("/products/:id/images/:imageId", pc.DeleteProductImage)
	admin.Delete("/products/:id", pc.Delete)
	admin.Post("/categories", cc.Create)
	admin.Put("/categories/:id", cc.Update)
	admin.Delete("/categories/:id", cc.Delete)
	admin.Get("/chats", ch.AdminInbox)
	admin.Post("/chats", ch.AdminSendGeneral)
	admin.Get("/orders", oc.AdminListOrders)
	admin.Get("/orders/:id", oc.AdminGetOrder)
	admin.Get("/orders/:id/messages", ch.AdminList)
	admin.Post("/orders/:id/messages", ch.AdminSend)
	admin.Get("/sales/summary", oc.AdminSalesSummary)
	admin.Put("/orders/:id/status", oc.AdminUpdateStatus)
}

package main

import (
	"divotiq/middleware"
	"divotiq/routes"

	"github.com/gofiber/fiber/v3"
)

func registerRoutes(app *fiber.App) {
	app.Get("/health", func(c fiber.Ctx) error { return c.JSON(fiber.Map{"ok": true}) })

	app.Post("/register", middleware.RateLimit(5), routes.Register)
	app.Post("/login", middleware.RateLimit(10), routes.Login)
	app.Post("/logout", routes.Logout)

	me := app.Group("/me", middleware.Auth)
	me.Get("", routes.Me)
	me.Patch("", routes.UpdateProfile)
	me.Put("/password", middleware.RateLimit(10), routes.UpdatePassword)
	me.Delete("", middleware.RateLimit(5), routes.DeleteAccount)

	// Public community library.
	app.Get("/library/content", middleware.RateLimit(120), routes.ListPublicContent)
	app.Get("/library/configs", middleware.RateLimit(120), routes.ListPublicConfigs)

	content := app.Group("/content", middleware.Auth)
	content.Get("", routes.ListMyContent)
	content.Get("/favorites", routes.ListFavoriteContent)
	content.Post("", middleware.RateLimit(60), routes.CreateContent)
	content.Put("/:id", middleware.RateLimit(120), routes.UpdateContent)
	content.Delete("/:id", routes.DeleteContent)
	content.Post("/:id/copy", middleware.RateLimit(60), routes.CopyContent)
	content.Post("/:id/favorite", middleware.RateLimit(120), routes.ToggleFavorite)
	content.Post("/:id/report", middleware.RateLimit(10), routes.ReportContent)

	app.Get("/configs/:id", routes.GetConfig)
	configs := app.Group("/configs", middleware.Auth)
	configs.Get("", routes.ListMyConfigs)
	configs.Post("", middleware.RateLimit(30), routes.CreateConfig)
	configs.Put("/:id", routes.UpdateConfig)
	configs.Delete("/:id", routes.DeleteConfig)
	configs.Post("/:id/duplicate", middleware.RateLimit(30), routes.DuplicateConfig)

	modes := app.Group("/modes", middleware.Auth)
	modes.Get("", routes.ListModes)
	modes.Post("", middleware.RateLimit(20), routes.CreateMode)
	modes.Put("/:id", routes.UpdateMode)
	modes.Delete("/:id", routes.DeleteMode)

	players := app.Group("/player-lists", middleware.Auth)
	players.Get("", routes.ListPlayerLists)
	players.Post("", middleware.RateLimit(20), routes.CreatePlayerList)
	players.Delete("/:id", routes.DeletePlayerList)

	sessions := app.Group("/sessions", middleware.Auth)
	sessions.Get("", routes.ListSessions)
	sessions.Post("", middleware.RateLimit(30), routes.CreateSession)
	sessions.Get("/:id", routes.GetSession)
	sessions.Put("/:id", middleware.RateLimit(600), routes.SyncSession)
	sessions.Get("/:id/events", routes.ListSessionEvents)
	sessions.Delete("/:id", routes.DeleteSession)

	admin := app.Group("/admin", middleware.Auth, middleware.RequireAdmin)
	admin.Get("/reported", routes.AdminListReported)
	admin.Patch("/content/:id", routes.AdminModerateContent)
}

package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	db "divotiq/database"
	"divotiq/middleware"
	"divotiq/services"
	"divotiq/utils"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	recoverer "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")
	_ = utils.JWTSecret()

	db.Init()
	if db.Client == nil {
		log.Fatal("database client failed to initialize")
	}
	services.Seed(context.Background())

	app := fiber.New(fiber.Config{
		BodyLimit:    2 * 1024 * 1024,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		// Behind nginx on the same host: trust X-Forwarded-For from loopback only.
		ProxyHeader:      fiber.HeaderXForwardedFor,
		TrustProxy:       true,
		TrustProxyConfig: fiber.TrustProxyConfig{Loopback: true},
		ErrorHandler: func(c fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			msg := "Възникна грешка. Опитайте отново."
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
				msg = e.Message
			}
			return c.Status(code).JSON(fiber.Map{"error": msg})
		},
	})

	app.Use(recoverer.New())
	app.Use(requestid.New())
	app.Use(helmet.New())
	app.Use(compress.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			os.Getenv("VITE_SITE_URL"),
			"http://localhost:5190",
			"http://127.0.0.1:5190",
		},
		AllowCredentials: true,
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
	}))
	app.Use(middleware.OptionalAuth)

	registerRoutes(app)

	port := os.Getenv("VITE_API_PORT")
	if port == "" {
		port = "3095"
	}
	utils.Info("API listening on :" + port)
	log.Fatal(app.Listen(fmt.Sprintf("127.0.0.1:%s", port)))
}

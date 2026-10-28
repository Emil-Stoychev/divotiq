package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestRateLimitCountersAreIndependent(t *testing.T) {
	app := fiber.New()
	ok := func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) }
	app.Get("/busy", RateLimit(100), ok)
	app.Get("/strict", RateLimit(2), ok)

	status := func(path string) int {
		res, err := app.Test(httptest.NewRequest("GET", path, nil))
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode
	}
	for i := 0; i < 10; i++ {
		status("/busy")
	}
	if got := status("/strict"); got != fiber.StatusOK {
		t.Fatalf("strict endpoint limited by busy one: %d", got)
	}
	status("/strict")
	if got := status("/strict"); got != fiber.StatusTooManyRequests {
		t.Fatalf("expected 429 after the limit, got %d", got)
	}
}

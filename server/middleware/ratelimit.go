package middleware

import (
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
)

type visitor struct {
	count int
	reset time.Time
}

const rateEvery = time.Minute

// RateLimit limits requests per IP (max per window). Every call creates its
// own counter, so a busy endpoint (session sync) never uses up the budget of a
// strict one (login, register).
func RateLimit(max int) fiber.Handler {
	var mu sync.Mutex
	visitors := map[string]*visitor{}
	return func(c fiber.Ctx) error {
		ip := c.IP()
		now := time.Now()
		mu.Lock()
		if len(visitors) > 10000 {
			for key, v := range visitors {
				if now.After(v.reset) {
					delete(visitors, key)
				}
			}
		}
		v, ok := visitors[ip]
		if !ok || now.After(v.reset) {
			visitors[ip] = &visitor{count: 1, reset: now.Add(rateEvery)}
			mu.Unlock()
			return c.Next()
		}
		if v.count >= max {
			mu.Unlock()
			return fiber.NewError(fiber.StatusTooManyRequests, "Твърде много заявки. Опитайте пак след малко.")
		}
		v.count++
		mu.Unlock()
		return c.Next()
	}
}

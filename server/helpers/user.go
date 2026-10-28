package helpers

import (
	"divotiq/database/gen"
	"divotiq/database/gen/user"

	"github.com/gofiber/fiber/v3"
)

func CanAuthenticate(u *gen.User) bool {
	return u != nil && u.Status == user.StatusActive
}

func IsAdmin(u *gen.User) bool {
	return u != nil && u.Role == user.RoleAdmin
}

// CurrentUser returns the authenticated user set by the auth middleware, or nil.
func CurrentUser(c fiber.Ctx) *gen.User {
	u, _ := c.Locals("user").(*gen.User)
	return u
}

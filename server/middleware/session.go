package middleware

import (
	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/helpers"
	"divotiq/utils"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// userFromCookie resolves the session cookie into an active user (or nil).
func userFromCookie(c fiber.Ctx) *gen.User {
	cookie := c.Cookies(utils.AuthCookieName)
	if cookie == "" {
		return nil
	}
	token, err := jwt.Parse(cookie, func(t *jwt.Token) (any, error) {
		return utils.JWTSecret(), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || token == nil || !token.Valid {
		return nil
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil
	}
	userID, _ := claims["userID"].(string)
	if userID == "" {
		return nil
	}
	u, err := db.Client.User.Get(c.Context(), userID)
	if err != nil || !helpers.CanAuthenticate(u) {
		return nil
	}
	return u
}

// OptionalAuth attaches the user when a valid session cookie is present.
func OptionalAuth(c fiber.Ctx) error {
	if u := userFromCookie(c); u != nil {
		c.Locals("user", u)
	}
	return c.Next()
}

// Auth rejects requests without a valid session.
func Auth(c fiber.Ctx) error {
	if helpers.CurrentUser(c) == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Нужно е да влезете в профила си")
	}
	return c.Next()
}

// RequireAdmin allows only admin users.
func RequireAdmin(c fiber.Ctx) error {
	if !helpers.IsAdmin(helpers.CurrentUser(c)) {
		return fiber.NewError(fiber.StatusForbidden, "Нямате достъп")
	}
	return c.Next()
}

package routes

import (
	"errors"
	"strconv"

	"divotiq/database/gen"
	"divotiq/utils"

	"github.com/gofiber/fiber/v3"
)

// badRequest converts validation errors into 422 responses with a BG message.
func badRequest(err error) error {
	var v *utils.ValidationError
	if errors.As(err, &v) {
		return fiber.NewError(fiber.StatusUnprocessableEntity, v.Message)
	}
	return fiber.NewError(fiber.StatusBadRequest, "Невалидни данни")
}

func bindJSON(c fiber.Ctx, out any) error {
	if err := c.Bind().JSON(out); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Невалидни данни")
	}
	return nil
}

// notFoundOr500 maps Ent not-found errors to 404 and logs everything else.
func notFoundOr500(c fiber.Ctx, err error, msg string) error {
	if gen.IsNotFound(err) {
		return fiber.NewError(fiber.StatusNotFound, "Не е намерено")
	}
	return c.Status(fiber.StatusInternalServerError).JSON(utils.ErrorResponse(c, err, msg))
}

func serverError(c fiber.Ctx, err error, msg string) error {
	return c.Status(fiber.StatusInternalServerError).JSON(utils.ErrorResponse(c, err, msg))
}

func pagination(c fiber.Ctx, defaultLimit, maxLimit int) (int, int) {
	limit, _ := strconv.Atoi(c.Query("limit", strconv.Itoa(defaultLimit)))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if limit < 1 || limit > maxLimit {
		limit = defaultLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

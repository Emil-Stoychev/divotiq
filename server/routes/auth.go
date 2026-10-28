package routes

import (
	"strings"
	"time"

	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/database/gen/user"
	"divotiq/helpers"
	"divotiq/utils"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	sessionDuration   = 30 * 24 * time.Hour
	minPasswordLength = 8
	maxPasswordBytes  = 72 // bcrypt limit
)

var avatarWhitelist = map[string]bool{}

func init() {
	for _, a := range utils.Avatars {
		avatarWhitelist[a] = true
	}
}

type registerBody struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func validatePassword(pw string) error {
	if len(pw) < minPasswordLength {
		return utils.Invalid("Паролата трябва да е поне 8 символа")
	}
	if len(pw) > maxPasswordBytes {
		return utils.Invalid("Паролата е твърде дълга")
	}
	return nil
}

func validateName(name string) (string, error) {
	name = utils.CleanText(name, 60)
	if utils.RuneLen(name) < 2 || utils.RuneLen(name) > 40 {
		return "", utils.Invalid("Името трябва да е между 2 и 40 символа")
	}
	return name, nil
}

func Register(c fiber.Ctx) error {
	var body registerBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	name, err := validateName(body.Name)
	if err != nil {
		return badRequest(err)
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if !utils.ValidEmail(email) {
		return badRequest(utils.Invalid("Невалиден имейл адрес"))
	}
	if err := validatePassword(body.Password); err != nil {
		return badRequest(err)
	}
	if exists, _ := db.Client.User.Query().Where(user.EmailEQ(email)).Exist(c.Context()); exists {
		return fiber.NewError(fiber.StatusConflict, "Вече има профил с този имейл")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		return serverError(c, err, "Неуспешна регистрация")
	}
	u, err := db.Client.User.Create().
		SetEmail(email).
		SetName(name).
		SetPassword(string(hash)).
		SetAvatar(utils.Avatars[0]).
		Save(c.Context())
	if err != nil {
		if gen.IsConstraintError(err) {
			return fiber.NewError(fiber.StatusConflict, "Вече има профил с този имейл")
		}
		return serverError(c, err, "Неуспешна регистрация")
	}
	if err := issueSession(c, u.ID); err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(publicUser(u))
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(c fiber.Ctx) error {
	var body loginBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || body.Password == "" {
		return badRequest(utils.Invalid("Въведете имейл и парола"))
	}
	u, err := db.Client.User.Query().Where(user.EmailEQ(email)).Only(c.Context())
	if err != nil || bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(body.Password)) != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Грешен имейл или парола")
	}
	if !helpers.CanAuthenticate(u) {
		return fiber.NewError(fiber.StatusForbidden, "Профилът е деактивиран")
	}
	if err := issueSession(c, u.ID); err != nil {
		return err
	}
	return c.JSON(publicUser(u))
}

func Logout(c fiber.Ctx) error {
	clearSession(c)
	return c.SendStatus(fiber.StatusNoContent)
}

func Me(c fiber.Ctx) error {
	return c.JSON(publicUser(helpers.CurrentUser(c)))
}

type updateProfileBody struct {
	Name        *string        `json:"name"`
	Avatar      *string        `json:"avatar"`
	Preferences map[string]any `json:"preferences"`
}

func UpdateProfile(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body updateProfileBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	upd := db.Client.User.UpdateOneID(u.ID)
	if body.Name != nil {
		name, err := validateName(*body.Name)
		if err != nil {
			return badRequest(err)
		}
		upd.SetName(name)
	}
	if body.Avatar != nil {
		if !avatarWhitelist[*body.Avatar] {
			return badRequest(utils.Invalid("Невалиден аватар"))
		}
		upd.SetAvatar(*body.Avatar)
	}
	if body.Preferences != nil {
		prefs := map[string]any{}
		for _, key := range []string{"sound", "reducedMotion", "effects"} {
			if v, ok := body.Preferences[key].(bool); ok {
				prefs[key] = v
			}
		}
		upd.SetPreferences(prefs)
	}
	updated, err := upd.Save(c.Context())
	if err != nil {
		return serverError(c, err, "Профилът не беше запазен")
	}
	return c.JSON(publicUser(updated))
}

type passwordBody struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func UpdatePassword(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body passwordBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(body.CurrentPassword)) != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Текущата парола е грешна")
	}
	if err := validatePassword(body.NewPassword); err != nil {
		return badRequest(err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return serverError(c, err, "Паролата не беше сменена")
	}
	if _, err := db.Client.User.UpdateOneID(u.ID).SetPassword(string(hash)).Save(c.Context()); err != nil {
		return serverError(c, err, "Паролата не беше сменена")
	}
	return c.JSON(fiber.Map{"message": "Паролата е сменена"})
}

type deleteAccountBody struct {
	Password string `json:"password"`
}

// DeleteAccount permanently removes the user and everything they own.
func DeleteAccount(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body deleteAccountBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(body.Password)) != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Грешна парола")
	}
	if err := deleteUserData(c, u.ID); err != nil {
		return serverError(c, err, "Профилът не беше изтрит")
	}
	clearSession(c)
	return c.SendStatus(fiber.StatusNoContent)
}

func publicUser(u *gen.User) fiber.Map {
	prefs := u.Preferences
	if prefs == nil {
		prefs = map[string]any{}
	}
	return fiber.Map{
		"id":          u.ID,
		"email":       u.Email,
		"name":        u.Name,
		"avatar":      u.Avatar,
		"role":        u.Role,
		"preferences": prefs,
		"createdAt":   u.CreatedAt,
	}
}

func issueSession(c fiber.Ctx, userID string) error {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userID": userID,
		"exp":    time.Now().Add(sessionDuration).Unix(),
	})
	signed, err := token.SignedString(utils.JWTSecret())
	if err != nil {
		return serverError(c, err, "Неуспешно влизане")
	}
	c.Cookie(&fiber.Cookie{
		Name:     utils.AuthCookieName,
		Value:    signed,
		HTTPOnly: true,
		Secure:   utils.IsProduction(),
		SameSite: "Lax",
		MaxAge:   int(sessionDuration.Seconds()),
		Path:     "/",
	})
	return nil
}

func clearSession(c fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     utils.AuthCookieName,
		Value:    "",
		HTTPOnly: true,
		Secure:   utils.IsProduction(),
		SameSite: "Lax",
		MaxAge:   -1,
		Path:     "/",
	})
}

package routes

import (
	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/database/gen/gamemode"
	"divotiq/helpers"
	"divotiq/services"
	"divotiq/utils"

	"github.com/gofiber/fiber/v3"
)

type modeBody struct {
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	Theme           string         `json:"theme"`
	Icon            string         `json:"icon"`
	DefaultModules  []string       `json:"defaultModules"`
	DefaultSettings map[string]any `json:"defaultSettings"`
}

func validateModeBody(body *modeBody) error {
	body.Name = utils.CleanText(body.Name, 60)
	if utils.RuneLen(body.Name) < 2 {
		return utils.Invalid("Името на режима трябва да е поне 2 символа")
	}
	body.Description = utils.CleanText(body.Description, 300)
	if !services.IsKnownTheme(body.Theme) {
		return utils.Invalid("Невалидна тема")
	}
	body.Icon = utils.CleanText(body.Icon, 8)
	if body.Icon == "" {
		body.Icon = "✨"
	}
	modules := []string{}
	for _, id := range body.DefaultModules {
		if !contains(services.KnownModules, id) {
			return utils.Invalid("Непознат модул: " + id)
		}
		modules = append(modules, id)
	}
	body.DefaultModules = modules
	if body.DefaultSettings == nil {
		body.DefaultSettings = map[string]any{}
	}
	return services.ValidateSettings(body.DefaultSettings)
}

func contains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}

func modeDTO(m *gen.GameMode) fiber.Map {
	return fiber.Map{
		"id":              m.ID,
		"key":             "custom:" + m.ID,
		"name":            m.Name,
		"description":     m.Description,
		"theme":           m.Theme,
		"icon":            m.Icon,
		"defaultModules":  utils.Tnry(m.DefaultModules == nil, []string{}, m.DefaultModules),
		"defaultSettings": utils.Tnry(m.DefaultSettings == nil, map[string]any{}, m.DefaultSettings),
		"updatedAt":       m.UpdatedAt,
	}
}

func ListModes(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	items, err := db.Client.GameMode.Query().
		Where(gamemode.OwnerIDEQ(u.ID)).
		Order(gen.Desc(gamemode.FieldUpdatedAt)).
		Limit(100).
		All(c.Context())
	if err != nil {
		return serverError(c, err, "Режимите не бяха заредени")
	}
	out := make([]fiber.Map, len(items))
	for i, m := range items {
		out[i] = modeDTO(m)
	}
	return c.JSON(fiber.Map{"items": out})
}

func CreateMode(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body modeBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	if err := validateModeBody(&body); err != nil {
		return badRequest(err)
	}
	count, _ := db.Client.GameMode.Query().Where(gamemode.OwnerIDEQ(u.ID)).Count(c.Context())
	if count >= 50 {
		return fiber.NewError(fiber.StatusTooManyRequests, "Достигнахте лимита от 50 режима")
	}
	m, err := db.Client.GameMode.Create().
		SetOwnerID(u.ID).
		SetName(body.Name).
		SetDescription(body.Description).
		SetTheme(body.Theme).
		SetIcon(body.Icon).
		SetDefaultModules(body.DefaultModules).
		SetDefaultSettings(body.DefaultSettings).
		Save(c.Context())
	if err != nil {
		return serverError(c, err, "Режимът не беше създаден")
	}
	return c.Status(fiber.StatusCreated).JSON(modeDTO(m))
}

func ownedMode(c fiber.Ctx) (*gen.GameMode, error) {
	u := helpers.CurrentUser(c)
	m, err := db.Client.GameMode.Query().
		Where(gamemode.IDEQ(c.Params("id")), gamemode.OwnerIDEQ(u.ID)).
		Only(c.Context())
	if err != nil {
		return nil, notFoundOr500(c, err, "Режимът не беше зареден")
	}
	return m, nil
}

func UpdateMode(c fiber.Ctx) error {
	m, err := ownedMode(c)
	if err != nil {
		return err
	}
	var body modeBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	if err := validateModeBody(&body); err != nil {
		return badRequest(err)
	}
	updated, err := m.Update().
		SetName(body.Name).
		SetDescription(body.Description).
		SetTheme(body.Theme).
		SetIcon(body.Icon).
		SetDefaultModules(body.DefaultModules).
		SetDefaultSettings(body.DefaultSettings).
		Save(c.Context())
	if err != nil {
		return serverError(c, err, "Промените не бяха запазени")
	}
	return c.JSON(modeDTO(updated))
}

func DeleteMode(c fiber.Ctx) error {
	m, err := ownedMode(c)
	if err != nil {
		return err
	}
	if err := db.Client.GameMode.DeleteOne(m).Exec(c.Context()); err != nil {
		return serverError(c, err, "Режимът не беше изтрит")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

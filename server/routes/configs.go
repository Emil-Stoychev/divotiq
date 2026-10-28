package routes

import (
	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/database/gen/gameconfig"
	"divotiq/helpers"
	"divotiq/services"
	"divotiq/utils"

	"github.com/gofiber/fiber/v3"
)

type configBody struct {
	Title       string           `json:"title"`
	Description string           `json:"description"`
	ModeKey     string           `json:"modeKey"`
	Theme       string           `json:"theme"`
	Players     []map[string]any `json:"players"`
	Modules     map[string]any   `json:"modules"`
	Settings    map[string]any   `json:"settings"`
	Visibility  string           `json:"visibility"`
}

func validateConfigBody(body *configBody) error {
	body.Title = utils.CleanText(body.Title, 80)
	if utils.RuneLen(body.Title) < 2 {
		return utils.Invalid("Дайте име на играта (поне 2 символа)")
	}
	body.Description = utils.CleanText(body.Description, 300)
	body.ModeKey = utils.CleanText(body.ModeKey, 40)
	if body.ModeKey == "" {
		return utils.Invalid("Изберете повод")
	}
	if !services.IsKnownTheme(body.Theme) {
		return utils.Invalid("Невалидна тема")
	}
	players, err := services.ValidatePlayers(body.Players, true)
	if err != nil {
		return err
	}
	body.Players = players
	if err := services.ValidateModules(body.Modules); err != nil {
		return err
	}
	if body.Settings == nil {
		body.Settings = map[string]any{}
	}
	if err := services.ValidateSettings(body.Settings); err != nil {
		return err
	}
	if body.Visibility != "public" {
		body.Visibility = "private"
	}
	if body.Visibility == "public" {
		if msg := utils.PublicTextProblem(body.Title, body.Description); msg != "" {
			return utils.Invalid(msg)
		}
	}
	return nil
}

func configDTO(cfg *gen.GameConfig, viewer *gen.User, withDetails bool) fiber.Map {
	out := fiber.Map{
		"id":          cfg.ID,
		"title":       cfg.Title,
		"description": cfg.Description,
		"modeKey":     cfg.ModeKey,
		"theme":       cfg.Theme,
		"visibility":  cfg.Visibility,
		"sourceId":    cfg.SourceID,
		"copiesCount": cfg.CopiesCount,
		"playsCount":  cfg.PlaysCount,
		"playerCount": len(cfg.Players),
		"isOwn":       viewer != nil && viewer.ID == cfg.OwnerID,
		"createdAt":   cfg.CreatedAt,
		"updatedAt":   cfg.UpdatedAt,
	}
	enabled := []string{}
	for id, raw := range cfg.Modules {
		if mod, ok := raw.(map[string]any); ok {
			if on, _ := mod["enabled"].(bool); on {
				enabled = append(enabled, id)
			}
		}
	}
	out["enabledModules"] = enabled
	if withDetails {
		out["modules"] = cfg.Modules
		out["settings"] = cfg.Settings
		// Player names are personal; never expose them on shared presets.
		if viewer != nil && viewer.ID == cfg.OwnerID {
			out["players"] = cfg.Players
		} else {
			out["players"] = []any{}
		}
	}
	if cfg.Edges.Owner != nil {
		out["author"] = fiber.Map{"name": cfg.Edges.Owner.Name, "avatar": cfg.Edges.Owner.Avatar}
	}
	return out
}

func ListMyConfigs(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	items, err := db.Client.GameConfig.Query().
		Where(gameconfig.OwnerIDEQ(u.ID)).
		Order(gen.Desc(gameconfig.FieldUpdatedAt)).
		Limit(200).
		All(c.Context())
	if err != nil {
		return serverError(c, err, "Игрите не бяха заредени")
	}
	out := make([]fiber.Map, len(items))
	for i, item := range items {
		out[i] = configDTO(item, u, false)
	}
	return c.JSON(fiber.Map{"items": out})
}

func ListPublicConfigs(c fiber.Ctx) error {
	limit, offset := pagination(c, 24, 60)
	q := db.Client.GameConfig.Query().Where(gameconfig.VisibilityEQ(gameconfig.VisibilityPublic))
	if search := utils.CleanText(c.Query("q"), 60); search != "" {
		q = q.Where(gameconfig.Or(gameconfig.TitleContainsFold(search), gameconfig.DescriptionContainsFold(search)))
	}
	if mode := c.Query("mode"); mode != "" {
		q = q.Where(gameconfig.ModeKeyEQ(mode))
	}
	if c.Query("sort") == "popular" {
		q = q.Order(gen.Desc(gameconfig.FieldCopiesCount), gen.Desc(gameconfig.FieldPlaysCount))
	} else {
		q = q.Order(gen.Desc(gameconfig.FieldCreatedAt))
	}
	total, _ := q.Clone().Count(c.Context())
	items, err := q.WithOwner().Limit(limit).Offset(offset).All(c.Context())
	if err != nil {
		return serverError(c, err, "Игрите не бяха заредени")
	}
	viewer := helpers.CurrentUser(c)
	out := make([]fiber.Map, len(items))
	for i, item := range items {
		out[i] = configDTO(item, viewer, false)
	}
	return c.JSON(fiber.Map{"items": out, "total": total})
}

// GetConfig returns an own config, or a public one (without player names).
func GetConfig(c fiber.Ctx) error {
	viewer := helpers.CurrentUser(c)
	cfg, err := db.Client.GameConfig.Query().Where(gameconfig.IDEQ(c.Params("id"))).WithOwner().Only(c.Context())
	if err != nil {
		return notFoundOr500(c, err, "Играта не беше заредена")
	}
	isOwn := viewer != nil && viewer.ID == cfg.OwnerID
	if !isOwn && cfg.Visibility != gameconfig.VisibilityPublic {
		return fiber.NewError(fiber.StatusNotFound, "Не е намерено")
	}
	return c.JSON(configDTO(cfg, viewer, true))
}

func CreateConfig(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body configBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	if err := validateConfigBody(&body); err != nil {
		return badRequest(err)
	}
	count, _ := db.Client.GameConfig.Query().Where(gameconfig.OwnerIDEQ(u.ID)).Count(c.Context())
	if count >= 200 {
		return fiber.NewError(fiber.StatusTooManyRequests, "Достигнахте лимита от 200 запазени игри")
	}
	cfg, err := db.Client.GameConfig.Create().
		SetOwnerID(u.ID).
		SetTitle(body.Title).
		SetDescription(body.Description).
		SetModeKey(body.ModeKey).
		SetTheme(body.Theme).
		SetPlayers(body.Players).
		SetModules(body.Modules).
		SetSettings(body.Settings).
		SetVisibility(gameconfig.Visibility(body.Visibility)).
		Save(c.Context())
	if err != nil {
		return serverError(c, err, "Играта не беше запазена")
	}
	return c.Status(fiber.StatusCreated).JSON(configDTO(cfg, u, true))
}

func ownedConfig(c fiber.Ctx) (*gen.GameConfig, error) {
	u := helpers.CurrentUser(c)
	cfg, err := db.Client.GameConfig.Query().
		Where(gameconfig.IDEQ(c.Params("id")), gameconfig.OwnerIDEQ(u.ID)).
		Only(c.Context())
	if err != nil {
		return nil, notFoundOr500(c, err, "Играта не беше заредена")
	}
	return cfg, nil
}

func UpdateConfig(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	cfg, err := ownedConfig(c)
	if err != nil {
		return err
	}
	var body configBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	if err := validateConfigBody(&body); err != nil {
		return badRequest(err)
	}
	updated, err := cfg.Update().
		SetTitle(body.Title).
		SetDescription(body.Description).
		SetModeKey(body.ModeKey).
		SetTheme(body.Theme).
		SetPlayers(body.Players).
		SetModules(body.Modules).
		SetSettings(body.Settings).
		SetVisibility(gameconfig.Visibility(body.Visibility)).
		Save(c.Context())
	if err != nil {
		return serverError(c, err, "Промените не бяха запазени")
	}
	return c.JSON(configDTO(updated, u, true))
}

func DeleteConfig(c fiber.Ctx) error {
	cfg, err := ownedConfig(c)
	if err != nil {
		return err
	}
	if err := db.Client.GameConfig.DeleteOne(cfg).Exec(c.Context()); err != nil {
		return serverError(c, err, "Играта не беше изтрита")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// DuplicateConfig copies an own or public config into the user's library.
func DuplicateConfig(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	source, err := db.Client.GameConfig.Get(c.Context(), c.Params("id"))
	if err != nil {
		return notFoundOr500(c, err, "Играта не беше заредена")
	}
	isOwn := source.OwnerID == u.ID
	if !isOwn && source.Visibility != gameconfig.VisibilityPublic {
		return fiber.NewError(fiber.StatusNotFound, "Не е намерено")
	}
	players := source.Players
	if !isOwn {
		players = []map[string]any{}
	}
	title := utils.CleanText(source.Title+" (копие)", 80)
	cfg, err := db.Client.GameConfig.Create().
		SetOwnerID(u.ID).
		SetTitle(title).
		SetDescription(source.Description).
		SetModeKey(source.ModeKey).
		SetTheme(source.Theme).
		SetPlayers(players).
		SetModules(source.Modules).
		SetSettings(source.Settings).
		SetSourceID(source.ID).
		Save(c.Context())
	if err != nil {
		return serverError(c, err, "Копирането не беше успешно")
	}
	if !isOwn {
		_ = db.Client.GameConfig.UpdateOneID(source.ID).AddCopiesCount(1).Exec(c.Context())
	}
	return c.Status(fiber.StatusCreated).JSON(configDTO(cfg, u, true))
}

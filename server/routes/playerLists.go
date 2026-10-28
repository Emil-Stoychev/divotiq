package routes

import (
	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/database/gen/playerlist"
	"divotiq/helpers"
	"divotiq/services"
	"divotiq/utils"

	"github.com/gofiber/fiber/v3"
)

type playerListBody struct {
	Name    string           `json:"name"`
	Players []map[string]any `json:"players"`
}

func playerListDTO(p *gen.PlayerList) fiber.Map {
	return fiber.Map{"id": p.ID, "name": p.Name, "players": p.Players, "updatedAt": p.UpdatedAt}
}

func ListPlayerLists(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	items, err := db.Client.PlayerList.Query().
		Where(playerlist.OwnerIDEQ(u.ID)).
		Order(gen.Desc(playerlist.FieldUpdatedAt)).
		Limit(50).
		All(c.Context())
	if err != nil {
		return serverError(c, err, "Списъците не бяха заредени")
	}
	out := make([]fiber.Map, len(items))
	for i, p := range items {
		out[i] = playerListDTO(p)
	}
	return c.JSON(fiber.Map{"items": out})
}

func CreatePlayerList(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body playerListBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	name := utils.CleanText(body.Name, 60)
	if utils.RuneLen(name) < 2 {
		return badRequest(utils.Invalid("Дайте име на списъка"))
	}
	players, err := services.ValidatePlayers(body.Players, false)
	if err != nil {
		return badRequest(err)
	}
	count, _ := db.Client.PlayerList.Query().Where(playerlist.OwnerIDEQ(u.ID)).Count(c.Context())
	if count >= 50 {
		return fiber.NewError(fiber.StatusTooManyRequests, "Достигнахте лимита от 50 списъка")
	}
	p, err := db.Client.PlayerList.Create().SetOwnerID(u.ID).SetName(name).SetPlayers(players).Save(c.Context())
	if err != nil {
		return serverError(c, err, "Списъкът не беше запазен")
	}
	return c.Status(fiber.StatusCreated).JSON(playerListDTO(p))
}

func DeletePlayerList(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	deleted, err := db.Client.PlayerList.Delete().
		Where(playerlist.IDEQ(c.Params("id")), playerlist.OwnerIDEQ(u.ID)).
		Exec(c.Context())
	if err != nil {
		return serverError(c, err, "Списъкът не беше изтрит")
	}
	if deleted == 0 {
		return fiber.NewError(fiber.StatusNotFound, "Не е намерено")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

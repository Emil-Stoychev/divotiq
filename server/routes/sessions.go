package routes

import (
	"time"

	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/database/gen/gameconfig"
	"divotiq/database/gen/gamesession"
	"divotiq/database/gen/sessionevent"
	"divotiq/helpers"
	"divotiq/services"
	"divotiq/utils"

	"entgo.io/ent/dialect/sql"
	"github.com/gofiber/fiber/v3"
)

const maxEventsPerSync = 200

type sessionEventBody struct {
	ActionID   string `json:"actionId"`
	Type       string `json:"type"`
	Summary    string `json:"summary"`
	PlayerName string `json:"playerName"`
	ModuleID   string `json:"moduleId"`
	At         int64  `json:"at"`
}

type createSessionBody struct {
	ClientID string         `json:"clientId"`
	ConfigID string         `json:"configId"`
	Title    string         `json:"title"`
	ModeKey  string         `json:"modeKey"`
	State    map[string]any `json:"state"`
}

type syncSessionBody struct {
	BaseVersion int                `json:"baseVersion"`
	Status      string             `json:"status"`
	State       map[string]any     `json:"state"`
	Summary     map[string]any     `json:"summary"`
	Events      []sessionEventBody `json:"events"`
}

func sessionDTO(s *gen.GameSession, withState bool) fiber.Map {
	out := fiber.Map{
		"id":           s.ID,
		"clientId":     s.ClientID,
		"configId":     s.ConfigID,
		"title":        s.Title,
		"modeKey":      s.ModeKey,
		"status":       s.Status,
		"stateVersion": s.StateVersion,
		"playerCount":  s.PlayerCount,
		"summary":      utils.Tnry(s.Summary == nil, map[string]any{}, s.Summary),
		"startedAt":    s.StartedAt,
		"finishedAt":   s.FinishedAt,
		"updatedAt":    s.UpdatedAt,
	}
	if withState {
		out["state"] = s.State
	}
	return out
}

func playerCount(state map[string]any) int {
	players, _ := state["players"].([]any)
	return len(players)
}

// CreateSession registers a session for the user. It is idempotent on
// clientId, so retrying after a network error never creates duplicates.
func CreateSession(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body createSessionBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	body.ClientID = utils.CleanText(body.ClientID, 64)
	if len(body.ClientID) < 8 {
		return badRequest(utils.Invalid("Невалиден идентификатор на играта"))
	}
	if err := services.ValidateSessionState(body.State); err != nil {
		return badRequest(err)
	}
	title := utils.CleanText(body.Title, 80)
	if title == "" {
		title = "Игра"
	}
	existing, err := db.Client.GameSession.Query().
		Where(gamesession.OwnerIDEQ(u.ID), gamesession.ClientIDEQ(body.ClientID)).
		Only(c.Context())
	if err == nil {
		return c.JSON(sessionDTO(existing, true))
	}
	create := db.Client.GameSession.Create().
		SetOwnerID(u.ID).
		SetClientID(body.ClientID).
		SetTitle(title).
		SetModeKey(utils.Tnry(body.ModeKey == "", "classic", utils.CleanText(body.ModeKey, 40))).
		SetState(body.State).
		SetPlayerCount(playerCount(body.State)).
		SetStateVersion(1)
	if body.ConfigID != "" {
		owns, _ := db.Client.GameConfig.Query().
			Where(gameconfig.IDEQ(body.ConfigID), gameconfig.OwnerIDEQ(u.ID)).
			Exist(c.Context())
		if owns {
			create.SetConfigID(body.ConfigID)
			_ = db.Client.GameConfig.UpdateOneID(body.ConfigID).AddPlaysCount(1).Exec(c.Context())
		}
	}
	session, err := create.Save(c.Context())
	if err != nil {
		if gen.IsConstraintError(err) {
			existing, qerr := db.Client.GameSession.Query().
				Where(gamesession.OwnerIDEQ(u.ID), gamesession.ClientIDEQ(body.ClientID)).
				Only(c.Context())
			if qerr == nil {
				return c.JSON(sessionDTO(existing, true))
			}
		}
		return serverError(c, err, "Играта не беше запазена")
	}
	return c.Status(fiber.StatusCreated).JSON(sessionDTO(session, true))
}

func ownedSession(c fiber.Ctx) (*gen.GameSession, error) {
	u := helpers.CurrentUser(c)
	s, err := db.Client.GameSession.Query().
		Where(gamesession.IDEQ(c.Params("id")), gamesession.OwnerIDEQ(u.ID)).
		Only(c.Context())
	if err != nil {
		return nil, notFoundOr500(c, err, "Играта не беше заредена")
	}
	return s, nil
}

// SyncSession saves a new engine snapshot using optimistic concurrency:
// the update only applies when baseVersion matches the stored version.
// Events are inserted with ON CONFLICT DO NOTHING on (session, action).
func SyncSession(c fiber.Ctx) error {
	session, err := ownedSession(c)
	if err != nil {
		return err
	}
	var body syncSessionBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	if err := services.ValidateSessionState(body.State); err != nil {
		return badRequest(err)
	}
	if len(body.Events) > maxEventsPerSync {
		return badRequest(utils.Invalid("Твърде много събития наведнъж"))
	}
	status := gamesession.Status(body.Status)
	if gamesession.StatusValidator(status) != nil {
		return badRequest(utils.Invalid("Невалиден статус"))
	}
	if session.Status == gamesession.StatusFinished && status != gamesession.StatusFinished {
		return fiber.NewError(fiber.StatusConflict, "Играта вече е приключила")
	}

	ctx := c.Context()
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		return serverError(c, err, "Играта не беше запазена")
	}
	upd := tx.GameSession.Update().
		Where(gamesession.IDEQ(session.ID), gamesession.StateVersionEQ(body.BaseVersion)).
		SetState(body.State).
		SetStatus(status).
		SetPlayerCount(playerCount(body.State)).
		AddStateVersion(1)
	if status == gamesession.StatusFinished {
		if session.FinishedAt == nil {
			upd.SetFinishedAt(time.Now())
		}
		if body.Summary != nil && utils.JSONSize(body.Summary) < 64*1024 {
			upd.SetSummary(body.Summary)
		}
	}
	affected, err := upd.Save(ctx)
	if err != nil {
		_ = tx.Rollback()
		return serverError(c, err, "Играта не беше запазена")
	}
	if affected == 0 {
		_ = tx.Rollback()
		current, _ := db.Client.GameSession.Get(ctx, session.ID)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "Играта е променена от друго устройство или раздел",
			"session": sessionDTO(current, true),
		})
	}
	if len(body.Events) > 0 {
		builders := make([]*gen.SessionEventCreate, 0, len(body.Events))
		for _, ev := range body.Events {
			actionID := utils.CleanText(ev.ActionID, 64)
			evType := utils.CleanText(ev.Type, 60)
			if actionID == "" || evType == "" {
				continue
			}
			at := time.UnixMilli(ev.At)
			if ev.At <= 0 || at.After(time.Now().Add(time.Hour)) {
				at = time.Now()
			}
			builders = append(builders, tx.SessionEvent.Create().
				SetSessionID(session.ID).
				SetActionID(actionID).
				SetType(evType).
				SetSummary(utils.CleanText(ev.Summary, 300)).
				SetPlayerName(utils.CleanText(ev.PlayerName, 40)).
				SetModuleID(utils.CleanText(ev.ModuleID, 40)).
				SetHappenedAt(at))
		}
		if len(builders) > 0 {
			err = tx.SessionEvent.CreateBulk(builders...).
				OnConflict(sql.ConflictColumns(sessionevent.FieldSessionID, sessionevent.FieldActionID)).
				DoNothing().
				Exec(ctx)
			if err != nil {
				_ = tx.Rollback()
				return serverError(c, err, "Историята не беше запазена")
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return serverError(c, err, "Играта не беше запазена")
	}
	updated, err := db.Client.GameSession.Get(ctx, session.ID)
	if err != nil {
		return serverError(c, err, "Играта не беше заредена")
	}
	return c.JSON(sessionDTO(updated, false))
}

func ListSessions(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	limit, offset := pagination(c, 30, 100)
	q := db.Client.GameSession.Query().Where(gamesession.OwnerIDEQ(u.ID))
	if status := c.Query("status"); status != "" {
		q = q.Where(gamesession.StatusEQ(gamesession.Status(status)))
	}
	total, _ := q.Clone().Count(c.Context())
	items, err := q.Order(gen.Desc(gamesession.FieldUpdatedAt)).Limit(limit).Offset(offset).All(c.Context())
	if err != nil {
		return serverError(c, err, "Историята не беше заредена")
	}
	out := make([]fiber.Map, len(items))
	for i, s := range items {
		out[i] = sessionDTO(s, false)
	}
	return c.JSON(fiber.Map{"items": out, "total": total})
}

func GetSession(c fiber.Ctx) error {
	s, err := ownedSession(c)
	if err != nil {
		return err
	}
	return c.JSON(sessionDTO(s, true))
}

func ListSessionEvents(c fiber.Ctx) error {
	s, err := ownedSession(c)
	if err != nil {
		return err
	}
	events, err := db.Client.SessionEvent.Query().
		Where(sessionevent.SessionIDEQ(s.ID)).
		Order(gen.Asc(sessionevent.FieldHappenedAt), gen.Asc(sessionevent.FieldID)).
		Limit(2000).
		All(c.Context())
	if err != nil {
		return serverError(c, err, "Историята не беше заредена")
	}
	out := make([]fiber.Map, len(events))
	for i, ev := range events {
		out[i] = fiber.Map{
			"actionId":   ev.ActionID,
			"type":       ev.Type,
			"summary":    ev.Summary,
			"playerName": ev.PlayerName,
			"moduleId":   ev.ModuleID,
			"at":         ev.HappenedAt,
		}
	}
	return c.JSON(fiber.Map{"items": out})
}

func DeleteSession(c fiber.Ctx) error {
	s, err := ownedSession(c)
	if err != nil {
		return err
	}
	ctx := c.Context()
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		return serverError(c, err, "Играта не беше изтрита")
	}
	if _, err := tx.SessionEvent.Delete().Where(sessionevent.SessionIDEQ(s.ID)).Exec(ctx); err != nil {
		_ = tx.Rollback()
		return serverError(c, err, "Играта не беше изтрита")
	}
	if err := tx.GameSession.DeleteOneID(s.ID).Exec(ctx); err != nil {
		_ = tx.Rollback()
		return serverError(c, err, "Играта не беше изтрита")
	}
	if err := tx.Commit(); err != nil {
		return serverError(c, err, "Играта не беше изтрита")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

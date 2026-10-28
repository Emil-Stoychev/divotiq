package routes

import (
	db "divotiq/database"
	"divotiq/database/gen/contentfavorite"
	"divotiq/database/gen/contentitem"
	"divotiq/database/gen/contentreport"
	"divotiq/database/gen/gameconfig"
	"divotiq/database/gen/gamemode"
	"divotiq/database/gen/gamesession"
	"divotiq/database/gen/playerlist"
	"divotiq/database/gen/sessionevent"

	"github.com/gofiber/fiber/v3"
)

// deleteUserData removes a user and all owned rows in one transaction.
func deleteUserData(c fiber.Ctx, userID string) error {
	ctx := c.Context()
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		return err
	}
	rollback := func(err error) error {
		_ = tx.Rollback()
		return err
	}
	ownContent := contentitem.OwnerIDEQ(userID)
	steps := []func() error{
		func() error {
			_, err := tx.ContentFavorite.Delete().Where(contentfavorite.Or(
				contentfavorite.UserIDEQ(userID),
				contentfavorite.HasContentWith(ownContent),
			)).Exec(ctx)
			return err
		},
		func() error {
			_, err := tx.ContentReport.Delete().Where(contentreport.Or(
				contentreport.ReporterIDEQ(userID),
				contentreport.HasContentWith(ownContent),
			)).Exec(ctx)
			return err
		},
		func() error { _, err := tx.ContentItem.Delete().Where(ownContent).Exec(ctx); return err },
		func() error {
			_, err := tx.SessionEvent.Delete().Where(sessionevent.HasSessionWith(gamesession.OwnerIDEQ(userID))).Exec(ctx)
			return err
		},
		func() error { _, err := tx.GameSession.Delete().Where(gamesession.OwnerIDEQ(userID)).Exec(ctx); return err },
		func() error { _, err := tx.GameConfig.Delete().Where(gameconfig.OwnerIDEQ(userID)).Exec(ctx); return err },
		func() error { _, err := tx.GameMode.Delete().Where(gamemode.OwnerIDEQ(userID)).Exec(ctx); return err },
		func() error { _, err := tx.PlayerList.Delete().Where(playerlist.OwnerIDEQ(userID)).Exec(ctx); return err },
		func() error { return tx.User.DeleteOneID(userID).Exec(ctx) },
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return rollback(err)
		}
	}
	return tx.Commit()
}

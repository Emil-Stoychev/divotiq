package db

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"

	"divotiq/database/gen"
	"divotiq/utils"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	_ "github.com/jackc/pgx/v5/stdlib"
)

var (
	Client *gen.Client
	once   sync.Once
)

//go:generate go run ../cmd/entgen

func Init() {
	user := envTrim("DB_USER")
	pass := envTrim("DB_PASSWORD")
	host := envTrim("DB_HOST")
	port := envTrim("DB_PORT")
	name := envTrim("DB_NAME")

	URL := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		user,
		url.QueryEscape(pass),
		host,
		port,
		name,
	)

	maskedURL := strings.Replace(URL, url.QueryEscape(pass), "[****]", 1)
	utils.Info("Connecting to DB with URL: " + maskedURL)

	once.Do(func() {
		drvDB, err := entsql.Open("pgx", URL)
		if err != nil {
			utils.Error(err, "failed opening connection:")
			return
		}

		drv := entsql.OpenDB(dialect.Postgres, drvDB.DB())
		Client = gen.NewClient(gen.Driver(drv))
		utils.Info("Database client initialized")

		utils.Info("Running schema migration...")
		if err := Client.Schema.Create(context.Background()); err != nil {
			utils.Error(err, "migration failed:")
		} else {
			utils.Info("Migration complete")
		}
	})
}

func envTrim(key string) string {
	return strings.TrimRight(strings.TrimSpace(os.Getenv(key)), "\r")
}

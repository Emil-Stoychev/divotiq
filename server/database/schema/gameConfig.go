package schema

import (
	"divotiq/database/fields"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// GameConfig is a saved, reusable game setup (mode + players + module configs).
// Module configs embed snapshots of the content they use, so edits to the
// original content never silently change a saved game.
type GameConfig struct {
	ent.Schema
}

func (GameConfig) Fields() []ent.Field {
	return []ent.Field{
		fields.UUID("id"),
		field.String("owner_id").Immutable(),
		field.String("title").NotEmpty().MaxLen(80),
		field.String("description").Default("").MaxLen(300),
		field.String("mode_key").NotEmpty().MaxLen(40),
		field.String("theme").NotEmpty().MaxLen(30),
		field.JSON("players", []map[string]any{}).Optional(),
		field.JSON("modules", map[string]any{}),
		field.JSON("settings", map[string]any{}).Optional(),
		field.Enum("visibility").Values("private", "public").Default("private"),
		field.String("source_id").Optional().Nillable(),
		field.Int("copies_count").Default(0).NonNegative(),
		field.Int("plays_count").Default(0).NonNegative(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (GameConfig) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).Ref("game_configs").Field("owner_id").Unique().Required().Immutable(),
	}
}

func (GameConfig) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id", "updated_at"),
		index.Fields("visibility", "created_at"),
	}
}

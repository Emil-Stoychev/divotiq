package schema

import (
	"divotiq/database/fields"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// GameMode is a user-defined occasion. Built-in modes ship with the web app.
type GameMode struct {
	ent.Schema
}

func (GameMode) Fields() []ent.Field {
	return []ent.Field{
		fields.UUID("id"),
		field.String("owner_id").Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.String("description").Default("").MaxLen(300),
		field.String("theme").NotEmpty().MaxLen(30),
		field.String("icon").Default("✨").MaxLen(16),
		field.Strings("default_modules").Optional(),
		field.JSON("default_settings", map[string]any{}).Optional(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (GameMode) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).Ref("game_modes").Field("owner_id").Unique().Required().Immutable(),
	}
}

func (GameMode) Indexes() []ent.Index {
	return []ent.Index{index.Fields("owner_id")}
}

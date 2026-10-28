package schema

import (
	"divotiq/database/fields"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type User struct {
	ent.Schema
}

func (User) Fields() []ent.Field {
	return []ent.Field{
		fields.UUID("id"),
		field.String("email").Unique().NotEmpty(),
		field.String("password").NotEmpty().Sensitive(),
		field.String("name").NotEmpty().MaxLen(40),
		field.String("avatar").Optional().Default(""),
		field.Enum("role").Values("admin", "user").Default("user"),
		field.Enum("status").Values("active", "disabled").Default("active"),
		field.JSON("preferences", map[string]any{}).Optional(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("content_items", ContentItem.Type),
		edge.To("game_modes", GameMode.Type),
		edge.To("game_configs", GameConfig.Type),
		edge.To("game_sessions", GameSession.Type),
		edge.To("player_lists", PlayerList.Type),
		edge.To("favorites", ContentFavorite.Type),
	}
}

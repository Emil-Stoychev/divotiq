package schema

import (
	"divotiq/database/fields"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// GameSession stores the engine snapshot of a played game. `state_version`
// gives optimistic concurrency so stale tabs cannot overwrite newer state.
type GameSession struct {
	ent.Schema
}

func (GameSession) Fields() []ent.Field {
	return []ent.Field{
		fields.UUID("id"),
		field.String("owner_id").Immutable(),
		field.String("client_id").NotEmpty().MaxLen(64).Immutable(),
		field.String("config_id").Optional().Nillable(),
		field.String("title").NotEmpty().MaxLen(80),
		field.String("mode_key").NotEmpty().MaxLen(40),
		field.Enum("status").Values("active", "paused", "finished", "abandoned").Default("active"),
		field.JSON("state", map[string]any{}),
		field.Int("state_version").Default(0).NonNegative(),
		field.Int("player_count").Default(0).NonNegative(),
		field.JSON("summary", map[string]any{}).Optional(),
		field.Time("started_at").Default(time.Now).Immutable(),
		field.Time("finished_at").Optional().Nillable(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (GameSession) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).Ref("game_sessions").Field("owner_id").Unique().Required().Immutable(),
		edge.To("events", SessionEvent.Type),
	}
}

func (GameSession) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id", "client_id").Unique(),
		index.Fields("owner_id", "updated_at"),
	}
}

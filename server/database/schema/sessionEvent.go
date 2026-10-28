package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// SessionEvent is the append-only history of a session. The unique
// (session_id, action_id) index makes replays of the same action a no-op.
type SessionEvent struct {
	ent.Schema
}

func (SessionEvent) Fields() []ent.Field {
	return []ent.Field{
		field.String("session_id").Immutable(),
		field.String("action_id").NotEmpty().MaxLen(64).Immutable(),
		field.String("type").NotEmpty().MaxLen(60).Immutable(),
		field.String("summary").Default("").MaxLen(300).Immutable(),
		field.String("player_name").Default("").MaxLen(40).Immutable(),
		field.String("module_id").Default("").MaxLen(40).Immutable(),
		field.Time("happened_at").Immutable(),
		field.Time("created_at").Default(time.Now).Immutable(),
	}
}

func (SessionEvent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("session", GameSession.Type).Ref("events").Field("session_id").Unique().Required().Immutable(),
	}
}

func (SessionEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("session_id", "action_id").Unique(),
		index.Fields("session_id", "happened_at"),
	}
}

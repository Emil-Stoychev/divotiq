package schema

import (
	"divotiq/database/fields"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type PlayerList struct {
	ent.Schema
}

func (PlayerList) Fields() []ent.Field {
	return []ent.Field{
		fields.UUID("id"),
		field.String("owner_id").Immutable(),
		field.String("name").NotEmpty().MaxLen(60),
		field.JSON("players", []map[string]any{}),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (PlayerList) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).Ref("player_lists").Field("owner_id").Unique().Required().Immutable(),
	}
}

func (PlayerList) Indexes() []ent.Index {
	return []ent.Index{index.Fields("owner_id")}
}

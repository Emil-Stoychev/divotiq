package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ContentFavorite struct {
	ent.Schema
}

func (ContentFavorite) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").Immutable(),
		field.String("content_id").Immutable(),
		field.Time("created_at").Default(time.Now).Immutable(),
	}
}

func (ContentFavorite) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("favorites").Field("user_id").Unique().Required().Immutable(),
		edge.From("content", ContentItem.Type).Ref("favorites").Field("content_id").Unique().Required().Immutable(),
	}
}

func (ContentFavorite) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "content_id").Unique(),
	}
}

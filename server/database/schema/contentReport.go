package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type ContentReport struct {
	ent.Schema
}

func (ContentReport) Fields() []ent.Field {
	return []ent.Field{
		field.String("reporter_id").Immutable(),
		field.String("content_id").Immutable(),
		field.String("reason").Default("").MaxLen(200),
		field.Time("created_at").Default(time.Now).Immutable(),
	}
}

func (ContentReport) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("content", ContentItem.Type).Ref("reports").Field("content_id").Unique().Required().Immutable(),
	}
}

func (ContentReport) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("reporter_id", "content_id").Unique(),
	}
}

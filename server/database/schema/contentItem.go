package schema

import (
	"divotiq/database/fields"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ContentItem is a reusable piece of game content (challenge, phrase, card…)
// owned by a user. Kind-specific fields live in `data`.
type ContentItem struct {
	ent.Schema
}

func (ContentItem) Fields() []ent.Field {
	return []ent.Field{
		fields.UUID("id"),
		field.String("owner_id").Immutable(),
		field.Enum("kind").Values(
			"challenge", "whisper_phrase", "luck_card", "effect", "mission",
			"trivia", "charades", "word_game", "drawing", "song",
			"drinking", "gift", "wheel_preset",
		),
		field.String("title").NotEmpty().MaxLen(120),
		field.Text("body").Default("").MaxLen(1000),
		field.String("category").Default("").MaxLen(40),
		field.Enum("difficulty").Values("easy", "medium", "hard").Optional().Nillable(),
		field.Strings("tags").Optional(),
		field.JSON("data", map[string]any{}).Optional(),
		field.Enum("visibility").Values("private", "public").Default("private"),
		field.Enum("status").Values("active", "hidden").Default("active"),
		field.String("source_id").Optional().Nillable(),
		field.Int("copies_count").Default(0).NonNegative(),
		field.Int("favorites_count").Default(0).NonNegative(),
		field.Int("reports_count").Default(0).NonNegative(),
		field.Time("created_at").Default(time.Now).Immutable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ContentItem) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).Ref("content_items").Field("owner_id").Unique().Required().Immutable(),
		edge.To("favorites", ContentFavorite.Type),
		edge.To("reports", ContentReport.Type),
	}
}

func (ContentItem) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("owner_id", "kind"),
		index.Fields("visibility", "status", "kind"),
		index.Fields("created_at"),
	}
}

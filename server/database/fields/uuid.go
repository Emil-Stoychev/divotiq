package fields

import (
	"divotiq/utils"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

func UUID(name string) ent.Field {
	return field.String(name).
		Unique().
		Immutable().
		DefaultFunc(func() string {
			u := uuid.Must(uuid.NewV7())
			return utils.Base62Encode(u.NodeID())
		})
}

package main

import (
	"log"

	"entgo.io/ent/entc"
	"entgo.io/ent/entc/gen"
)

func main() {
	err := entc.Generate(
		"./schema",
		&gen.Config{
			Target:  "./gen",
			Package: "divotiq/database/gen",
		},
		entc.FeatureNames(
			"sql/upsert",
			"sql/execquery",
		),
	)
	if err != nil {
		log.Fatal("running ent codegen:", err)
	}
}

package services

import (
	"fmt"
	"math"

	"divotiq/utils"
)

// fieldSpec describes one allowed key inside ContentItem.data for a kind.
type fieldSpec struct {
	Type     string // int | bool | string | enum | strings | segments
	Min, Max int    // int range, or string/list length
	Values   []string
	Required bool
}

var rarities = []string{"common", "rare", "epic", "legendary"}

var luckEffects = []string{
	"spin_again", "immunity", "give_points", "choose_next", "exchange_gift",
	"group_event", "bonus_points", "skip_turn", "steal_points",
}

// ContentDataSchemas whitelists the kind-specific fields. Anything not listed
// is dropped, so clients cannot smuggle arbitrary payloads into public content.
var ContentDataSchemas = map[string]map[string]fieldSpec{
	"challenge": {
		"durationSec":  {Type: "int", Min: 0, Max: 600},
		"minPlayers":   {Type: "int", Min: 1, Max: 20},
		"maxPlayers":   {Type: "int", Min: 0, Max: 20},
		"points":       {Type: "int", Min: 0, Max: 10},
		"ongoing":      {Type: "bool"},
		"ongoingTurns": {Type: "int", Min: 1, Max: 10},
	},
	"whisper_phrase": {},
	"luck_card": {
		"effect": {Type: "enum", Values: luckEffects, Required: true},
		"rarity": {Type: "enum", Values: rarities},
		"value":  {Type: "int", Min: 0, Max: 10},
	},
	"effect": {
		"turns":  {Type: "int", Min: 1, Max: 10},
		"expiry": {Type: "enum", Values: []string{"turns", "next_turn"}},
	},
	"mission": {
		"points": {Type: "int", Min: 0, Max: 10},
	},
	"trivia": {
		"options":     {Type: "strings", Min: 2, Max: 6, Required: true},
		"answerIndex": {Type: "int", Min: 0, Max: 5, Required: true},
	},
	"charades":  {},
	"drawing":   {},
	"song":      {"artist": {Type: "string", Max: 80}},
	"word_game": {"targetCount": {Type: "int", Min: 1, Max: 20}, "durationSec": {Type: "int", Min: 5, Max: 300}},
	"drinking": {
		"alternative": {Type: "string", Min: 2, Max: 200, Required: true},
		"sips":        {Type: "int", Min: 1, Max: 5},
	},
	"gift": {
		"rarity":  {Type: "enum", Values: rarities},
		"mystery": {Type: "bool"},
	},
	"wheel_preset": {
		"segments": {Type: "segments", Min: 2, Max: 16, Required: true},
	},
}

var wheelSegmentTargets = []string{
	"challenges", "whisper", "gifts", "luckCards", "effects", "missions",
	"drinking", "miniGames", "points", "spinAgain", "nothing",
}

func numberToInt(v any) (int, bool) {
	f, ok := v.(float64)
	if !ok || math.IsNaN(f) || f != math.Trunc(f) {
		return 0, false
	}
	return int(f), true
}

func contains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}

// ValidateContentData returns a sanitized copy of data for the given kind.
func ValidateContentData(kind string, data map[string]any) (map[string]any, error) {
	schema, ok := ContentDataSchemas[kind]
	if !ok {
		return nil, utils.Invalid("Непознат тип съдържание")
	}
	out := map[string]any{}
	for key, spec := range schema {
		raw, present := data[key]
		if !present || raw == nil {
			if spec.Required {
				return nil, utils.Invalid(fmt.Sprintf("Липсва задължително поле: %s", key))
			}
			continue
		}
		switch spec.Type {
		case "int":
			n, ok := numberToInt(raw)
			if !ok || n < spec.Min || n > spec.Max {
				return nil, utils.Invalid(fmt.Sprintf("Полето %s трябва да е число между %d и %d", key, spec.Min, spec.Max))
			}
			out[key] = n
		case "bool":
			b, ok := raw.(bool)
			if !ok {
				return nil, utils.Invalid(fmt.Sprintf("Невалидна стойност за %s", key))
			}
			out[key] = b
		case "string":
			s, ok := raw.(string)
			s = utils.CleanText(s, spec.Max)
			if !ok || utils.RuneLen(s) < spec.Min {
				return nil, utils.Invalid(fmt.Sprintf("Невалиден текст за %s", key))
			}
			out[key] = s
		case "enum":
			s, ok := raw.(string)
			if !ok || !contains(spec.Values, s) {
				return nil, utils.Invalid(fmt.Sprintf("Невалидна стойност за %s", key))
			}
			out[key] = s
		case "strings":
			list, ok := raw.([]any)
			if !ok || len(list) < spec.Min || len(list) > spec.Max {
				return nil, utils.Invalid(fmt.Sprintf("Полето %s трябва да има между %d и %d елемента", key, spec.Min, spec.Max))
			}
			clean := make([]string, 0, len(list))
			for _, item := range list {
				s, ok := item.(string)
				s = utils.CleanText(s, 80)
				if !ok || s == "" {
					return nil, utils.Invalid(fmt.Sprintf("Празен елемент в %s", key))
				}
				clean = append(clean, s)
			}
			out[key] = clean
		case "segments":
			segments, err := validateSegments(raw, spec)
			if err != nil {
				return nil, err
			}
			out[key] = segments
		}
	}
	if kind == "trivia" {
		if out["answerIndex"].(int) >= len(out["options"].([]string)) {
			return nil, utils.Invalid("Верният отговор трябва да е сред опциите")
		}
	}
	return out, nil
}

func validateSegments(raw any, spec fieldSpec) ([]map[string]any, error) {
	list, ok := raw.([]any)
	if !ok || len(list) < spec.Min || len(list) > spec.Max {
		return nil, utils.Invalid("Колелото трябва да има между 2 и 16 сегмента")
	}
	segments := make([]map[string]any, 0, len(list))
	for _, item := range list {
		seg, ok := item.(map[string]any)
		if !ok {
			return nil, utils.Invalid("Невалиден сегмент")
		}
		label, _ := seg["label"].(string)
		label = utils.CleanText(label, 30)
		target, _ := seg["target"].(string)
		if label == "" || !contains(wheelSegmentTargets, target) {
			return nil, utils.Invalid("Всеки сегмент трябва да има име и действие")
		}
		weight, ok := numberToInt(seg["weight"])
		if !ok || weight < 1 || weight > 10 {
			weight = 1
		}
		color, _ := seg["color"].(string)
		if len(color) != 7 || color[0] != '#' {
			color = "#7c5cff"
		}
		icon, _ := seg["icon"].(string)
		once, _ := seg["once"].(bool)
		segments = append(segments, map[string]any{
			"label": label, "target": target, "weight": weight,
			"color": color, "icon": utils.CleanText(icon, 4), "once": once,
		})
	}
	return segments, nil
}

// ContentTexts returns the human-readable strings of an item for moderation.
func ContentTexts(title, body string, data map[string]any) []string {
	texts := []string{title, body}
	for _, v := range data {
		switch value := v.(type) {
		case string:
			texts = append(texts, value)
		case []string:
			texts = append(texts, value...)
		case []map[string]any:
			for _, seg := range value {
				if label, ok := seg["label"].(string); ok {
					texts = append(texts, label)
				}
			}
		}
	}
	return texts
}

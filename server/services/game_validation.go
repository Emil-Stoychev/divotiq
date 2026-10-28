package services

import (
	"fmt"

	"divotiq/utils"
)

// KnownModules mirrors the web module registry (web/src/game/modules).
var KnownModules = []string{
	"wheel", "challenges", "whisper", "gifts", "luckCards",
	"effects", "missions", "drinking", "miniGames",
}

// KnownThemes mirrors web/src/game/modes/themes.js.
var KnownThemes = []string{"christmas", "birthday", "classic", "drinking", "family", "custom", "neon"}

const (
	MinPlayers        = 2
	MaxPlayers        = 20
	maxModulesBytes   = 256 * 1024
	maxSettingsBytes  = 8 * 1024
	MaxSessionBytes   = 1024 * 1024
	maxPlayerNameRune = 24
)

func IsKnownTheme(theme string) bool { return contains(KnownThemes, theme) }

// ValidatePlayers sanitizes a player list: names, avatar and stable ids.
func ValidatePlayers(raw []map[string]any, allowEmpty bool) ([]map[string]any, error) {
	if len(raw) == 0 && allowEmpty {
		return []map[string]any{}, nil
	}
	if len(raw) > MaxPlayers {
		return nil, utils.Invalid(fmt.Sprintf("Максимум %d играчи", MaxPlayers))
	}
	if !allowEmpty && len(raw) < MinPlayers {
		return nil, utils.Invalid(fmt.Sprintf("Нужни са поне %d играчи", MinPlayers))
	}
	seen := map[string]bool{}
	out := make([]map[string]any, 0, len(raw))
	for _, p := range raw {
		name, _ := p["name"].(string)
		name = utils.CleanText(name, maxPlayerNameRune)
		if name == "" {
			return nil, utils.Invalid("Всеки играч трябва да има име")
		}
		if seen[name] {
			return nil, utils.Invalid("Имената на играчите трябва да са различни")
		}
		seen[name] = true
		id, _ := p["id"].(string)
		avatar, _ := p["avatar"].(string)
		out = append(out, map[string]any{
			"id":     utils.CleanText(id, 40),
			"name":   name,
			"avatar": utils.CleanText(avatar, 4),
		})
	}
	return out, nil
}

// ValidateModules checks module ids and payload size. Deep, module-specific
// rules live in the shared JS engine; the server enforces shape and limits.
func ValidateModules(modules map[string]any) error {
	if len(modules) == 0 {
		return utils.Invalid("Изберете поне един модул")
	}
	enabled := 0
	for id, raw := range modules {
		if !contains(KnownModules, id) {
			return utils.Invalid("Непознат модул: " + id)
		}
		mod, ok := raw.(map[string]any)
		if !ok {
			return utils.Invalid("Невалидна конфигурация на модул")
		}
		if on, _ := mod["enabled"].(bool); on {
			enabled++
		}
		if cfg, present := mod["config"]; present {
			if _, ok := cfg.(map[string]any); !ok {
				return utils.Invalid("Невалидна конфигурация на модул")
			}
		}
	}
	if enabled == 0 {
		return utils.Invalid("Изберете поне един модул")
	}
	if utils.JSONSize(modules) > maxModulesBytes {
		return utils.Invalid("Конфигурацията е твърде голяма")
	}
	return nil
}

func ValidateSettings(settings map[string]any) error {
	if utils.JSONSize(settings) > maxSettingsBytes {
		return utils.Invalid("Настройките са твърде големи")
	}
	return nil
}

// ValidateSessionState performs structural checks on an engine snapshot.
func ValidateSessionState(state map[string]any) error {
	if state == nil {
		return utils.Invalid("Липсва състояние на играта")
	}
	if utils.JSONSize(state) > MaxSessionBytes {
		return utils.Invalid("Състоянието на играта е твърде голямо")
	}
	players, ok := state["players"].([]any)
	if !ok || len(players) < MinPlayers || len(players) > MaxPlayers {
		return utils.Invalid("Невалиден списък с играчи")
	}
	if modules, ok := state["modules"].(map[string]any); ok {
		for id := range modules {
			if !contains(KnownModules, id) {
				return utils.Invalid("Непознат модул: " + id)
			}
		}
	} else {
		return utils.Invalid("Липсват модули")
	}
	return nil
}

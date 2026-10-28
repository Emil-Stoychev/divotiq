package services

import "testing"

func TestValidateContentDataDropsUnknownKeys(t *testing.T) {
	out, err := ValidateContentData("challenge", map[string]any{
		"durationSec": float64(30),
		"evil":        "<script>",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := out["evil"]; ok {
		t.Fatal("unknown key must be dropped")
	}
	if out["durationSec"] != 30 {
		t.Fatalf("durationSec = %v", out["durationSec"])
	}
}

func TestValidateContentDataRanges(t *testing.T) {
	if _, err := ValidateContentData("challenge", map[string]any{"durationSec": float64(9999)}); err == nil {
		t.Fatal("expected range error")
	}
	if _, err := ValidateContentData("challenge", map[string]any{"durationSec": 1.5}); err == nil {
		t.Fatal("expected integer error")
	}
}

func TestValidateTrivia(t *testing.T) {
	_, err := ValidateContentData("trivia", map[string]any{
		"options":     []any{"А", "Б"},
		"answerIndex": float64(3),
	})
	if err == nil {
		t.Fatal("answer index outside options must fail")
	}
	out, err := ValidateContentData("trivia", map[string]any{
		"options":     []any{"София", "Пловдив", "Варна"},
		"answerIndex": float64(0),
	})
	if err != nil || len(out["options"].([]string)) != 3 {
		t.Fatalf("valid trivia rejected: %v", err)
	}
}

func TestValidateDrinkingRequiresAlternative(t *testing.T) {
	if _, err := ValidateContentData("drinking", map[string]any{"sips": float64(2)}); err == nil {
		t.Fatal("drinking content must have a non-alcoholic alternative")
	}
}

func TestValidateWheelSegments(t *testing.T) {
	_, err := ValidateContentData("wheel_preset", map[string]any{
		"segments": []any{
			map[string]any{"label": "Шот", "target": "drinking"},
			map[string]any{"label": "Хак", "target": "rm -rf"},
		},
	})
	if err == nil {
		t.Fatal("unknown segment target must fail")
	}
}

func TestUnknownKind(t *testing.T) {
	if _, err := ValidateContentData("macro", map[string]any{}); err == nil {
		t.Fatal("unknown kind must fail")
	}
}

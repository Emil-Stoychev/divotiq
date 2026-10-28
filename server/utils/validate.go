package utils

import (
	"encoding/json"
	"net/mail"
	"strings"
	"unicode/utf8"
)

// CleanText trims, collapses control characters and enforces a rune limit.
func CleanText(s string, maxRunes int) string {
	s = strings.TrimSpace(s)
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' {
			return r
		}
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, s)
	if utf8.RuneCountInString(s) > maxRunes {
		runes := []rune(s)
		s = string(runes[:maxRunes])
	}
	return s
}

func RuneLen(s string) int {
	return utf8.RuneCountInString(s)
}

func ValidEmail(email string) bool {
	if len(email) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email && strings.Contains(email, ".")
}

// JSONSize returns the encoded size of v in bytes (or a huge number on error).
func JSONSize(v any) int {
	b, err := json.Marshal(v)
	if err != nil {
		return 1 << 30
	}
	return len(b)
}

// ValidationError is returned by validators; its message is user-facing (BG).
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

func Invalid(msg string) error { return &ValidationError{Message: msg} }

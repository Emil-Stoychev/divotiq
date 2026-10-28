package utils

import (
	"regexp"
	"strings"
)

// A deliberately small blocklist — public content is also reportable and
// auto-hidden after repeated reports. Extend as needed.
var bannedFragments = []string{
	"путк", "мамка ти", "еба ", "ебан", "педал", "курв", "fuck", "nigger", "cunt",
}

var linkPattern = regexp.MustCompile(`(?i)(https?://|www\.)`)

// PublicTextProblem returns a BG message when text is unsuitable for public sharing.
func PublicTextProblem(texts ...string) string {
	for _, t := range texts {
		lower := strings.ToLower(t)
		for _, w := range bannedFragments {
			if strings.Contains(lower, w) {
				return "Съдържанието съдържа неподходящи думи и не може да бъде публично"
			}
		}
		if linkPattern.MatchString(t) {
			return "Публичното съдържание не може да съдържа линкове"
		}
	}
	return ""
}

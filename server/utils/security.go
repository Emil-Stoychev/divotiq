package utils

import (
	"os"
	"sync"
)

const devFallbackSecret = "insecure-development-only-secret-change-me-please"
const minSecretLength = 32

var (
	jwtSecretOnce  sync.Once
	jwtSecretValue []byte
)

func IsProduction() bool {
	env := os.Getenv("ENV")
	return env == "prod" || env == "production"
}

func JWTSecret() []byte {
	jwtSecretOnce.Do(func() {
		secret := os.Getenv("SECRET")
		if len(secret) < minSecretLength {
			if IsProduction() {
				Fatal("SECRET env var must be set to at least 32 characters in production; refusing to start with a weak JWT signing key")
			}
			Warn("SECRET is unset or shorter than 32 characters; using an insecure development key. Set a strong SECRET before deploying.")
			secret = devFallbackSecret
		}
		jwtSecretValue = []byte(secret)
	})
	return jwtSecretValue
}

const AuthCookieName = "divotiq_auth"

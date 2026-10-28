package utils

import (
	"math/big"
)

func Tnry[T any](cond bool, a, b T) T {
	if cond {
		return a
	}
	return b
}

var base62Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

func Base62Encode(b []byte) string {
	i := new(big.Int).SetBytes(b)
	if i.Cmp(big.NewInt(0)) == 0 {
		return string(base62Alphabet[0])
	}

	var chars []byte
	base := big.NewInt(62)
	zero := big.NewInt(0)
	mod := new(big.Int)

	for i.Cmp(zero) > 0 {
		i.DivMod(i, base, mod)
		chars = append([]byte{base62Alphabet[mod.Int64()]}, chars...)
	}
	return string(chars)
}

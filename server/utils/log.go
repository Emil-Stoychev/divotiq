package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/requestid"
)

const logTimeFormat = "02/01/2006 15:04:05"

const (
	errorStackDepth    = 5
	criticalStackDepth = 10
)

func Debug(v ...any) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Printf("DEBUG: %#v\n", v)
		return
	}
	fmt.Printf("DEBUG:\n%s\n", b)
}

func Info(msg string) {
	log("[INFO]", msg)
}

func Warn(msg string) {
	log("[WARN]", msg)
}

func Fatal(msg string) {
	log("[FATAL]", msg)
	os.Exit(1)
}

func Error(err error, msg string) {
	stack := getStackTrace(3, errorStackDepth)
	log("[ERROR]", fmt.Sprintf("%s: %v\nStack:\n%+v\n", msg, err, stack))
}

func Critical(err error, msg string) {
	stack := getStackTrace(3, criticalStackDepth)
	log("[Critical]", fmt.Sprintf("%s: %v\nStack:\n%+v\n", msg, err, stack))
}

func ErrorResponse(c fiber.Ctx, err error, msg string) fiber.Map {
	traceID := requestid.FromContext(c)
	stack := getStackTrace(3, errorStackDepth)
	log("[Error]", fmt.Sprintf(
		"[%s] [%s %s]\n%s: %s\nStack:\n%+v\n",
		traceID,
		c.Method(),
		c.OriginalURL(),
		msg,
		err,
		stack,
	))
	return fiber.Map{
		"error":   msg,
		"trackId": traceID,
	}
}

func log(prefix string, msg string) {
	if os.Getenv("ENV") == "local" {
		fmt.Printf("%s %s | %s\n", prefix, time.Now().Format(logTimeFormat), msg)
	} else {
		fmt.Printf("%s %s\n", prefix, msg)
	}
}

func getStackTrace(skip, depth int) string {
	pcs := make([]uintptr, depth)
	n := runtime.Callers(skip, pcs)
	pcs = pcs[:n]

	frames := runtime.CallersFrames(pcs)
	var sb strings.Builder
	for {
		frame, more := frames.Next()
		if strings.Contains(frame.File, "/src/runtime/") ||
			strings.Contains(frame.File, "/src/debug/") ||
			strings.Contains(frame.File, "/src/internal/") ||
			strings.Contains(frame.File, "/src/reflect") {
			if !more {
				break
			}
			continue
		}
		fmt.Fprintf(&sb, "%s\n\t%s:%d\n", frame.Function, frame.File, frame.Line)
		if !more {
			break
		}
	}
	return sb.String()
}

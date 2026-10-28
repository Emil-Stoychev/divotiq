// apitest is an end-to-end smoke test against a running API (just api).
// It registers two throwaway users, exercises auth, validation, ownership
// checks, the library and session sync, then deletes both accounts.
//
//	cd server && go run ./cmd/apitest            # default http://127.0.0.1:3095
//	API_URL=http://127.0.0.1:3095 go run ./cmd/apitest
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"time"
)

type client struct {
	base string
	http *http.Client
}

func newClient(base string) *client {
	jar, _ := cookiejar.New(nil)
	return &client{base: base, http: &http.Client{Jar: jar, Timeout: 10 * time.Second}}
}

func (c *client) do(method, path string, body any) (int, map[string]any) {
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, c.base+path, reader)
	if err != nil {
		fail("%s %s: %v", method, path, err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.http.Do(req)
	if err != nil {
		fail("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return res.StatusCode, out
}

var passed, failed int

func check(name string, ok bool, detail ...any) {
	if ok {
		passed++
		fmt.Println("  ✓", name)
		return
	}
	failed++
	fmt.Println("  ✗", name, fmt.Sprint(detail...))
}

func fail(format string, args ...any) {
	fmt.Printf("FATAL: "+format+"\n", args...)
	os.Exit(1)
}

func expect(name string, want int, got int, body map[string]any) {
	check(fmt.Sprintf("%s → %d", name, want), got == want, fmt.Sprintf("(got %d %v)", got, body["error"]))
}

func str(m map[string]any, key string) string {
	s, _ := m[key].(string)
	return s
}

func main() {
	base := os.Getenv("API_URL")
	if base == "" {
		base = "http://127.0.0.1:3095"
	}
	anon := newClient(base)
	if status, _ := anon.do("GET", "/health", nil); status != 200 {
		fail("API is not running on %s (start it with: just api)", base)
	}

	stamp := time.Now().UnixNano()
	password := fmt.Sprintf("apitest-%d", stamp)
	alice, bob := newClient(base), newClient(base)

	fmt.Println("Auth")
	status, body := anon.do("POST", "/register", map[string]any{"name": "A", "email": "bad", "password": "short"})
	expect("register with invalid data", 422, status, body)
	status, body = alice.do("POST", "/register", map[string]any{"name": "Алис", "email": fmt.Sprintf("alice-%d@apitest.local", stamp), "password": password})
	expect("register alice", 201, status, body)
	status, body = bob.do("POST", "/register", map[string]any{"name": "Боб", "email": fmt.Sprintf("bob-%d@apitest.local", stamp), "password": password})
	expect("register bob", 201, status, body)
	status, body = anon.do("POST", "/register", map[string]any{"name": "Алис", "email": fmt.Sprintf("ALICE-%d@apitest.local", stamp), "password": password})
	expect("duplicate email (case-insensitive)", 409, status, body)
	status, body = anon.do("POST", "/login", map[string]any{"email": fmt.Sprintf("alice-%d@apitest.local", stamp), "password": "wrong-password"})
	expect("login with wrong password", 401, status, body)
	status, body = alice.do("GET", "/me", nil)
	expect("me with cookie", 200, status, body)
	status, body = anon.do("GET", "/me", nil)
	expect("me without cookie", 401, status, body)

	fmt.Println("Content")
	status, body = alice.do("POST", "/content", map[string]any{"kind": "challenge", "title": "x", "body": ""})
	expect("invalid challenge", 422, status, body)
	status, body = alice.do("POST", "/content", map[string]any{"kind": "drinking", "title": "Шот", "body": "Пий", "data": map[string]any{"sips": 1}})
	expect("drinking without alternative", 422, status, body)
	status, body = alice.do("POST", "/content", map[string]any{
		"kind": "challenge", "title": fmt.Sprintf("Apitest предизвикателство %d", stamp), "body": "Изпей песен на обратно",
		"difficulty": "easy", "tags": []string{"apitest"}, "data": map[string]any{"durationSec": 30, "points": 2, "minPlayers": 2},
		"visibility": "public",
	})
	expect("create public challenge", 201, status, body)
	contentID := str(body, "id")
	status, body = alice.do("POST", "/content", map[string]any{"kind": "whisper_phrase", "title": "Тайна фраза за apitest", "visibility": "private"})
	expect("create private whisper phrase", 201, status, body)
	privateID := str(body, "id")

	status, body = bob.do("PUT", "/content/"+contentID, map[string]any{"kind": "challenge", "title": "Хакнато", "body": "Хакнато съдържание"})
	check("bob cannot edit alice's content", status == 403 || status == 404, status)
	status, body = bob.do("DELETE", "/content/"+contentID, nil)
	check("bob cannot delete alice's content", status == 403 || status == 404, status)
	status, body = bob.do("POST", "/content/"+privateID+"/copy", nil)
	check("bob cannot copy private content", status == 403 || status == 404, status)

	status, body = anon.do("GET", fmt.Sprintf("/library/content?q=Apitest+предизвикателство+%d", stamp), nil)
	items, _ := body["items"].([]any)
	check("public content is in the library", status == 200 && len(items) == 1, status, " items=", len(items))
	status, body = anon.do("GET", "/library/content?q=Тайна+фраза+за+apitest", nil)
	items, _ = body["items"].([]any)
	check("private content is not in the library", status == 200 && len(items) == 0, " items=", len(items))

	status, body = bob.do("POST", "/content/"+contentID+"/favorite", nil)
	check("bob favorites", status == 200 && body["isFavorite"] == true, status, body)
	status, body = bob.do("POST", "/content/"+contentID+"/copy", nil)
	expect("bob copies public content", 201, status, body)
	check("copy is private and owned by bob", str(body, "visibility") == "private" && str(body, "id") != contentID, body)
	status, body = bob.do("POST", "/content/"+contentID+"/report", map[string]any{"reason": "spam"})
	expect("bob reports", 200, status, body)
	status, body = bob.do("POST", "/content/"+contentID+"/report", map[string]any{"reason": "spam"})
	check("second report is not counted twice", status == 200 && str(body, "message") == "Вече сте докладвали това съдържание", body)
	status, body = alice.do("POST", "/content/"+contentID+"/report", map[string]any{"reason": "spam"})
	check("cannot report own content", status == 422 || status == 403, status)
	status, body = bob.do("GET", "/admin/reported", nil)
	expect("non-admin cannot moderate", 403, status, body)

	fmt.Println("Configs")
	players := []map[string]any{{"id": "p1", "name": "Иван", "avatar": "🦊"}, {"id": "p2", "name": "Мария", "avatar": "🐼"}}
	modules := map[string]any{"challenges": map[string]any{"enabled": true, "config": map[string]any{}}}
	status, body = alice.do("POST", "/configs", map[string]any{"title": "Apitest", "modeKey": "classic", "theme": "classic", "players": []map[string]any{players[0], players[0]}, "modules": modules})
	expect("duplicate player names", 422, status, body)
	status, body = alice.do("POST", "/configs", map[string]any{"title": "Apitest", "modeKey": "classic", "theme": "classic", "players": players, "modules": map[string]any{"hack": map[string]any{"enabled": true}}})
	expect("unknown module", 422, status, body)
	status, body = alice.do("POST", "/configs", map[string]any{"title": "Apitest игра", "modeKey": "classic", "theme": "classic", "players": players, "modules": modules, "visibility": "private"})
	expect("create config", 201, status, body)
	configID := str(body, "id")
	status, body = bob.do("GET", "/configs/"+configID, nil)
	expect("bob cannot read private config", 404, status, body)
	status, body = bob.do("PUT", "/configs/"+configID, map[string]any{"title": "Хакнато", "modeKey": "classic", "theme": "classic", "players": players, "modules": modules})
	check("bob cannot update alice's config", status == 403 || status == 404, status)

	fmt.Println("Sessions")
	state := map[string]any{"players": []any{players[0], players[1]}, "modules": modules, "status": "active"}
	clientID := fmt.Sprintf("apitest-%d", stamp)
	status, body = alice.do("POST", "/sessions", map[string]any{"clientId": clientID, "configId": configID, "title": "Apitest", "modeKey": "classic", "state": state})
	expect("create session", 201, status, body)
	sessionID := str(body, "id")
	status, body = alice.do("POST", "/sessions", map[string]any{"clientId": clientID, "title": "Apitest", "state": state})
	check("create is idempotent on clientId", status == 200 && str(body, "id") == sessionID, status)
	event := map[string]any{"actionId": "a1", "type": "challenge.success", "summary": "Иван +2", "at": time.Now().UnixMilli()}
	status, body = alice.do("PUT", "/sessions/"+sessionID, map[string]any{"baseVersion": 1, "status": "active", "state": state, "events": []any{event}})
	expect("sync v1", 200, status, body)
	status, body = alice.do("PUT", "/sessions/"+sessionID, map[string]any{"baseVersion": 1, "status": "active", "state": state, "events": []any{event}})
	expect("stale baseVersion conflicts", 409, status, body)
	status, body = alice.do("PUT", "/sessions/"+sessionID, map[string]any{"baseVersion": 2, "status": "finished", "state": state, "summary": map[string]any{"rounds": 1}, "events": []any{event}})
	expect("finish (event resent)", 200, status, body)
	status, body = alice.do("GET", "/sessions/"+sessionID+"/events", nil)
	events, _ := body["items"].([]any)
	if events == nil {
		events, _ = body["events"].([]any)
	}
	check("resent event stored once", status == 200 && len(events) == 1, status, " events=", len(events))
	status, body = alice.do("PUT", "/sessions/"+sessionID, map[string]any{"baseVersion": 3, "status": "active", "state": state})
	expect("finished session cannot be reopened", 409, status, body)
	status, body = bob.do("GET", "/sessions/"+sessionID, nil)
	expect("bob cannot read alice's session", 404, status, body)
	status, body = alice.do("PUT", "/sessions/"+sessionID, map[string]any{"baseVersion": 3, "status": "finished", "state": map[string]any{"players": []any{}}})
	expect("invalid state", 422, status, body)

	fmt.Println("Cleanup")
	status, body = alice.do("DELETE", "/me", map[string]any{"password": "wrong-password"})
	check("delete account needs the password", status == 401 || status == 403 || status == 422, status)
	status, body = alice.do("DELETE", "/me", map[string]any{"password": password})
	check("delete alice", status == 200 || status == 204, status, body)
	status, body = bob.do("DELETE", "/me", map[string]any{"password": password})
	check("delete bob", status == 200 || status == 204, status, body)
	status, body = anon.do("GET", fmt.Sprintf("/library/content?q=Apitest+предизвикателство+%d", stamp), nil)
	items, _ = body["items"].([]any)
	check("deleted user's content left the library", status == 200 && len(items) == 0, " items=", len(items))

	fmt.Printf("\n%d passed, %d failed\n", passed, failed)
	if failed > 0 {
		os.Exit(1)
	}
}

package services

import (
	"context"
	"os"
	"strings"

	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/database/gen/contentitem"
	"divotiq/database/gen/user"
	"divotiq/utils"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Seed creates the admin account (from env) and a demo community author
// with sample public content, only when they do not exist yet.
func Seed(ctx context.Context) {
	ensureAdmin(ctx)
	author := ensureUser(ctx, "community@divotiq.local", "Общността", "🦉", os.Getenv("SEED_COMMUNITY_PASSWORD"))
	if author != nil {
		ensureCommunityContent(ctx, author)
	}
}

func ensureAdmin(ctx context.Context) {
	email := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	password := os.Getenv("ADMIN_PASSWORD")
	if email == "" || password == "" {
		return
	}
	if u := ensureUser(ctx, email, "Админ", "👑", password); u != nil && u.Role != user.RoleAdmin {
		_ = db.Client.User.UpdateOne(u).SetRole(user.RoleAdmin).Exec(ctx)
	}
}

func ensureUser(ctx context.Context, email, name, avatar, password string) *gen.User {
	if u, err := db.Client.User.Query().Where(user.EmailEQ(email)).Only(ctx); err == nil {
		return u
	}
	if password == "" {
		// Community author cannot log in unless a password is configured.
		password = uuid.NewString() // random, unknown

	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		utils.Error(err, "seed: hash password")
		return nil
	}
	u, err := db.Client.User.Create().
		SetEmail(email).SetName(name).SetAvatar(avatar).SetPassword(string(hash)).
		Save(ctx)
	if err != nil {
		utils.Error(err, "seed: create user "+email)
		return nil
	}
	utils.Info("Seeded user " + email)
	return u
}

type seedItem struct {
	kind       contentitem.Kind
	title      string
	body       string
	category   string
	difficulty contentitem.Difficulty
	tags       []string
	data       map[string]any
}

func ensureCommunityContent(ctx context.Context, author *gen.User) {
	exists, _ := db.Client.ContentItem.Query().Where(contentitem.OwnerIDEQ(author.ID)).Exist(ctx)
	if exists {
		return
	}
	items := []seedItem{
		{contentitem.KindChallenge, "Кажи 5 български филма", "Имаш 15 секунди да кажеш 5 български филма.", "Знания", contentitem.DifficultyMedium, []string{"филми", "бързо"}, map[string]any{"durationSec": 15, "points": 2}},
		{contentitem.KindChallenge, "Говори като спортен коментатор", "Коментирай какво прави играчът вдясно от теб в продължение на 30 секунди.", "Актьорско", contentitem.DifficultyEasy, []string{"смях"}, map[string]any{"durationSec": 30, "points": 1}},
		{contentitem.KindChallenge, "Без „да“ и „не“", "До следващия си ход не можеш да казваш „да“ и „не“.", "Ефект", contentitem.DifficultyMedium, []string{"ефект"}, map[string]any{"ongoing": true, "ongoingTurns": 3, "points": 2}},
		{contentitem.KindWhisperPhrase, "Баба ми пече баклава на тротинетка", "", "Смешни", contentitem.DifficultyHard, []string{"смешни"}, map[string]any{}},
		{contentitem.KindWhisperPhrase, "Шопската салата е без маслини", "", "Храна", contentitem.DifficultyMedium, []string{"храна"}, map[string]any{}},
		{contentitem.KindLuckCard, "Тайно съкровище", "Получаваш 3 бонус точки.", "Награда", "", []string{"точки"}, map[string]any{"effect": "bonus_points", "value": 3, "rarity": "rare"}},
		{contentitem.KindMission, "Комплимент без молба", "Накарай някого да ти направи комплимент, без да го молиш.", "Социални", contentitem.DifficultyMedium, []string{"мисия"}, map[string]any{"points": 3}},
		{contentitem.KindTrivia, "Кой е най-високият връх на Балканския полуостров?", "", "География", contentitem.DifficultyEasy, []string{"българия"}, map[string]any{"options": []string{"Мусала", "Олимп", "Вихрен", "Ботев"}, "answerIndex": 0}},
		{contentitem.KindCharades, "Тиквеник на дискотека", "", "Смешни", contentitem.DifficultyMedium, []string{"пантомима"}, map[string]any{}},
		{contentitem.KindDrinking, "Наздраве с левия", "Пийни една глътка с човека вляво от теб.", "Социални", "", []string{"наздраве"}, map[string]any{"sips": 1, "alternative": "Чукнете се с безалкохолно и си кажете тост."}},
	}
	for _, it := range items {
		create := db.Client.ContentItem.Create().
			SetOwnerID(author.ID).
			SetKind(it.kind).
			SetTitle(it.title).
			SetBody(it.body).
			SetCategory(it.category).
			SetTags(it.tags).
			SetData(it.data).
			SetVisibility(contentitem.VisibilityPublic)
		if it.difficulty != "" {
			create.SetDifficulty(it.difficulty)
		}
		if err := create.Exec(ctx); err != nil {
			utils.Error(err, "seed: content")
		}
	}
	utils.Info("Seeded community content")
}

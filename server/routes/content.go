package routes

import (
	"strings"
	"time"

	db "divotiq/database"
	"divotiq/database/gen"
	"divotiq/database/gen/contentfavorite"
	"divotiq/database/gen/contentitem"
	"divotiq/database/gen/contentreport"
	"divotiq/database/gen/predicate"
	"divotiq/helpers"
	"divotiq/services"
	"divotiq/utils"

	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqljson"
	"github.com/gofiber/fiber/v3"
)

const (
	maxPublicItemsPerDay  = 40
	maxItemsPerUser       = 2000
	reportsBeforeAutoHide = 3
)

type contentBody struct {
	Kind       string         `json:"kind"`
	Title      string         `json:"title"`
	Body       string         `json:"body"`
	Category   string         `json:"category"`
	Difficulty string         `json:"difficulty"`
	Tags       []string       `json:"tags"`
	Data       map[string]any `json:"data"`
	Visibility string         `json:"visibility"`
}

type cleanContent struct {
	kind       contentitem.Kind
	title      string
	body       string
	category   string
	difficulty *contentitem.Difficulty
	tags       []string
	data       map[string]any
	visibility contentitem.Visibility
}

func validateContentBody(body contentBody) (*cleanContent, error) {
	kind := contentitem.Kind(body.Kind)
	if err := contentitem.KindValidator(kind); err != nil {
		return nil, utils.Invalid("Непознат тип съдържание")
	}
	title := utils.CleanText(body.Title, 120)
	if utils.RuneLen(title) < 2 {
		return nil, utils.Invalid("Заглавието трябва да е поне 2 символа")
	}
	out := &cleanContent{
		kind:     kind,
		title:    title,
		body:     utils.CleanText(body.Body, 1000),
		category: utils.CleanText(body.Category, 40),
	}
	if body.Difficulty != "" {
		d := contentitem.Difficulty(body.Difficulty)
		if err := contentitem.DifficultyValidator(d); err != nil {
			return nil, utils.Invalid("Невалидна трудност")
		}
		out.difficulty = &d
	}
	if len(body.Tags) > 8 {
		return nil, utils.Invalid("Максимум 8 тага")
	}
	seen := map[string]bool{}
	for _, tag := range body.Tags {
		tag = strings.ToLower(utils.CleanText(tag, 24))
		if tag != "" && !seen[tag] {
			seen[tag] = true
			out.tags = append(out.tags, tag)
		}
	}
	data, err := services.ValidateContentData(body.Kind, body.Data)
	if err != nil {
		return nil, err
	}
	out.data = data
	out.visibility = contentitem.VisibilityPrivate
	if body.Visibility == "public" {
		out.visibility = contentitem.VisibilityPublic
	}
	if out.visibility == contentitem.VisibilityPublic {
		if msg := utils.PublicTextProblem(append(services.ContentTexts(out.title, out.body, out.data), out.tags...)...); msg != "" {
			return nil, utils.Invalid(msg)
		}
	}
	return out, nil
}

func contentDTO(item *gen.ContentItem, viewer *gen.User, favorite bool) fiber.Map {
	out := fiber.Map{
		"id":             item.ID,
		"kind":           item.Kind,
		"title":          item.Title,
		"body":           item.Body,
		"category":       item.Category,
		"difficulty":     item.Difficulty,
		"tags":           utils.Tnry(item.Tags == nil, []string{}, item.Tags),
		"data":           utils.Tnry(item.Data == nil, map[string]any{}, item.Data),
		"visibility":     item.Visibility,
		"status":         item.Status,
		"sourceId":       item.SourceID,
		"copiesCount":    item.CopiesCount,
		"favoritesCount": item.FavoritesCount,
		"isFavorite":     favorite,
		"isOwn":          viewer != nil && viewer.ID == item.OwnerID,
		"createdAt":      item.CreatedAt,
		"updatedAt":      item.UpdatedAt,
	}
	if item.Edges.Owner != nil {
		out["author"] = fiber.Map{"name": item.Edges.Owner.Name, "avatar": item.Edges.Owner.Avatar}
	}
	if helpers.IsAdmin(viewer) {
		out["reportsCount"] = item.ReportsCount
	}
	return out
}

// applyContentFilters applies the shared search/filter query params.
func applyContentFilters(c fiber.Ctx, q *gen.ContentItemQuery) *gen.ContentItemQuery {
	if kind := c.Query("kind"); kind != "" {
		q = q.Where(contentitem.KindEQ(contentitem.Kind(kind)))
	}
	if category := c.Query("category"); category != "" {
		q = q.Where(contentitem.CategoryEQ(category))
	}
	if difficulty := c.Query("difficulty"); difficulty != "" {
		q = q.Where(contentitem.DifficultyEQ(contentitem.Difficulty(difficulty)))
	}
	if tag := strings.ToLower(strings.TrimSpace(c.Query("tag"))); tag != "" {
		q = q.Where(predicate.ContentItem(func(s *sql.Selector) {
			s.Where(sqljson.ValueContains(contentitem.FieldTags, tag))
		}))
	}
	if search := strings.TrimSpace(c.Query("q")); search != "" {
		search = utils.CleanText(search, 60)
		q = q.Where(contentitem.Or(
			contentitem.TitleContainsFold(search),
			contentitem.BodyContainsFold(search),
			contentitem.CategoryContainsFold(search),
		))
	}
	switch c.Query("sort") {
	case "popular":
		q = q.Order(
			gen.Desc(contentitem.FieldFavoritesCount),
			gen.Desc(contentitem.FieldCopiesCount),
			gen.Desc(contentitem.FieldCreatedAt),
		)
	case "title":
		q = q.Order(gen.Asc(contentitem.FieldTitle))
	default:
		q = q.Order(gen.Desc(contentitem.FieldCreatedAt))
	}
	return q
}

func favoriteSet(c fiber.Ctx, viewer *gen.User, items []*gen.ContentItem) map[string]bool {
	set := map[string]bool{}
	if viewer == nil || len(items) == 0 {
		return set
	}
	ids := make([]string, len(items))
	for i, item := range items {
		ids[i] = item.ID
	}
	favs, err := db.Client.ContentFavorite.Query().
		Where(contentfavorite.UserIDEQ(viewer.ID), contentfavorite.ContentIDIn(ids...)).
		All(c.Context())
	if err == nil {
		for _, f := range favs {
			set[f.ContentID] = true
		}
	}
	return set
}

func listContentResponse(c fiber.Ctx, q *gen.ContentItemQuery, viewer *gen.User) error {
	limit, offset := pagination(c, 30, 100)
	total, err := q.Clone().Count(c.Context())
	if err != nil {
		return serverError(c, err, "Съдържанието не беше заредено")
	}
	items, err := q.WithOwner().Limit(limit).Offset(offset).All(c.Context())
	if err != nil {
		return serverError(c, err, "Съдържанието не беше заредено")
	}
	favs := favoriteSet(c, viewer, items)
	out := make([]fiber.Map, len(items))
	for i, item := range items {
		out[i] = contentDTO(item, viewer, favs[item.ID])
	}
	return c.JSON(fiber.Map{"items": out, "total": total, "limit": limit, "offset": offset})
}

// ListMyContent returns the authenticated user's own content.
func ListMyContent(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	q := applyContentFilters(c, db.Client.ContentItem.Query().Where(contentitem.OwnerIDEQ(u.ID)))
	if vis := c.Query("visibility"); vis == "public" || vis == "private" {
		q = q.Where(contentitem.VisibilityEQ(contentitem.Visibility(vis)))
	}
	return listContentResponse(c, q, u)
}

// ListPublicContent is the community library (no auth required).
func ListPublicContent(c fiber.Ctx) error {
	q := db.Client.ContentItem.Query().Where(
		contentitem.VisibilityEQ(contentitem.VisibilityPublic),
		contentitem.StatusEQ(contentitem.StatusActive),
	)
	return listContentResponse(c, applyContentFilters(c, q), helpers.CurrentUser(c))
}

// ListFavoriteContent returns public content the user has favorited.
func ListFavoriteContent(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	q := db.Client.ContentItem.Query().Where(
		contentitem.HasFavoritesWith(contentfavorite.UserIDEQ(u.ID)),
		contentitem.Or(
			contentitem.OwnerIDEQ(u.ID),
			contentitem.And(
				contentitem.VisibilityEQ(contentitem.VisibilityPublic),
				contentitem.StatusEQ(contentitem.StatusActive),
			),
		),
	)
	return listContentResponse(c, applyContentFilters(c, q), u)
}

func CreateContent(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	var body contentBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	clean, err := validateContentBody(body)
	if err != nil {
		return badRequest(err)
	}
	if err := checkContentQuota(c, u, clean.visibility); err != nil {
		return err
	}
	item, err := db.Client.ContentItem.Create().
		SetOwnerID(u.ID).
		SetKind(clean.kind).
		SetTitle(clean.title).
		SetBody(clean.body).
		SetCategory(clean.category).
		SetNillableDifficulty(clean.difficulty).
		SetTags(clean.tags).
		SetData(clean.data).
		SetVisibility(clean.visibility).
		Save(c.Context())
	if err != nil {
		return serverError(c, err, "Съдържанието не беше създадено")
	}
	item.Edges.Owner = u
	return c.Status(fiber.StatusCreated).JSON(contentDTO(item, u, false))
}

func checkContentQuota(c fiber.Ctx, u *gen.User, visibility contentitem.Visibility) error {
	total, _ := db.Client.ContentItem.Query().Where(contentitem.OwnerIDEQ(u.ID)).Count(c.Context())
	if total >= maxItemsPerUser {
		return fiber.NewError(fiber.StatusTooManyRequests, "Достигнахте лимита за съдържание")
	}
	if visibility != contentitem.VisibilityPublic {
		return nil
	}
	today, _ := db.Client.ContentItem.Query().Where(
		contentitem.OwnerIDEQ(u.ID),
		contentitem.VisibilityEQ(contentitem.VisibilityPublic),
		contentitem.CreatedAtGT(time.Now().Add(-24*time.Hour)),
	).Count(c.Context())
	if today >= maxPublicItemsPerDay {
		return fiber.NewError(fiber.StatusTooManyRequests, "Публикувахте твърде много за днес. Опитайте утре.")
	}
	return nil
}

// ownedContent loads an item and enforces server-side ownership.
func ownedContent(c fiber.Ctx) (*gen.ContentItem, error) {
	u := helpers.CurrentUser(c)
	item, err := db.Client.ContentItem.Query().
		Where(contentitem.IDEQ(c.Params("id")), contentitem.OwnerIDEQ(u.ID)).
		WithOwner().
		Only(c.Context())
	if err != nil {
		return nil, notFoundOr500(c, err, "Съдържанието не беше заредено")
	}
	return item, nil
}

func UpdateContent(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	item, err := ownedContent(c)
	if err != nil {
		return err
	}
	var body contentBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	body.Kind = string(item.Kind) // kind is immutable
	clean, err := validateContentBody(body)
	if err != nil {
		return badRequest(err)
	}
	if clean.visibility == contentitem.VisibilityPublic && item.Visibility != contentitem.VisibilityPublic {
		if err := checkContentQuota(c, u, clean.visibility); err != nil {
			return err
		}
	}
	upd := item.Update().
		SetTitle(clean.title).
		SetBody(clean.body).
		SetCategory(clean.category).
		SetTags(clean.tags).
		SetData(clean.data).
		SetVisibility(clean.visibility)
	if clean.difficulty != nil {
		upd.SetDifficulty(*clean.difficulty)
	} else {
		upd.ClearDifficulty()
	}
	updated, err := upd.Save(c.Context())
	if err != nil {
		return serverError(c, err, "Промените не бяха запазени")
	}
	updated.Edges.Owner = u
	return c.JSON(contentDTO(updated, u, false))
}

func DeleteContent(c fiber.Ctx) error {
	item, err := ownedContent(c)
	if err != nil {
		return err
	}
	ctx := c.Context()
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		return serverError(c, err, "Съдържанието не беше изтрито")
	}
	_, _ = tx.ContentFavorite.Delete().Where(contentfavorite.ContentIDEQ(item.ID)).Exec(ctx)
	_, _ = tx.ContentReport.Delete().Where(contentreport.ContentIDEQ(item.ID)).Exec(ctx)
	if err := tx.ContentItem.DeleteOneID(item.ID).Exec(ctx); err != nil {
		_ = tx.Rollback()
		return serverError(c, err, "Съдържанието не беше изтрито")
	}
	if err := tx.Commit(); err != nil {
		return serverError(c, err, "Съдържанието не беше изтрито")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// visibleContent loads an item the viewer may read (own, or public+active).
func visibleContent(c fiber.Ctx) (*gen.ContentItem, error) {
	u := helpers.CurrentUser(c)
	item, err := db.Client.ContentItem.Query().Where(contentitem.IDEQ(c.Params("id"))).WithOwner().Only(c.Context())
	if err != nil {
		return nil, notFoundOr500(c, err, "Съдържанието не беше заредено")
	}
	isOwn := u != nil && item.OwnerID == u.ID
	if !isOwn && (item.Visibility != contentitem.VisibilityPublic || item.Status != contentitem.StatusActive) {
		return nil, fiber.NewError(fiber.StatusNotFound, "Не е намерено")
	}
	return item, nil
}

// CopyContent duplicates a public (or own) item into the user's private library.
func CopyContent(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	source, err := visibleContent(c)
	if err != nil {
		return err
	}
	if err := checkContentQuota(c, u, contentitem.VisibilityPrivate); err != nil {
		return err
	}
	sourceID := source.ID
	item, err := db.Client.ContentItem.Create().
		SetOwnerID(u.ID).
		SetKind(source.Kind).
		SetTitle(source.Title).
		SetBody(source.Body).
		SetCategory(source.Category).
		SetNillableDifficulty(source.Difficulty).
		SetTags(source.Tags).
		SetData(source.Data).
		SetVisibility(contentitem.VisibilityPrivate).
		SetSourceID(sourceID).
		Save(c.Context())
	if err != nil {
		return serverError(c, err, "Копирането не беше успешно")
	}
	if source.OwnerID != u.ID {
		_ = db.Client.ContentItem.UpdateOneID(source.ID).AddCopiesCount(1).Exec(c.Context())
	}
	item.Edges.Owner = u
	return c.Status(fiber.StatusCreated).JSON(contentDTO(item, u, false))
}

// ToggleFavorite adds/removes a favorite; counters update in one transaction.
func ToggleFavorite(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	item, err := visibleContent(c)
	if err != nil {
		return err
	}
	ctx := c.Context()
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		return serverError(c, err, "Неуспешно действие")
	}
	deleted, err := tx.ContentFavorite.Delete().
		Where(contentfavorite.UserIDEQ(u.ID), contentfavorite.ContentIDEQ(item.ID)).
		Exec(ctx)
	if err != nil {
		_ = tx.Rollback()
		return serverError(c, err, "Неуспешно действие")
	}
	favorite := false
	if deleted > 0 {
		err = tx.ContentItem.UpdateOneID(item.ID).AddFavoritesCount(-1).Exec(ctx)
	} else {
		favorite = true
		if err = tx.ContentFavorite.Create().SetUserID(u.ID).SetContentID(item.ID).Exec(ctx); err == nil {
			err = tx.ContentItem.UpdateOneID(item.ID).AddFavoritesCount(1).Exec(ctx)
		}
	}
	if err != nil {
		_ = tx.Rollback()
		return serverError(c, err, "Неуспешно действие")
	}
	if err := tx.Commit(); err != nil {
		return serverError(c, err, "Неуспешно действие")
	}
	count := item.FavoritesCount + utils.Tnry(favorite, 1, -1)
	return c.JSON(fiber.Map{"isFavorite": favorite, "favoritesCount": max(count, 0)})
}

type reportBody struct {
	Reason string `json:"reason"`
}

// ReportContent records one report per user; repeated reports auto-hide the item.
func ReportContent(c fiber.Ctx) error {
	u := helpers.CurrentUser(c)
	item, err := visibleContent(c)
	if err != nil {
		return err
	}
	if item.OwnerID == u.ID {
		return badRequest(utils.Invalid("Не можете да докладвате собствено съдържание"))
	}
	var body reportBody
	_ = c.Bind().JSON(&body)
	err = db.Client.ContentReport.Create().
		SetReporterID(u.ID).
		SetContentID(item.ID).
		SetReason(utils.CleanText(body.Reason, 200)).
		Exec(c.Context())
	if err != nil {
		if gen.IsConstraintError(err) {
			return c.JSON(fiber.Map{"message": "Вече сте докладвали това съдържание"})
		}
		return serverError(c, err, "Докладът не беше изпратен")
	}
	upd := db.Client.ContentItem.UpdateOneID(item.ID).AddReportsCount(1)
	if item.ReportsCount+1 >= reportsBeforeAutoHide {
		upd.SetStatus(contentitem.StatusHidden)
	}
	_ = upd.Exec(c.Context())
	return c.JSON(fiber.Map{"message": "Благодарим! Ще прегледаме съдържанието."})
}

// AdminListReported lists content with reports for moderation.
func AdminListReported(c fiber.Ctx) error {
	q := db.Client.ContentItem.Query().
		Where(contentitem.ReportsCountGT(0)).
		Order(gen.Desc(contentitem.FieldReportsCount))
	return listContentResponse(c, q, helpers.CurrentUser(c))
}

type moderateBody struct {
	Status string `json:"status"`
}

func AdminModerateContent(c fiber.Ctx) error {
	var body moderateBody
	if err := bindJSON(c, &body); err != nil {
		return err
	}
	status := contentitem.Status(body.Status)
	if contentitem.StatusValidator(status) != nil {
		return badRequest(utils.Invalid("Невалиден статус"))
	}
	upd := db.Client.ContentItem.UpdateOneID(c.Params("id")).SetStatus(status)
	if status == contentitem.StatusActive {
		upd.SetReportsCount(0)
	}
	item, err := upd.Save(c.Context())
	if err != nil {
		return notFoundOr500(c, err, "Неуспешно действие")
	}
	return c.JSON(contentDTO(item, helpers.CurrentUser(c), false))
}

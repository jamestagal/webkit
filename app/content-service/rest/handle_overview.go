package rest

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// --- Response types ---

type overviewResponse struct {
	Crawl         crawlOverview         `json:"crawl"`
	SEO           seoOverview           `json:"seo"`
	Copy          copyOverview          `json:"copy"`
	Brand         brandOverview         `json:"brand"`
	Questionnaire questionnaireOverview `json:"questionnaire"`
	Activity      []activityItem        `json:"activity"`
}

type crawlOverview struct {
	TotalPages    int        `json:"total_pages"`
	LastCrawledAt *time.Time `json:"last_crawled_at"`
	Status        string     `json:"status"`
	SourceURL     string     `json:"source_url,omitempty"`
}

type seoOverview struct {
	Critical int `json:"critical"`
	Warnings int `json:"warnings"`
	Notices  int `json:"notices"`
	Score    int `json:"score"`
}

type copyOverview struct {
	Total  int            `json:"total"`
	Drafts int            `json:"drafts"`
	Finals int            `json:"finals"`
	ByType map[string]int `json:"by_type"`
}

type brandOverview struct {
	HasProfile  bool       `json:"has_profile"`
	SourceType  string     `json:"source_type,omitempty"`
	LastUpdated *time.Time `json:"last_updated,omitempty"`
}

type questionnaireOverview struct {
	Completed bool `json:"completed"`
}

type activityItem struct {
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	CreatedAt time.Time      `json:"created_at"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// --- Handler ---

func (h *Handler) handleGetOverview(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	// Validate client ownership
	var clientExists bool
	err = h.db.QueryRowContext(r.Context(),
		"SELECT EXISTS(SELECT 1 FROM clients WHERE id = $1 AND agency_id = $2)",
		clientID, agencyID,
	).Scan(&clientExists)
	if err != nil {
		slog.Error("Error checking client ownership", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	if !clientExists {
		writeJSON(w, http.StatusNotFound, errorResponse("client not found"))
		return
	}

	ctx := r.Context()
	var wg sync.WaitGroup
	var crawlErr, seoErr, copyErr, brandErr, questionnaireErr, activityErr error

	var result overviewResponse
	result.Copy.ByType = make(map[string]int)
	result.Activity = make([]activityItem, 0)

	wg.Add(6)

	go func() {
		defer wg.Done()
		crawlErr = h.fetchCrawlOverview(ctx, clientID, &result.Crawl)
	}()

	go func() {
		defer wg.Done()
		seoErr = h.fetchSEOOverview(ctx, clientID, &result.SEO)
	}()

	go func() {
		defer wg.Done()
		copyErr = h.fetchCopyOverview(ctx, clientID, agencyID, &result.Copy)
	}()

	go func() {
		defer wg.Done()
		brandErr = h.fetchBrandOverview(ctx, clientID, agencyID, &result.Brand)
	}()

	go func() {
		defer wg.Done()
		questionnaireErr = h.fetchQuestionnaireOverview(ctx, clientID, agencyID, &result.Questionnaire)
	}()

	go func() {
		defer wg.Done()
		activityErr = h.fetchActivityFeed(ctx, clientID, agencyID, &result.Activity)
	}()

	wg.Wait()

	// Log errors but return partial data
	if crawlErr != nil {
		slog.Warn("Error fetching crawl overview", "error", crawlErr, "client_id", clientID)
	}
	if seoErr != nil {
		slog.Warn("Error fetching SEO overview", "error", seoErr, "client_id", clientID)
	}
	if copyErr != nil {
		slog.Warn("Error fetching copy overview", "error", copyErr, "client_id", clientID)
	}
	if brandErr != nil {
		slog.Warn("Error fetching brand overview", "error", brandErr, "client_id", clientID)
	}
	if questionnaireErr != nil {
		slog.Warn("Error fetching questionnaire overview", "error", questionnaireErr, "client_id", clientID)
	}
	if activityErr != nil {
		slog.Warn("Error fetching activity feed", "error", activityErr, "client_id", clientID)
	}

	writeJSON(w, http.StatusOK, successResponse(result))
}

// --- Query methods ---

func (h *Handler) fetchCrawlOverview(ctx context.Context, clientID uuid.UUID, out *crawlOverview) error {
	var totalPages int
	var lastCrawledAt sql.NullTime

	err := h.db.QueryRowContext(ctx,
		"SELECT COUNT(*), MAX(created_at) FROM content_pages WHERE client_id = $1",
		clientID,
	).Scan(&totalPages, &lastCrawledAt)
	if err != nil {
		return err
	}

	out.TotalPages = totalPages
	if lastCrawledAt.Valid {
		out.LastCrawledAt = &lastCrawledAt.Time
	}

	// Get latest crawl job status and source URL
	var status sql.NullString
	var sourceURL sql.NullString
	err = h.db.QueryRowContext(ctx,
		"SELECT status, source_url FROM content_crawl_jobs WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1",
		clientID,
	).Scan(&status, &sourceURL)
	if err == sql.ErrNoRows {
		out.Status = "none"
		return nil
	}
	if err != nil {
		return err
	}
	if status.Valid {
		out.Status = status.String
	} else {
		out.Status = "none"
	}
	if sourceURL.Valid {
		out.SourceURL = sourceURL.String
	}

	return nil
}

func (h *Handler) fetchSEOOverview(ctx context.Context, clientID uuid.UUID, out *seoOverview) error {
	// First check if a completed audit exists at all
	var auditExists bool
	err := h.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM seo_audits WHERE client_id = $1 AND status = 'complete')`,
		clientID,
	).Scan(&auditExists)
	if err != nil {
		return err
	}

	// No audit run yet — return zeroes (not "perfect score")
	if !auditExists {
		return nil
	}

	rows, err := h.db.QueryContext(ctx,
		`SELECT severity, COUNT(*) FROM seo_issues si
		 JOIN seo_audits sa ON si.audit_id = sa.id
		 WHERE sa.client_id = $1 AND sa.status = 'complete'
		 AND sa.id = (SELECT id FROM seo_audits WHERE client_id = $1 AND status = 'complete' ORDER BY completed_at DESC LIMIT 1)
		 GROUP BY severity`,
		clientID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var severity string
		var count int
		if err := rows.Scan(&severity, &count); err != nil {
			return err
		}
		switch severity {
		case "critical":
			out.Critical = count
		case "warning":
			out.Warnings = count
		case "notice":
			out.Notices = count
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// Score = 100 - (critical*10 + warnings*3 + notices*1), clamped 0-100
	score := 100 - (out.Critical*10 + out.Warnings*3 + out.Notices*1)
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	out.Score = score

	return nil
}

func (h *Handler) fetchCopyOverview(ctx context.Context, clientID, agencyID uuid.UUID, out *copyOverview) error {
	rows, err := h.db.QueryContext(ctx,
		`SELECT copy_type, status, COUNT(*) FROM content_copy
		 WHERE client_id = $1 AND agency_id = $2
		 GROUP BY copy_type, status`,
		clientID, agencyID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	if out.ByType == nil {
		out.ByType = make(map[string]int)
	}

	for rows.Next() {
		var copyType, status string
		var count int
		if err := rows.Scan(&copyType, &status, &count); err != nil {
			return err
		}

		out.Total += count
		out.ByType[copyType] += count

		switch status {
		case "draft":
			out.Drafts += count
		case "final":
			out.Finals += count
		}
	}

	return rows.Err()
}

func (h *Handler) fetchBrandOverview(ctx context.Context, clientID, agencyID uuid.UUID, out *brandOverview) error {
	var sourceType sql.NullString
	var updatedAt sql.NullTime

	err := h.db.QueryRowContext(ctx,
		`SELECT source_type, updated_at FROM brand_profiles
		 WHERE client_id = $1 AND agency_id = $2 AND is_active = true
		 LIMIT 1`,
		clientID, agencyID,
	).Scan(&sourceType, &updatedAt)

	if err == sql.ErrNoRows {
		out.HasProfile = false
		return nil
	}
	if err != nil {
		return err
	}

	out.HasProfile = true
	if sourceType.Valid {
		out.SourceType = sourceType.String
	}
	if updatedAt.Valid {
		out.LastUpdated = &updatedAt.Time
	}

	return nil
}

func (h *Handler) fetchQuestionnaireOverview(ctx context.Context, clientID, agencyID uuid.UUID, out *questionnaireOverview) error {
	return h.db.QueryRowContext(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM consultations
			WHERE client_id = $1 AND agency_id = $2 AND status = 'completed'
		)`,
		clientID, agencyID,
	).Scan(&out.Completed)
}

func (h *Handler) fetchActivityFeed(ctx context.Context, clientID, agencyID uuid.UUID, activity *[]activityItem) error {
	items := make([]activityItem, 0, 20)

	// Copy activity
	copyRows, err := h.db.QueryContext(ctx,
		`SELECT title, copy_type, created_at FROM content_copy
		 WHERE client_id = $1 AND agency_id = $2
		 ORDER BY created_at DESC LIMIT 10`,
		clientID, agencyID,
	)
	if err != nil {
		return err
	}
	defer copyRows.Close()

	for copyRows.Next() {
		var item activityItem
		var copyType string
		if err := copyRows.Scan(&item.Title, &copyType, &item.CreatedAt); err != nil {
			return err
		}
		item.Type = "copy_generated"
		item.Metadata = map[string]any{"copy_type": copyType}
		items = append(items, item)
	}
	if err := copyRows.Err(); err != nil {
		return err
	}

	// Crawl activity
	crawlRows, err := h.db.QueryContext(ctx,
		`SELECT url, created_at FROM content_pages
		 WHERE client_id = $1
		 ORDER BY created_at DESC LIMIT 5`,
		clientID,
	)
	if err != nil {
		return err
	}
	defer crawlRows.Close()

	for crawlRows.Next() {
		var item activityItem
		if err := crawlRows.Scan(&item.Title, &item.CreatedAt); err != nil {
			return err
		}
		item.Type = "page_crawled"
		items = append(items, item)
	}
	if err := crawlRows.Err(); err != nil {
		return err
	}

	// Brand activity
	brandRows, err := h.db.QueryContext(ctx,
		`SELECT source_type, updated_at FROM brand_profiles
		 WHERE client_id = $1 AND agency_id = $2
		 ORDER BY updated_at DESC LIMIT 5`,
		clientID, agencyID,
	)
	if err != nil {
		return err
	}
	defer brandRows.Close()

	for brandRows.Next() {
		var item activityItem
		var sourceType string
		if err := brandRows.Scan(&sourceType, &item.CreatedAt); err != nil {
			return err
		}
		item.Type = "brand_updated"
		item.Title = "Brand Profile"
		item.Metadata = map[string]any{"source_type": sourceType}
		items = append(items, item)
	}
	if err := brandRows.Err(); err != nil {
		return err
	}

	// Sort by created_at DESC, take top 20
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	if len(items) > 20 {
		items = items[:20]
	}

	*activity = items
	return nil
}

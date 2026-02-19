package rest

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"
)

// --- Request/Response types ---

type startCrawlRequest struct {
	ClientID    string `json:"client_id"`
	SourceURL   string `json:"source_url"`
	MaxDepth    *int   `json:"max_depth,omitempty"`
	CrawlType   string `json:"crawl_type,omitempty"`
	CrawlTarget string `json:"crawl_target,omitempty"`
}

type crawlJobResponse struct {
	ID              string     `json:"id"`
	AgencyID        string     `json:"agency_id"`
	ClientID        string     `json:"client_id"`
	Status          string     `json:"status"`
	SourceURL       string     `json:"source_url"`
	CrawlTarget     string     `json:"crawl_target"`
	CrawlType       string     `json:"crawl_type"`
	PagesDiscovered int        `json:"pages_discovered"`
	PagesProcessed  int        `json:"pages_processed"`
	PagesChanged    int        `json:"pages_changed"`
	MaxDepth        int        `json:"max_depth"`
	ErrorMessage    *string    `json:"error_message,omitempty"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type pageResponse struct {
	ID                       string     `json:"id"`
	ClientID                 string     `json:"client_id"`
	CrawlJobID               *string    `json:"crawl_job_id,omitempty"`
	URL                      string     `json:"url"`
	CanonicalURL             *string    `json:"canonical_url,omitempty"`
	SourceType               string     `json:"source_type"`
	PageType                 string     `json:"page_type"`
	ClassificationConfidence float64    `json:"classification_confidence"`
	ClassificationMethod     *string    `json:"classification_method,omitempty"`
	Title                    *string    `json:"title,omitempty"`
	MetaDescription          *string    `json:"meta_description,omitempty"`
	WordCount                int        `json:"word_count"`
	ReadingTimeMinutes       int        `json:"reading_time_minutes"`
	HTTPStatus               *int       `json:"http_status,omitempty"`
	ContentHash              *string    `json:"content_hash,omitempty"`
	HasCanonical             bool       `json:"has_canonical"`
	HasRobotsMeta            bool       `json:"has_robots_meta"`
	InternalLinksCount       int        `json:"internal_links_count"`
	ExternalLinksCount       int        `json:"external_links_count"`
	ImageCount               int        `json:"image_count"`
	ImagesMissingAlt         int        `json:"images_missing_alt"`
	FirstScrapedAt           time.Time  `json:"first_scraped_at"`
	LastScrapedAt            time.Time  `json:"last_scraped_at"`
	ContentChangedAt         *time.Time `json:"content_changed_at,omitempty"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`
}

type updatePageRequest struct {
	PageType string `json:"page_type"`
}

type natsCrawlMessage struct {
	JobID       string `json:"job_id"`
	AgencyID    string `json:"agency_id"`
	ClientID    string `json:"client_id"`
	SourceURL   string `json:"source_url"`
	MaxDepth    int    `json:"max_depth"`
	CrawlType   string `json:"crawl_type"`
	CrawlTarget string `json:"crawl_target"`
}

// --- Handlers ---

func (h *Handler) handleStartCrawl(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	var req startCrawlRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	// Parse and validate client_id
	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client_id format"))
		return
	}

	// Validate source_url
	if req.SourceURL == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse("source_url is required"))
		return
	}
	parsedURL, err := url.Parse(req.SourceURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid source_url: must be a valid HTTP/HTTPS URL"))
		return
	}

	// Verify client belongs to agency
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

	// Duplicate guard: check for active crawl jobs
	var activeJobID string
	err = h.db.QueryRowContext(r.Context(),
		"SELECT id FROM content_crawl_jobs WHERE client_id = $1 AND status NOT IN ('complete', 'failed') LIMIT 1",
		clientID,
	).Scan(&activeJobID)
	if err == nil {
		// Active job exists
		writeJSON(w, http.StatusConflict, errorResponse("a crawl job is already running for this client"))
		return
	}
	if err != sql.ErrNoRows {
		slog.Error("Error checking for active crawl jobs", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	// Apply defaults
	maxDepth := 3
	if req.MaxDepth != nil && *req.MaxDepth > 0 {
		maxDepth = *req.MaxDepth
	}
	crawlType := "full"
	if req.CrawlType == "incremental" || req.CrawlType == "targeted" {
		crawlType = req.CrawlType
	}
	crawlTarget := "client"
	if req.CrawlTarget == "competitor" {
		crawlTarget = req.CrawlTarget
	}

	// Insert crawl job
	jobID := uuid.New()
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO content_crawl_jobs (id, agency_id, client_id, status, source_url, crawl_target, max_depth, crawl_type)
		 VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)`,
		jobID, agencyID, clientID, req.SourceURL, crawlTarget, maxDepth, crawlType,
	)
	if err != nil {
		slog.Error("Error inserting crawl job", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to create crawl job"))
		return
	}

	// Publish to NATS
	natsMsg := natsCrawlMessage{
		JobID:       jobID.String(),
		AgencyID:    agencyID.String(),
		ClientID:    clientID.String(),
		SourceURL:   req.SourceURL,
		MaxDepth:    maxDepth,
		CrawlType:   crawlType,
		CrawlTarget: crawlTarget,
	}
	msgBytes, _ := json.Marshal(natsMsg)

	if err := h.natsConn.Publish("content.crawl.start", msgBytes); err != nil {
		slog.Error("Error publishing crawl start message", "error", err)
		// Job is created but NATS publish failed — don't fail the request,
		// the job can be picked up on retry
	}

	writeJSON(w, http.StatusAccepted, successResponse(map[string]string{"id": jobID.String()}))
}

func (h *Handler) handleGetCrawlStatus(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	jobID, err := uuid.Parse(r.PathValue("jobId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid job ID format"))
		return
	}

	var job crawlJobResponse
	var errorMsg sql.NullString
	var startedAt, completedAt sql.NullTime

	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, agency_id, client_id, status, source_url, crawl_target, crawl_type,
			pages_discovered, pages_processed, pages_changed, max_depth,
			error_message, started_at, completed_at, created_at, updated_at
		 FROM content_crawl_jobs WHERE id = $1 AND agency_id = $2`,
		jobID, agencyID,
	).Scan(
		&job.ID, &job.AgencyID, &job.ClientID, &job.Status, &job.SourceURL,
		&job.CrawlTarget, &job.CrawlType, &job.PagesDiscovered, &job.PagesProcessed,
		&job.PagesChanged, &job.MaxDepth, &errorMsg, &startedAt, &completedAt,
		&job.CreatedAt, &job.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, errorResponse("crawl job not found"))
		return
	}
	if err != nil {
		slog.Error("Error fetching crawl job", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	if errorMsg.Valid {
		job.ErrorMessage = &errorMsg.String
	}
	if startedAt.Valid {
		job.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		job.CompletedAt = &completedAt.Time
	}

	writeJSON(w, http.StatusOK, successResponse(job))
}

func (h *Handler) handleCancelCrawl(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	jobID, err := uuid.Parse(r.PathValue("jobId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid job ID format"))
		return
	}

	result, err := h.db.ExecContext(r.Context(),
		`UPDATE content_crawl_jobs
		 SET status = 'failed', error_message = 'cancelled by user', updated_at = NOW()
		 WHERE id = $1 AND agency_id = $2 AND status NOT IN ('complete', 'failed')`,
		jobID, agencyID,
	)
	if err != nil {
		slog.Error("Error cancelling crawl job", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeJSON(w, http.StatusNotFound, errorResponse("crawl job not found or already completed"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(map[string]string{"status": "cancelled"}))
}

func (h *Handler) handleGetPages(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT cp.id, cp.client_id, cp.crawl_job_id, cp.url, cp.canonical_url,
			cp.source_type, cp.page_type, cp.classification_confidence, cp.classification_method,
			cp.title, cp.meta_description, cp.word_count, cp.reading_time_minutes,
			cp.http_status, cp.content_hash, cp.has_canonical, cp.has_robots_meta,
			cp.internal_links_count, cp.external_links_count,
			cp.image_count, cp.images_missing_alt,
			cp.first_scraped_at, cp.last_scraped_at, cp.content_changed_at,
			cp.created_at, cp.updated_at
		 FROM content_pages cp
		 JOIN clients c ON cp.client_id = c.id
		 WHERE cp.client_id = $1 AND c.agency_id = $2
		 ORDER BY cp.created_at DESC`,
		clientID, agencyID,
	)
	if err != nil {
		slog.Error("Error fetching pages", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	defer rows.Close()

	pages := make([]pageResponse, 0)
	for rows.Next() {
		var p pageResponse
		var crawlJobID, canonicalURL, classMethod, title, metaDesc, contentHash sql.NullString
		var httpStatus sql.NullInt32
		var contentChangedAt sql.NullTime

		err := rows.Scan(
			&p.ID, &p.ClientID, &crawlJobID, &p.URL, &canonicalURL,
			&p.SourceType, &p.PageType, &p.ClassificationConfidence, &classMethod,
			&title, &metaDesc, &p.WordCount, &p.ReadingTimeMinutes,
			&httpStatus, &contentHash, &p.HasCanonical, &p.HasRobotsMeta,
			&p.InternalLinksCount, &p.ExternalLinksCount,
			&p.ImageCount, &p.ImagesMissingAlt,
			&p.FirstScrapedAt, &p.LastScrapedAt, &contentChangedAt,
			&p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			slog.Error("Error scanning page row", "error", err)
			continue
		}

		if crawlJobID.Valid {
			p.CrawlJobID = &crawlJobID.String
		}
		if canonicalURL.Valid {
			p.CanonicalURL = &canonicalURL.String
		}
		if classMethod.Valid {
			p.ClassificationMethod = &classMethod.String
		}
		if title.Valid {
			p.Title = &title.String
		}
		if metaDesc.Valid {
			p.MetaDescription = &metaDesc.String
		}
		if httpStatus.Valid {
			v := int(httpStatus.Int32)
			p.HTTPStatus = &v
		}
		if contentHash.Valid {
			p.ContentHash = &contentHash.String
		}
		if contentChangedAt.Valid {
			p.ContentChangedAt = &contentChangedAt.Time
		}

		pages = append(pages, p)
	}
	if err := rows.Err(); err != nil {
		slog.Error("Error iterating page rows", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(pages))
}

func (h *Handler) handleGetPage(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	pageID, err := uuid.Parse(r.PathValue("pageId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid page ID format"))
		return
	}

	var p pageResponse
	var crawlJobID, canonicalURL, classMethod, title, metaDesc, contentHash sql.NullString
	var httpStatus sql.NullInt32
	var contentChangedAt sql.NullTime

	err = h.db.QueryRowContext(r.Context(),
		`SELECT cp.id, cp.client_id, cp.crawl_job_id, cp.url, cp.canonical_url,
			cp.source_type, cp.page_type, cp.classification_confidence, cp.classification_method,
			cp.title, cp.meta_description, cp.word_count, cp.reading_time_minutes,
			cp.http_status, cp.content_hash, cp.has_canonical, cp.has_robots_meta,
			cp.internal_links_count, cp.external_links_count,
			cp.image_count, cp.images_missing_alt,
			cp.first_scraped_at, cp.last_scraped_at, cp.content_changed_at,
			cp.created_at, cp.updated_at
		 FROM content_pages cp
		 JOIN clients c ON cp.client_id = c.id
		 WHERE cp.id = $1 AND cp.client_id = $2 AND c.agency_id = $3`,
		pageID, clientID, agencyID,
	).Scan(
		&p.ID, &p.ClientID, &crawlJobID, &p.URL, &canonicalURL,
		&p.SourceType, &p.PageType, &p.ClassificationConfidence, &classMethod,
		&title, &metaDesc, &p.WordCount, &p.ReadingTimeMinutes,
		&httpStatus, &contentHash, &p.HasCanonical, &p.HasRobotsMeta,
		&p.InternalLinksCount, &p.ExternalLinksCount,
		&p.ImageCount, &p.ImagesMissingAlt,
		&p.FirstScrapedAt, &p.LastScrapedAt, &contentChangedAt,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, errorResponse("page not found"))
		return
	}
	if err != nil {
		slog.Error("Error fetching page", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	if crawlJobID.Valid {
		p.CrawlJobID = &crawlJobID.String
	}
	if canonicalURL.Valid {
		p.CanonicalURL = &canonicalURL.String
	}
	if classMethod.Valid {
		p.ClassificationMethod = &classMethod.String
	}
	if title.Valid {
		p.Title = &title.String
	}
	if metaDesc.Valid {
		p.MetaDescription = &metaDesc.String
	}
	if httpStatus.Valid {
		v := int(httpStatus.Int32)
		p.HTTPStatus = &v
	}
	if contentHash.Valid {
		p.ContentHash = &contentHash.String
	}
	if contentChangedAt.Valid {
		p.ContentChangedAt = &contentChangedAt.Time
	}

	writeJSON(w, http.StatusOK, successResponse(p))
}

func (h *Handler) handleUpdatePage(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	pageID, err := uuid.Parse(r.PathValue("pageId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid page ID format"))
		return
	}

	var req updatePageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	// Validate page_type
	validTypes := map[string]bool{
		"homepage": true, "about": true, "service": true, "product": true,
		"blog_post": true, "case_study": true, "testimonial": true,
		"contact": true, "team": true, "faq": true, "landing": true,
		"category": true, "portfolio": true, "news": true, "other": true, "unknown": true,
	}
	if !validTypes[req.PageType] {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid page_type"))
		return
	}

	result, err := h.db.ExecContext(r.Context(),
		`UPDATE content_pages SET page_type = $1, classification_method = 'manual', updated_at = NOW()
		 WHERE id = $2 AND client_id = $3 AND client_id IN (SELECT id FROM clients WHERE agency_id = $4)`,
		req.PageType, pageID, clientID, agencyID,
	)
	if err != nil {
		slog.Error("Error updating page", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeJSON(w, http.StatusNotFound, errorResponse("page not found"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(map[string]string{"status": "updated"}))
}

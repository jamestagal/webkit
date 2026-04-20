package rest

import (
	"app/pkg/usage"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"content-service/internal/jobs"
	"content-service/internal/report"

	"github.com/google/uuid"
)

// --- Request/Response types ---

type auditResponse struct {
	ID             string          `json:"id"`
	AgencyID       string          `json:"agency_id"`
	ClientID       string          `json:"client_id"`
	CrawlJobID     *string         `json:"crawl_job_id"`
	Status         string          `json:"status"`
	OverallScore   *int            `json:"overall_score"`
	TechnicalScore *int            `json:"technical_score"`
	ContentScore   *int            `json:"content_score"`
	BacklinkScore  *int            `json:"backlink_score"`
	KeywordScore   *int            `json:"keyword_score"`
	TotalPages     int             `json:"total_pages"`
	CriticalIssues int             `json:"critical_issues"`
	WarningIssues  int             `json:"warning_issues"`
	PassedChecks   int             `json:"passed_checks"`
	Opportunities  int             `json:"opportunities"`
	Progress        json.RawMessage `json:"progress,omitempty"`
	PerformanceData json.RawMessage `json:"performance_data,omitempty"`
	StartedAt       *time.Time      `json:"started_at,omitempty"`
	CompletedAt    *time.Time      `json:"completed_at,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type issueResponse struct {
	ID               string    `json:"id"`
	AuditID          string    `json:"audit_id"`
	PageID           *string   `json:"page_id,omitempty"`
	PageURL          *string   `json:"page_url,omitempty"`
	ClientID         string    `json:"client_id"`
	Category         string    `json:"category"`
	Severity         string    `json:"severity"`
	CheckName        string    `json:"check_name"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	CurrentValue     *string   `json:"current_value,omitempty"`
	RecommendedValue *string   `json:"recommended_value,omitempty"`
	Impact           *string   `json:"impact,omitempty"`
	AIFixAvailable   bool      `json:"ai_fix_available"`
	CreatedAt        time.Time `json:"created_at"`
}

type backlinkProfileResponse struct {
	ID                      string          `json:"id"`
	ClientID                string          `json:"client_id"`
	AuditID                 string          `json:"audit_id"`
	TotalBacklinks          int64           `json:"total_backlinks"`
	ReferringDomains        int             `json:"referring_domains"`
	DofollowLinks           int             `json:"dofollow_links"`
	NofollowLinks           int             `json:"nofollow_links"`
	DomainRank              float64         `json:"domain_rank"`
	SpamScore               float64         `json:"spam_score"`
	TopReferringDomains     json.RawMessage `json:"top_referring_domains"`
	AnchorTextDistribution  json.RawMessage `json:"anchor_text_distribution"`
	LinkTypeDistribution    json.RawMessage `json:"link_type_distribution"`
	FetchedAt               time.Time       `json:"fetched_at"`
	CreatedAt               time.Time       `json:"created_at"`
}

type keywordProfileResponse struct {
	ID                   string          `json:"id"`
	ClientID             string          `json:"client_id"`
	AuditID              string          `json:"audit_id"`
	RankingKeywords      json.RawMessage `json:"ranking_keywords"`
	TotalRankingKeywords int             `json:"total_ranking_keywords"`
	KeywordsTop3         int             `json:"keywords_top_3"`
	KeywordsTop10        int             `json:"keywords_top_10"`
	KeywordsTop50        int             `json:"keywords_top_50"`
	TotalKeywordGaps     int             `json:"total_keyword_gaps"`
	EstimatedTraffic     float64         `json:"estimated_traffic"`
	FetchedAt            time.Time       `json:"fetched_at"`
	CreatedAt            time.Time       `json:"created_at"`
}

type competitorAnalysisResponse struct {
	ID                   string          `json:"id"`
	ClientID             string          `json:"client_id"`
	AuditID              string          `json:"audit_id"`
	CompetitorDomain     string          `json:"competitor_domain"`
	DomainRank           float64         `json:"domain_rank"`
	TotalBacklinks       int64           `json:"total_backlinks"`
	ReferringDomains     int             `json:"referring_domains"`
	TotalRankingKeywords int             `json:"total_ranking_keywords"`
	EstimatedTraffic     float64         `json:"estimated_traffic"`
	CommonKeywords       int             `json:"common_keywords"`
	UniqueKeywords       int             `json:"unique_keywords"`
	Comparison           json.RawMessage `json:"comparison"`
	FetchedAt            time.Time       `json:"fetched_at"`
	CreatedAt            time.Time       `json:"created_at"`
}

type paginatedIssuesResponse struct {
	Items      []issueResponse `json:"items"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	PerPage    int             `json:"per_page"`
	TotalPages int             `json:"total_pages"`
}

// --- Handlers ---

// startAuditRequest is the optional JSON body for POST /api/content/audit/{clientId}.
// Region + language are used downstream to select the DataForSEO location code.
type startAuditRequest struct {
	TargetRegion   string `json:"target_region"`
	TargetLanguage string `json:"target_language"`
}

func validateTargetRegion(region string) bool {
	switch region {
	case "", "au", "us", "uk", "nz", "ca":
		return true
	}
	return false
}

func validateTargetLanguage(lang string) bool {
	switch lang {
	case "", "en":
		return true
	}
	return false
}

// handleStartAudit starts an SEO audit for a client.
// POST /api/content/audit/{clientId}
// Body (optional): { "target_region": "au|us|uk|nz|ca", "target_language": "en" }
func (h *Handler) handleStartAudit(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	// Parse optional request body for region/language.
	var req startAuditRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
			return
		}
	}
	if !validateTargetRegion(req.TargetRegion) {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid target_region"))
		return
	}
	if !validateTargetLanguage(req.TargetLanguage) {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid target_language"))
		return
	}
	if req.TargetRegion == "" {
		req.TargetRegion = "au"
	}
	if req.TargetLanguage == "" {
		req.TargetLanguage = "en"
	}

	// Verify client belongs to agency.
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

	// Check for active audit (pending or running).
	var activeAuditID string
	err = h.db.QueryRowContext(r.Context(),
		"SELECT id FROM seo_audits WHERE client_id = $1 AND status IN ('pending', 'running') LIMIT 1",
		clientID,
	).Scan(&activeAuditID)
	if err == nil {
		writeJSON(w, http.StatusConflict, errorResponse("an audit is already in progress for this client"))
		return
	}
	if err != sql.ErrNoRows {
		slog.Error("Error checking for active audit", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	// Enforce monthly SEO-audit cap (spec §8). Atomic check+increment.
	if _, err := h.usage.Consume(r.Context(), agencyID, usage.FeatureSEOAudit); err != nil {
		if writeUsageError(w, err) {
			return
		}
		slog.Error("Error consuming SEO audit quota", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	// Get latest crawl_job_id (optional — audits can run without a prior crawl).
	var crawlJobID *uuid.UUID
	var cjid uuid.UUID
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id FROM content_crawl_jobs
		 WHERE client_id = $1 AND status = 'complete' AND crawl_target = 'client'
		 ORDER BY completed_at DESC LIMIT 1`,
		clientID,
	).Scan(&cjid)
	if err == nil {
		crawlJobID = &cjid
	} else if err != sql.ErrNoRows {
		slog.Error("Error getting latest crawl job", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	// If err == sql.ErrNoRows, crawlJobID stays nil — audit proceeds without crawl data.

	// Insert the audit.
	auditID := uuid.New()
	_, err = h.db.ExecContext(r.Context(),
		`INSERT INTO seo_audits (id, agency_id, client_id, crawl_job_id, status, target_region, target_language)
		 VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
		auditID, agencyID, clientID, crawlJobID, req.TargetRegion, req.TargetLanguage,
	)
	if err != nil {
		slog.Error("Error inserting audit", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to create audit"))
		return
	}

	// Publish NATS message.
	natsMsg := jobs.AuditStartMsg{
		AuditID:  auditID.String(),
		AgencyID: agencyID.String(),
		ClientID: clientID.String(),
	}
	msgBytes, _ := json.Marshal(natsMsg)

	if err := h.natsConn.Publish("content.audit.start", msgBytes); err != nil {
		slog.Error("Error publishing audit start message", "error", err)
		// Audit is created but NATS publish failed; it can be retried.
	}

	writeJSON(w, http.StatusAccepted, successResponse(map[string]string{"id": auditID.String()}))
}

// handleGetAudit returns details of a specific SEO audit.
// GET /api/content/audit/{auditId}
func (h *Handler) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	auditID, err := uuid.Parse(r.PathValue("auditId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid audit ID format"))
		return
	}

	var audit auditResponse
	var overallScore, technicalScore, contentScore, backlinkScore, keywordScore sql.NullInt32
	var startedAt, completedAt sql.NullTime
	var crawlJobID sql.NullString
	var progressJSON, performanceJSON []byte

	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, agency_id, client_id, crawl_job_id, status,
			overall_score, technical_score, content_score, backlink_score, keyword_score,
			total_pages, critical_issues, warning_issues, passed_checks, opportunities,
			progress, performance_data,
			started_at, completed_at, created_at, updated_at
		 FROM seo_audits WHERE id = $1 AND agency_id = $2`,
		auditID, agencyID,
	).Scan(
		&audit.ID, &audit.AgencyID, &audit.ClientID, &crawlJobID, &audit.Status,
		&overallScore, &technicalScore, &contentScore, &backlinkScore, &keywordScore,
		&audit.TotalPages, &audit.CriticalIssues, &audit.WarningIssues, &audit.PassedChecks, &audit.Opportunities,
		&progressJSON, &performanceJSON,
		&startedAt, &completedAt, &audit.CreatedAt, &audit.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, errorResponse("audit not found"))
		return
	}
	if err != nil {
		slog.Error("Error fetching audit", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	if overallScore.Valid {
		v := int(overallScore.Int32)
		audit.OverallScore = &v
	}
	if technicalScore.Valid {
		v := int(technicalScore.Int32)
		audit.TechnicalScore = &v
	}
	if contentScore.Valid {
		v := int(contentScore.Int32)
		audit.ContentScore = &v
	}
	if backlinkScore.Valid {
		v := int(backlinkScore.Int32)
		audit.BacklinkScore = &v
	}
	if keywordScore.Valid {
		v := int(keywordScore.Int32)
		audit.KeywordScore = &v
	}
	if crawlJobID.Valid {
		audit.CrawlJobID = &crawlJobID.String
	}
	if len(progressJSON) > 0 {
		audit.Progress = progressJSON
	}
	if len(performanceJSON) > 0 && string(performanceJSON) != "{}" {
		audit.PerformanceData = performanceJSON
	}
	if startedAt.Valid {
		audit.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		audit.CompletedAt = &completedAt.Time
	}

	writeJSON(w, http.StatusOK, successResponse(audit))
}

// handleGetAuditIssues returns paginated, filtered SEO issues for an audit.
// GET /api/content/audit/{auditId}/issues?category=&severity=&page=1&per_page=50
func (h *Handler) handleGetAuditIssues(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	auditID, err := uuid.Parse(r.PathValue("auditId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid audit ID format"))
		return
	}

	// Verify audit belongs to agency.
	var auditExists bool
	err = h.db.QueryRowContext(r.Context(),
		"SELECT EXISTS(SELECT 1 FROM seo_audits WHERE id = $1 AND agency_id = $2)",
		auditID, agencyID,
	).Scan(&auditExists)
	if err != nil {
		slog.Error("Error checking audit ownership", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	if !auditExists {
		writeJSON(w, http.StatusNotFound, errorResponse("audit not found"))
		return
	}

	// Parse query parameters.
	category := r.URL.Query().Get("category")
	severity := r.URL.Query().Get("severity")

	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	perPage := 50
	if pp := r.URL.Query().Get("per_page"); pp != "" {
		if v, err := strconv.Atoi(pp); err == nil && v > 0 && v <= 100 {
			perPage = v
		}
	}

	offset := (page - 1) * perPage

	// Build dynamic query with filters.
	baseWhere := "WHERE si.audit_id = $1"
	args := []any{auditID}
	argIdx := 2

	if category != "" {
		baseWhere += " AND si.category = $" + strconv.Itoa(argIdx)
		args = append(args, category)
		argIdx++
	}
	if severity != "" {
		baseWhere += " AND si.severity = $" + strconv.Itoa(argIdx)
		args = append(args, severity)
		argIdx++
	}

	// Get total count.
	var total int
	countQuery := "SELECT COUNT(*) FROM seo_issues si " + baseWhere
	err = h.db.QueryRowContext(r.Context(), countQuery, args...).Scan(&total)
	if err != nil {
		slog.Error("Error counting audit issues", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	// Get paginated results with page URL from content_pages join.
	selectQuery := `SELECT si.id, si.audit_id, si.page_id, cp.url, si.client_id,
		si.category, si.severity, si.check_name, si.title, si.description,
		si.current_value, si.recommended_value, si.impact, si.ai_fix_available, si.created_at
		FROM seo_issues si
		LEFT JOIN content_pages cp ON si.page_id = cp.id ` + baseWhere +
		" ORDER BY CASE si.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 WHEN 'info' THEN 3 ELSE 4 END, si.created_at DESC" +
		" LIMIT $" + strconv.Itoa(argIdx) + " OFFSET $" + strconv.Itoa(argIdx+1)
	args = append(args, perPage, offset)

	rows, err := h.db.QueryContext(r.Context(), selectQuery, args...)
	if err != nil {
		slog.Error("Error querying audit issues", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	defer rows.Close()

	issues := make([]issueResponse, 0)
	for rows.Next() {
		var issue issueResponse
		var pageID, pageURL, currentValue, recommendedValue, impact sql.NullString

		err := rows.Scan(
			&issue.ID, &issue.AuditID, &pageID, &pageURL, &issue.ClientID,
			&issue.Category, &issue.Severity, &issue.CheckName,
			&issue.Title, &issue.Description,
			&currentValue, &recommendedValue, &impact,
			&issue.AIFixAvailable, &issue.CreatedAt,
		)
		if err != nil {
			slog.Error("Error scanning issue row", "error", err)
			continue
		}

		if pageID.Valid && pageID.String != "00000000-0000-0000-0000-000000000000" {
			issue.PageID = &pageID.String
		}
		if pageURL.Valid {
			issue.PageURL = &pageURL.String
		}
		if currentValue.Valid {
			issue.CurrentValue = &currentValue.String
		}
		if recommendedValue.Valid {
			issue.RecommendedValue = &recommendedValue.String
		}
		if impact.Valid {
			issue.Impact = &impact.String
		}

		issues = append(issues, issue)
	}
	if err := rows.Err(); err != nil {
		slog.Error("Error iterating issue rows", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}

	writeJSON(w, http.StatusOK, successResponse(paginatedIssuesResponse{
		Items:      issues,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	}))
}

// handleGetAuditBacklinks returns the backlink profile for an audit.
// GET /api/content/audit/{auditId}/backlinks
func (h *Handler) handleGetAuditBacklinks(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	auditID, err := uuid.Parse(r.PathValue("auditId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid audit ID format"))
		return
	}

	var bp backlinkProfileResponse
	var topRefDomains, anchorDist, linkTypeDist []byte
	var newLostTrend sql.NullString

	err = h.db.QueryRowContext(r.Context(),
		`SELECT bp.id, bp.client_id, bp.audit_id, bp.total_backlinks, bp.referring_domains,
			bp.dofollow_links, bp.nofollow_links, bp.domain_rank, bp.spam_score,
			bp.top_referring_domains, bp.anchor_text_distribution, bp.link_type_distribution,
			bp.new_lost_trend, bp.fetched_at, bp.created_at
		 FROM backlink_profiles bp
		 JOIN seo_audits sa ON bp.audit_id = sa.id
		 WHERE bp.audit_id = $1 AND sa.agency_id = $2`,
		auditID, agencyID,
	).Scan(
		&bp.ID, &bp.ClientID, &bp.AuditID, &bp.TotalBacklinks, &bp.ReferringDomains,
		&bp.DofollowLinks, &bp.NofollowLinks, &bp.DomainRank, &bp.SpamScore,
		&topRefDomains, &anchorDist, &linkTypeDist,
		&newLostTrend, &bp.FetchedAt, &bp.CreatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, errorResponse("backlink profile not found"))
		return
	}
	if err != nil {
		slog.Error("Error fetching backlink profile", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	bp.TopReferringDomains = topRefDomains
	bp.AnchorTextDistribution = anchorDist
	bp.LinkTypeDistribution = linkTypeDist

	writeJSON(w, http.StatusOK, successResponse(bp))
}

// handleGetAuditKeywords returns the keyword profile for an audit.
// GET /api/content/audit/{auditId}/keywords
func (h *Handler) handleGetAuditKeywords(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	auditID, err := uuid.Parse(r.PathValue("auditId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid audit ID format"))
		return
	}

	var kp keywordProfileResponse
	var rankingKeywords []byte
	var keywordGaps, cannibalization sql.NullString

	err = h.db.QueryRowContext(r.Context(),
		`SELECT kp.id, kp.client_id, kp.audit_id, kp.ranking_keywords,
			kp.keyword_gaps, kp.cannibalization,
			kp.total_ranking_keywords, kp.keywords_top_3, kp.keywords_top_10, kp.keywords_top_50,
			kp.total_keyword_gaps, kp.estimated_traffic,
			kp.fetched_at, kp.created_at
		 FROM keyword_profiles kp
		 JOIN seo_audits sa ON kp.audit_id = sa.id
		 WHERE kp.audit_id = $1 AND sa.agency_id = $2`,
		auditID, agencyID,
	).Scan(
		&kp.ID, &kp.ClientID, &kp.AuditID, &rankingKeywords,
		&keywordGaps, &cannibalization,
		&kp.TotalRankingKeywords, &kp.KeywordsTop3, &kp.KeywordsTop10, &kp.KeywordsTop50,
		&kp.TotalKeywordGaps, &kp.EstimatedTraffic,
		&kp.FetchedAt, &kp.CreatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, errorResponse("keyword profile not found"))
		return
	}
	if err != nil {
		slog.Error("Error fetching keyword profile", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	kp.RankingKeywords = rankingKeywords

	writeJSON(w, http.StatusOK, successResponse(kp))
}

// handleGetAuditCompetitors returns competitor analyses for an audit.
// GET /api/content/audit/{auditId}/competitors
func (h *Handler) handleGetAuditCompetitors(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	auditID, err := uuid.Parse(r.PathValue("auditId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid audit ID format"))
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT ca.id, ca.client_id, ca.audit_id, ca.competitor_domain,
			ca.domain_rank, ca.total_backlinks, ca.referring_domains,
			ca.total_ranking_keywords, ca.estimated_traffic,
			ca.common_keywords, ca.unique_keywords, ca.comparison,
			ca.fetched_at, ca.created_at
		 FROM competitor_analyses ca
		 JOIN seo_audits sa ON ca.audit_id = sa.id
		 WHERE ca.audit_id = $1 AND sa.agency_id = $2
		 ORDER BY ca.estimated_traffic DESC`,
		auditID, agencyID,
	)
	if err != nil {
		slog.Error("Error fetching competitor analyses", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	defer rows.Close()

	competitors := make([]competitorAnalysisResponse, 0)
	for rows.Next() {
		var ca competitorAnalysisResponse
		var comparison []byte

		err := rows.Scan(
			&ca.ID, &ca.ClientID, &ca.AuditID, &ca.CompetitorDomain,
			&ca.DomainRank, &ca.TotalBacklinks, &ca.ReferringDomains,
			&ca.TotalRankingKeywords, &ca.EstimatedTraffic,
			&ca.CommonKeywords, &ca.UniqueKeywords, &comparison,
			&ca.FetchedAt, &ca.CreatedAt,
		)
		if err != nil {
			slog.Error("Error scanning competitor analysis row", "error", err)
			continue
		}

		ca.Comparison = comparison
		competitors = append(competitors, ca)
	}
	if err := rows.Err(); err != nil {
		slog.Error("Error iterating competitor rows", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(competitors))
}

// handleGenerateAuditReport generates a PDF report for an audit.
// POST /api/content/audit/{auditId}/report
func (h *Handler) handleGenerateAuditReport(w http.ResponseWriter, r *http.Request) {
	if h.cfg.GotenbergURL == "" {
		writeJSON(w, http.StatusServiceUnavailable, errorResponse("PDF generation is not configured"))
		return
	}

	agencyID := getAgencyID(r)

	auditID, err := uuid.Parse(r.PathValue("auditId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid audit ID format"))
		return
	}

	// Verify audit exists, belongs to agency, and is complete. Also fetch client name for filename.
	var auditStatus string
	var clientID uuid.UUID
	err = h.db.QueryRowContext(r.Context(),
		"SELECT status, client_id FROM seo_audits WHERE id = $1 AND agency_id = $2",
		auditID, agencyID,
	).Scan(&auditStatus, &clientID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, errorResponse("audit not found"))
		return
	}
	if err != nil {
		slog.Error("Error checking audit for report", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	if auditStatus != "complete" {
		writeJSON(w, http.StatusBadRequest, errorResponse(fmt.Sprintf("audit is not complete (status: %s)", auditStatus)))
		return
	}

	// Enforce monthly PDF-export cap (every Gotenberg render counts).
	if _, err := h.usage.Consume(r.Context(), agencyID, usage.FeaturePDFExport); err != nil {
		if writeUsageError(w, err) {
			return
		}
		slog.Error("Error consuming PDF export quota", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	// Fetch client name for the filename.
	var clientName string
	_ = h.db.QueryRowContext(r.Context(),
		"SELECT business_name FROM clients WHERE id = $1",
		clientID,
	).Scan(&clientName)

	pdfBytes, err := report.GenerateAuditPDF(r.Context(), h.db, h.cfg.GotenbergURL, agencyID, auditID)
	if err != nil {
		slog.Error("Error generating audit PDF", "audit_id", auditID, "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to generate PDF report"))
		return
	}

	// Build filename: "seo-audit-plentify.pdf" or "seo-audit-report.pdf" as fallback.
	filename := "seo-audit-report.pdf"
	if clientName != "" {
		// Sanitise: lowercase, replace spaces with hyphens, remove non-alphanumeric chars.
		safe := strings.ToLower(strings.TrimSpace(clientName))
		safe = strings.ReplaceAll(safe, " ", "-")
		safeBuf := make([]byte, 0, len(safe))
		for i := 0; i < len(safe); i++ {
			c := safe[i]
			if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' {
				safeBuf = append(safeBuf, c)
			}
		}
		if len(safeBuf) > 0 {
			filename = fmt.Sprintf("seo-audit-%s.pdf", string(safeBuf))
		}
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.WriteHeader(http.StatusOK)
	w.Write(pdfBytes)
}

package rest

import (
	"content-service/internal/embeddings"
	"content-service/internal/generator"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// --- Request types ---

type generateSocialRequest struct {
	ClientID     string  `json:"client_id"`
	PageID       *string `json:"page_id,omitempty"`
	Platform     string  `json:"platform"`
	Topic        string  `json:"topic"`
	PostGoal     string  `json:"post_goal,omitempty"`
	ToneOverride string  `json:"tone_override,omitempty"`
}

// Valid post goals for social media generation.
var validPostGoals = map[string]bool{
	"engagement": true,
	"traffic":    true,
	"awareness":  true,
	"promotion":  true,
}

// Valid social media platforms.
var validPlatforms = map[string]bool{
	"twitter":   true,
	"linkedin":  true,
	"facebook":  true,
	"instagram": true,
}

func (h *Handler) handleGenerateSocial(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)
	userID := getUserID(r)

	var req generateSocialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	// Parse client_id.
	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client_id format"))
		return
	}

	// Parse optional page_id.
	var pageID *uuid.UUID
	if req.PageID != nil && *req.PageID != "" {
		parsed, err := uuid.Parse(*req.PageID)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse("invalid page_id format"))
			return
		}
		pageID = &parsed
	}

	// Validate platform.
	if !validPlatforms[req.Platform] {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid platform: must be twitter, linkedin, facebook, or instagram"))
		return
	}

	// Validate topic (required).
	if req.Topic == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse("topic is required"))
		return
	}

	// Validate post_goal if provided.
	if req.PostGoal != "" && !validPostGoals[req.PostGoal] {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid post_goal: must be engagement, traffic, awareness, or promotion"))
		return
	}

	// Validate client ownership.
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

	// Create generator and run synchronously.
	embedClient := embeddings.NewClient(h.cfg.CFAccountID, h.cfg.CFAPIToken)
	gen := generator.New(h.db, h.cfg.AnthropicAPIKey, embedClient)

	result, err := gen.GenerateSocial(r.Context(), generator.SocialRequest{
		AgencyID:     agencyID,
		ClientID:     clientID,
		PageID:       pageID,
		Platform:     req.Platform,
		Topic:        req.Topic,
		PostGoal:     req.PostGoal,
		ToneOverride: req.ToneOverride,
		GeneratedBy:  userID,
	})
	if err != nil {
		slog.Error("Error generating social posts", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to generate social posts"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(result))
}

// socialCopyResponse extends copyResponse with generation_config.
type socialCopyResponse struct {
	ID               string     `json:"id"`
	ClientID         string     `json:"client_id"`
	AgencyID         string     `json:"agency_id"`
	PageID           *string    `json:"page_id,omitempty"`
	GeneratedBy      string     `json:"generated_by"`
	CopyType         string     `json:"copy_type"`
	Title            string     `json:"title"`
	Content          string     `json:"content"`
	TargetKeyword    *string    `json:"target_keyword,omitempty"`
	TargetWordCount  *int       `json:"target_word_count,omitempty"`
	ActualWordCount  int        `json:"actual_word_count"`
	SEOScore         *float64   `json:"seo_score,omitempty"`
	ReadabilityScore *float64   `json:"readability_score,omitempty"`
	Status           string     `json:"status"`
	PromptTokens     int        `json:"prompt_tokens"`
	CompletionTokens int        `json:"completion_tokens"`
	ModelUsed        *string    `json:"model_used,omitempty"`
	GenerationConfig *string    `json:"generation_config,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (h *Handler) handleGetSocialPosts(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	// Build query with optional filters.
	query := `SELECT id, client_id, agency_id, page_id, generated_by, copy_type,
	                 title, content, target_keyword, target_word_count, actual_word_count,
	                 seo_score, readability_score, status, prompt_tokens, completion_tokens,
	                 model_used, generation_config, created_at, updated_at
	          FROM content_copy
	          WHERE client_id = $1 AND agency_id = $2 AND copy_type = 'social_post'`
	args := []any{clientID, agencyID}
	argIdx := 3

	// Optional platform filter.
	if platform := r.URL.Query().Get("platform"); platform != "" {
		query += fmt.Sprintf(" AND generation_config->>'platform' = $%d", argIdx)
		args = append(args, platform)
		argIdx++
	}

	// Optional page_id filter.
	if pid := r.URL.Query().Get("page_id"); pid != "" {
		pageID, err := uuid.Parse(pid)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse("invalid page_id format"))
			return
		}
		query += fmt.Sprintf(" AND page_id = $%d", argIdx)
		args = append(args, pageID)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	// Pagination (default: 50, max: 100).
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		slog.Error("Error fetching social posts", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	defer rows.Close()

	posts := make([]socialCopyResponse, 0)
	for rows.Next() {
		var c socialCopyResponse
		var pageID, targetKeyword, modelUsed, genConfig sql.NullString
		var targetWordCount sql.NullInt32
		var seoScore, readabilityScore sql.NullFloat64

		err := rows.Scan(
			&c.ID, &c.ClientID, &c.AgencyID, &pageID, &c.GeneratedBy, &c.CopyType,
			&c.Title, &c.Content, &targetKeyword, &targetWordCount, &c.ActualWordCount,
			&seoScore, &readabilityScore, &c.Status, &c.PromptTokens, &c.CompletionTokens,
			&modelUsed, &genConfig, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			slog.Error("Error scanning social post row", "error", err)
			continue
		}

		if pageID.Valid {
			c.PageID = &pageID.String
		}
		if targetKeyword.Valid {
			c.TargetKeyword = &targetKeyword.String
		}
		if targetWordCount.Valid {
			v := int(targetWordCount.Int32)
			c.TargetWordCount = &v
		}
		if seoScore.Valid {
			c.SEOScore = &seoScore.Float64
		}
		if readabilityScore.Valid {
			c.ReadabilityScore = &readabilityScore.Float64
		}
		if modelUsed.Valid {
			c.ModelUsed = &modelUsed.String
		}
		if genConfig.Valid {
			c.GenerationConfig = &genConfig.String
		}

		posts = append(posts, c)
	}
	if err := rows.Err(); err != nil {
		slog.Error("Error iterating social post rows", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(posts))
}

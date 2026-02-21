package rest

import (
	"content-service/internal/export"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// --- Response types ---

type copyResponse struct {
	ID              string     `json:"id"`
	ClientID        string     `json:"client_id"`
	AgencyID        string     `json:"agency_id"`
	PageID          *string    `json:"page_id,omitempty"`
	GeneratedBy     string     `json:"generated_by"`
	CopyType        string     `json:"copy_type"`
	Title           string     `json:"title"`
	Content         string     `json:"content"`
	TargetKeyword   *string    `json:"target_keyword,omitempty"`
	TargetWordCount *int       `json:"target_word_count,omitempty"`
	ActualWordCount int        `json:"actual_word_count"`
	SEOScore        *float64   `json:"seo_score,omitempty"`
	ReadabilityScore *float64  `json:"readability_score,omitempty"`
	Status          string     `json:"status"`
	PromptTokens    int        `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	ModelUsed       *string    `json:"model_used,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type updateCopyRequest struct {
	Content *string `json:"content,omitempty"`
	Title   *string `json:"title,omitempty"`
	Status  *string `json:"status,omitempty"`
}

func (h *Handler) handleGetCopyVersions(w http.ResponseWriter, r *http.Request) {
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
	                 model_used, created_at, updated_at
	          FROM content_copy
	          WHERE client_id = $1 AND agency_id = $2`
	args := []any{clientID, agencyID}
	argIdx := 3

	// Optional copy_type filter.
	if ct := r.URL.Query().Get("copy_type"); ct != "" {
		query += fmt.Sprintf(" AND copy_type = $%d", argIdx)
		args = append(args, ct)
		argIdx++
	}

	// Optional status filter.
	if st := r.URL.Query().Get("status"); st != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, st)
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
		slog.Error("Error fetching copy versions", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}
	defer rows.Close()

	copies := make([]copyResponse, 0)
	for rows.Next() {
		var c copyResponse
		var pageID, targetKeyword, modelUsed sql.NullString
		var targetWordCount sql.NullInt32
		var seoScore, readabilityScore sql.NullFloat64

		err := rows.Scan(
			&c.ID, &c.ClientID, &c.AgencyID, &pageID, &c.GeneratedBy, &c.CopyType,
			&c.Title, &c.Content, &targetKeyword, &targetWordCount, &c.ActualWordCount,
			&seoScore, &readabilityScore, &c.Status, &c.PromptTokens, &c.CompletionTokens,
			&modelUsed, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			slog.Error("Error scanning copy row", "error", err)
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

		copies = append(copies, c)
	}
	if err := rows.Err(); err != nil {
		slog.Error("Error iterating copy rows", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(copies))
}

func (h *Handler) handleUpdateCopy(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	copyID, err := uuid.Parse(r.PathValue("copyId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid copy ID format"))
		return
	}

	var req updateCopyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	// Validate status if provided.
	if req.Status != nil {
		if *req.Status != "draft" && *req.Status != "final" {
			writeJSON(w, http.StatusBadRequest, errorResponse("status must be 'draft' or 'final'"))
			return
		}
	}

	// Build dynamic UPDATE.
	setClauses := []string{"updated_at = NOW()"}
	args := []any{}
	argIdx := 1

	if req.Content != nil {
		setClauses = append(setClauses, fmt.Sprintf("content = $%d", argIdx))
		args = append(args, *req.Content)
		argIdx++

		// Recalculate word count.
		setClauses = append(setClauses, fmt.Sprintf("actual_word_count = $%d", argIdx))
		args = append(args, len(strings.Fields(*req.Content)))
		argIdx++
	}
	if req.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}

	if len(args) == 0 {
		writeJSON(w, http.StatusBadRequest, errorResponse("no fields to update"))
		return
	}

	query := fmt.Sprintf(
		"UPDATE content_copy SET %s WHERE id = $%d AND agency_id = $%d",
		strings.Join(setClauses, ", "),
		argIdx,
		argIdx+1,
	)
	args = append(args, copyID, agencyID)

	result, err := h.db.ExecContext(r.Context(), query, args...)
	if err != nil {
		slog.Error("Error updating copy", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeJSON(w, http.StatusNotFound, errorResponse("copy not found"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(map[string]string{"status": "updated"}))
}

func (h *Handler) handleDeleteCopy(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	copyID, err := uuid.Parse(r.PathValue("copyId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid copy ID format"))
		return
	}

	result, err := h.db.ExecContext(r.Context(),
		"DELETE FROM content_copy WHERE id = $1 AND agency_id = $2 AND status = 'draft'",
		copyID, agencyID,
	)
	if err != nil {
		slog.Error("Error deleting copy", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeJSON(w, http.StatusNotFound, errorResponse("copy not found or not in draft status"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(map[string]string{"status": "deleted"}))
}

func (h *Handler) handleExportCopy(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	var req export.ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	result, err := export.Export(r.Context(), h.db, h.cfg.GotenbergURL, agencyID, clientID, req)
	if err != nil {
		slog.Error("Error exporting copy", "error", err, "format", req.Format, "scope", req.Scope)
		writeJSON(w, http.StatusInternalServerError, errorResponse("export failed: "+err.Error()))
		return
	}

	w.Header().Set("Content-Type", result.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, result.Filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(result.Data)))
	w.WriteHeader(http.StatusOK)

	if _, err := w.Write(result.Data); err != nil {
		slog.Error("Error writing export response", "error", err)
	}
}

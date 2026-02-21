package rest

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"content-service/internal/embeddings"
	"content-service/internal/generator"

	"github.com/google/uuid"
)

// --- Request/Response types ---

type generateCopyRequest struct {
	ClientID        string  `json:"client_id"`
	PageID          *string `json:"page_id,omitempty"`
	CopyType        string  `json:"copy_type"`
	TargetKeyword   string  `json:"target_keyword,omitempty"`
	TargetWordCount int     `json:"target_word_count,omitempty"`
	Notes           string  `json:"notes,omitempty"`
}

type generateMetaRequest struct {
	ClientID      string `json:"client_id"`
	PageID        string `json:"page_id"`
	TargetKeyword string `json:"target_keyword,omitempty"`
}

type generateStructureRequest struct {
	ClientID string `json:"client_id"`
}

type generateBulkRequest struct {
	ClientID       string   `json:"client_id"`
	PageIDs        []string `json:"page_ids"`
	CopyType       string   `json:"copy_type"`
	TargetKeywords []string `json:"target_keywords,omitempty"`
}

// Valid copy types for generation.
var validCopyTypes = map[string]bool{
	"page_rewrite":        true,
	"new_page":            true,
	"meta_title":          true,
	"meta_description":    true,
	"h1_suggestion":       true,
	"section":             true,
	"blog_post":           true,
	"product_description": true,
	"cta":                 true,
	"site_structure":      true,
	"social_post":        true,
}

func (h *Handler) handleGenerateCopy(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)
	userID := getUserID(r)

	var req generateCopyRequest
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

	// Validate copy_type.
	if !validCopyTypes[req.CopyType] {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid copy_type"))
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

	// Create generator and run synchronously.
	embedClient := embeddings.NewClient(h.cfg.CFAccountID, h.cfg.CFAPIToken)
	gen := generator.New(h.db, h.cfg.AnthropicAPIKey, embedClient)

	result, err := gen.GenerateCopy(r.Context(), generator.CopyRequest{
		ClientID:        clientID,
		AgencyID:        agencyID,
		PageID:          pageID,
		CopyType:        req.CopyType,
		TargetKeyword:   req.TargetKeyword,
		TargetWordCount: req.TargetWordCount,
		Notes:           req.Notes,
		GeneratedBy:     userID,
	})
	if err != nil {
		slog.Error("Error generating copy", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to generate copy"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(result))
}

func (h *Handler) handleGenerateMeta(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)
	userID := getUserID(r)

	var req generateMetaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client_id format"))
		return
	}

	pageID, err := uuid.Parse(req.PageID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid page_id format"))
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

	embedClient := embeddings.NewClient(h.cfg.CFAccountID, h.cfg.CFAPIToken)
	gen := generator.New(h.db, h.cfg.AnthropicAPIKey, embedClient)

	result, err := gen.GenerateMeta(r.Context(), clientID, agencyID, pageID, req.TargetKeyword, userID)
	if err != nil {
		slog.Error("Error generating meta", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to generate meta tags"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(result))
}

func (h *Handler) handleGenerateStructure(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)
	userID := getUserID(r)

	var req generateStructureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client_id format"))
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

	embedClient := embeddings.NewClient(h.cfg.CFAccountID, h.cfg.CFAPIToken)
	gen := generator.New(h.db, h.cfg.AnthropicAPIKey, embedClient)

	result, err := gen.GenerateCopy(r.Context(), generator.CopyRequest{
		ClientID:    clientID,
		AgencyID:    agencyID,
		CopyType:    "site_structure",
		GeneratedBy: userID,
	})
	if err != nil {
		slog.Error("Error generating site structure", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to generate site structure"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(result))
}

func (h *Handler) handleGenerateBulk(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)
	userID := getUserID(r)

	var req generateBulkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client_id format"))
		return
	}

	if len(req.PageIDs) == 0 {
		writeJSON(w, http.StatusBadRequest, errorResponse("page_ids is required and must not be empty"))
		return
	}

	if !validCopyTypes[req.CopyType] {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid copy_type"))
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

	// Publish NATS GenerateBulkMsg.
	bulkMsg := struct {
		AgencyID       string   `json:"agency_id"`
		ClientID       string   `json:"client_id"`
		PageIDs        []string `json:"page_ids"`
		CopyType       string   `json:"copy_type"`
		TargetKeywords []string `json:"target_keywords,omitempty"`
		GeneratedBy    string   `json:"generated_by"`
	}{
		AgencyID:       agencyID.String(),
		ClientID:       clientID.String(),
		PageIDs:        req.PageIDs,
		CopyType:       req.CopyType,
		TargetKeywords: req.TargetKeywords,
		GeneratedBy:    userID.String(),
	}

	msgBytes, err := json.Marshal(bulkMsg)
	if err != nil {
		slog.Error("Error marshaling bulk generate message", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	if err := h.natsConn.Publish("content.generate.bulk", msgBytes); err != nil {
		slog.Error("Error publishing bulk generate message", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to queue bulk generation"))
		return
	}

	writeJSON(w, http.StatusAccepted, successResponse(map[string]any{
		"message":   "bulk generation queued",
		"page_count": len(req.PageIDs),
	}))
}

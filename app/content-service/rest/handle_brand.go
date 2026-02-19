package rest

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"content-service/internal/jobs"

	"github.com/google/uuid"
)

// --- Response types ---

type brandProfileResponse struct {
	ID              string          `json:"id"`
	ClientID        string          `json:"client_id"`
	AgencyID        string          `json:"agency_id"`
	Version         int             `json:"version"`
	IsActive        bool            `json:"is_active"`
	Profile         json.RawMessage `json:"profile"`
	SourceType      string          `json:"source_type"`
	SourcePageCount int             `json:"source_page_count"`
	GeneratedAt     *time.Time      `json:"generated_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type updateBrandProfileRequest struct {
	Profile json.RawMessage `json:"profile"`
}

// --- Handlers ---

func (h *Handler) handleGetBrandProfile(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
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

	// Query active brand profile
	var resp brandProfileResponse
	var generatedAt sql.NullTime

	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, client_id, agency_id, version, is_active, profile, source_type,
			source_page_count, generated_at, created_at, updated_at
		 FROM brand_profiles
		 WHERE client_id = $1 AND agency_id = $2 AND is_active = true`,
		clientID, agencyID,
	).Scan(
		&resp.ID, &resp.ClientID, &resp.AgencyID, &resp.Version, &resp.IsActive,
		&resp.Profile, &resp.SourceType, &resp.SourcePageCount,
		&generatedAt, &resp.CreatedAt, &resp.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, errorResponse("no active brand profile found"))
		return
	}
	if err != nil {
		slog.Error("Error fetching brand profile", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	if generatedAt.Valid {
		resp.GeneratedAt = &generatedAt.Time
	}

	writeJSON(w, http.StatusOK, successResponse(resp))
}

func (h *Handler) handleGenerateBrandProfile(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
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

	// Publish NATS message to trigger async generation
	msg := jobs.ProfileGenerateMsg{
		AgencyID: agencyID.String(),
		ClientID: clientID.String(),
	}
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		slog.Error("Error marshaling profile generate message", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	if err := h.natsConn.Publish(jobs.SubjectProfileGenerate, msgBytes); err != nil {
		slog.Error("Error publishing profile generate message", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("failed to queue profile generation"))
		return
	}

	writeJSON(w, http.StatusAccepted, successResponse(map[string]string{
		"status":    "queued",
		"client_id": clientID.String(),
	}))
}

func (h *Handler) handleUpdateBrandProfile(w http.ResponseWriter, r *http.Request) {
	agencyID := getAgencyID(r)

	clientID, err := uuid.Parse(r.PathValue("clientId"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid client ID format"))
		return
	}

	var req updateBrandProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse("invalid request body"))
		return
	}

	if len(req.Profile) == 0 {
		writeJSON(w, http.StatusBadRequest, errorResponse("profile is required"))
		return
	}

	// Validate that profile is valid JSON
	if !json.Valid(req.Profile) {
		writeJSON(w, http.StatusBadRequest, errorResponse("profile must be valid JSON"))
		return
	}

	result, err := h.db.ExecContext(r.Context(),
		`UPDATE brand_profiles
		 SET profile = $1, source_type = 'manual', updated_at = NOW()
		 WHERE client_id = $2 AND agency_id = $3 AND is_active = true`,
		req.Profile, clientID, agencyID,
	)
	if err != nil {
		slog.Error("Error updating brand profile", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		writeJSON(w, http.StatusNotFound, errorResponse("no active brand profile found for this client"))
		return
	}

	writeJSON(w, http.StatusOK, successResponse(map[string]string{"status": "updated"}))
}

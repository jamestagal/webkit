package rest

import (
	"app/pkg"
	"app/pkg/usage"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// writeUsageError maps usage sentinel errors to HTTP responses matching the
// Safe<T> wrapper writeResponse uses. Returns true when it handled the error.
func writeUsageError(h *Handler, w http.ResponseWriter, r *http.Request, err error) bool {
	switch {
	case errors.Is(err, usage.ErrLimitExceeded):
		// 429 with reset hint.
		now := time.Now().UTC()
		reset := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success":    false,
			"message":    err.Error(),
			"code":       429,
			"reset_date": reset.Format(time.RFC3339),
		})
		return true
	case errors.Is(err, usage.ErrFeatureDisabled):
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "this feature is not available on your plan",
		})
		return true
	}
	return false
}

// requireAgencyID extracts and parses the agencyId query param (shared by
// usage routes). Mirrors the existing billing_route.go pattern — SvelteKit
// is the trusted caller and has already enforced "user X has access to
// agency Y" before invoking these endpoints.
func requireAgencyID(h *Handler, w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	raw := r.URL.Query().Get("agencyId")
	if raw == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "agencyId is required"})
		return uuid.Nil, false
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "invalid agencyId"})
		return uuid.Nil, false
	}
	return id, true
}

// handleUsageCheck returns the current Status for a feature (no increment).
// GET /api/v1/usage/check?agencyId=...&feature=seo_audit
func (h *Handler) handleUsageCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	agencyID, ok := requireAgencyID(h, w, r)
	if !ok {
		return
	}
	feature := r.URL.Query().Get("feature")
	if feature == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "feature is required"})
		return
	}

	status, err := h.usageService.Check(r.Context(), agencyID, usage.Feature(feature))
	if err != nil {
		if writeUsageError(h, w, r, err) {
			return
		}
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: fmt.Sprintf("check usage: %v", err)})
		return
	}

	writeResponse(h.cfg, w, r, status, nil)
}

// handleUsageSummary returns current Status for every metered feature.
// GET /api/v1/usage/summary?agencyId=...
func (h *Handler) handleUsageSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	agencyID, ok := requireAgencyID(h, w, r)
	if !ok {
		return
	}

	statuses, err := h.usageService.Summary(r.Context(), agencyID)
	if err != nil {
		if writeUsageError(h, w, r, err) {
			return
		}
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: fmt.Sprintf("summary usage: %v", err)})
		return
	}

	writeResponse(h.cfg, w, r, statuses, nil)
}

// UsageConsumeRequest is the POST body for /api/v1/usage/consume.
// Body-as-JSON because mutating operations shouldn't live in query strings.
type UsageConsumeRequest struct {
	AgencyID string `json:"agencyId"`
	Feature  string `json:"feature"`
}

// handleUsageConsume atomically increments the counter. SvelteKit PDF routes
// hit this before calling Gotenberg so the cap is enforced in one place —
// Go remains SSoT for the increment, the TS helper is a thin client.
// POST /api/v1/usage/consume  {agencyId, feature}
func (h *Handler) handleUsageConsume(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	var body UsageConsumeRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "invalid request body"})
		return
	}

	agencyID, err := uuid.Parse(body.AgencyID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "invalid agencyId"})
		return
	}
	if body.Feature == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "feature is required"})
		return
	}

	status, err := h.usageService.Consume(r.Context(), agencyID, usage.Feature(body.Feature))
	if err != nil {
		if writeUsageError(h, w, r, err) {
			return
		}
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: fmt.Sprintf("consume usage: %v", err)})
		return
	}

	writeResponse(h.cfg, w, r, status, nil)
}

package rest

import (
	"app/pkg"
	"encoding/json"
	"io"
	"net/http"

	"github.com/google/uuid"
)

// BillingCheckoutRequest represents the request body for creating a checkout session
type BillingCheckoutRequest struct {
	AgencyID   string `json:"agencyId"`
	AgencySlug string `json:"agencySlug"`
	AgencyName string `json:"agencyName"`
	Email      string `json:"email"`
	Tier       string `json:"tier"`
	Interval   string `json:"interval"` // "month" or "year"
}

// BillingUpgradeRequest represents the request body for upgrading a subscription
type BillingUpgradeRequest struct {
	AgencyID string `json:"agencyId"`
	Tier     string `json:"tier"`
	Interval string `json:"interval"` // "month" or "year"
}

// handleBillingInfo returns the billing info for an agency.
// If sessionId is provided, it will auto-sync from Stripe if DB is behind.
func (h *Handler) handleBillingInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	agencyIDStr := r.URL.Query().Get("agencyId")
	if agencyIDStr == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "agencyId is required"})
		return
	}

	agencyID, err := uuid.Parse(agencyIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid agencyId"})
		return
	}

	// Optional: sessionId for auto-sync after checkout
	sessionID := r.URL.Query().Get("sessionId")

	info, err := h.billingService.GetBillingInfo(r.Context(), agencyID, sessionID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, info, nil)
}

// handleBillingCheckout creates a Stripe Checkout session for subscription
func (h *Handler) handleBillingCheckout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	var req BillingCheckoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
		return
	}

	agencyID, err := uuid.Parse(req.AgencyID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid agencyId"})
		return
	}

	// Validate required fields
	if req.Tier == "" || req.Interval == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "tier and interval are required"})
		return
	}

	response, err := h.billingService.CreateCheckoutSession(
		r.Context(),
		agencyID,
		req.AgencySlug,
		req.Email,
		req.AgencyName,
		req.Tier,
		req.Interval,
	)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, response, nil)
}

// handleBillingPortal creates a Stripe Billing Portal session
func (h *Handler) handleBillingPortal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	agencyIDStr := r.URL.Query().Get("agencyId")
	agencySlug := r.URL.Query().Get("agencySlug")

	if agencyIDStr == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "agencyId is required"})
		return
	}

	agencyID, err := uuid.Parse(agencyIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid agencyId"})
		return
	}

	response, err := h.billingService.CreatePortalSession(r.Context(), agencyID, agencySlug)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, response, nil)
}

// handleBillingSessionStatus returns the status of a checkout session from Stripe
func (h *Handler) handleBillingSessionStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "sessionId is required"})
		return
	}

	status, err := h.billingService.GetCheckoutSessionStatus(r.Context(), sessionID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, status, nil)
}

// handleBillingUpgrade upgrades an existing subscription with proration
func (h *Handler) handleBillingUpgrade(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	var req BillingUpgradeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
		return
	}

	agencyID, err := uuid.Parse(req.AgencyID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid agencyId"})
		return
	}

	// Validate required fields
	if req.Tier == "" || req.Interval == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "tier and interval are required"})
		return
	}

	err = h.billingService.UpgradeSubscription(
		r.Context(),
		agencyID,
		req.Tier,
		req.Interval,
	)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Return success - webhook will update the database
	writeResponse(h.cfg, w, r, map[string]bool{"success": true}, nil)
}

// handleBillingSyncSession syncs subscription from a completed checkout session
func (h *Handler) handleBillingSyncSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "sessionId is required"})
		return
	}

	err := h.billingService.SyncSubscriptionFromSession(r.Context(), sessionID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, map[string]bool{"success": true}, nil)
}

// handleBillingWebhook processes Stripe billing webhooks
func (h *Handler) handleBillingWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	const MaxBodyBytes = int64(65536)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Error reading request body",
			Err:     err,
		})
		return
	}

	signature := r.Header.Get("Stripe-Signature")
	err = h.billingService.HandleWebhook(r.Context(), payload, signature)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Return 200 OK to acknowledge receipt
	w.WriteHeader(http.StatusOK)
}

package rest

import (
	"app/pkg"
	"app/pkg/auth"
	"encoding/json"
	"fmt"
	"net/http"
	"service-core/domain/consultation"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

// handleConsultationsCollection handles operations on the consultations collection
func (h *Handler) handleConsultationsCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listConsultations(w, r)
		return
	case http.MethodPost:
		h.createConsultation(w, r)
		return
	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}

// handleConsultationResource handles operations on individual consultation resources
func (h *Handler) handleConsultationResource(w http.ResponseWriter, r *http.Request) {
	consultationIDStr := r.PathValue("id")
	consultationID, err := uuid.Parse(consultationIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Invalid consultation ID",
			Err:     fmt.Errorf("error parsing consultation ID: %w", err),
		})
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getConsultation(w, r, consultationID)
		return
	case http.MethodPut:
		h.updateConsultation(w, r, consultationID)
		return
	case http.MethodDelete:
		h.deleteConsultation(w, r, consultationID)
		return
	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}

// handleConsultationDrafts handles draft operations for consultations
func (h *Handler) handleConsultationDrafts(w http.ResponseWriter, r *http.Request) {
	consultationIDStr := r.PathValue("id")
	consultationID, err := uuid.Parse(consultationIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Invalid consultation ID",
			Err:     fmt.Errorf("error parsing consultation ID: %w", err),
		})
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getDraft(w, r, consultationID)
		return
	case http.MethodPost:
		h.createDraft(w, r, consultationID)
		return
	case http.MethodPut:
		h.updateDraft(w, r, consultationID)
		return
	case http.MethodDelete:
		h.deleteDraft(w, r, consultationID)
		return
	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}

// handleConsultationVersions handles version history operations
func (h *Handler) handleConsultationVersions(w http.ResponseWriter, r *http.Request) {
	consultationIDStr := r.PathValue("id")
	consultationID, err := uuid.Parse(consultationIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Invalid consultation ID",
			Err:     fmt.Errorf("error parsing consultation ID: %w", err),
		})
		return
	}

	versionNumberStr := r.PathValue("version")
	if versionNumberStr != "" {
		h.getVersionDetail(w, r, consultationID, versionNumberStr)
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getVersionHistory(w, r, consultationID)
		return
	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}

// listConsultations handles GET /consultations
func (h *Handler) listConsultations(w http.ResponseWriter, r *http.Request) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	user, err := h.authService.Auth(accessToken, auth.GetConsultations)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Parse query parameters
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")
	statusStr := r.URL.Query().Get("status")
	searchStr := r.URL.Query().Get("search")

	// TODO: Future enhancement - implement additional filters
	// sortStr := r.URL.Query().Get("sort")
	// orderStr := r.URL.Query().Get("order")
	// industryStr := r.URL.Query().Get("industry")
	// urgencyStr := r.URL.Query().Get("urgency")

	// Set defaults
	page := int32(1)
	limit := int32(20)

	if pageStr != "" {
		if p, e := strconv.ParseInt(pageStr, 10, 32); e == nil {
			page = int32(p)
		}
	}

	if limitStr != "" {
		if l, e := strconv.ParseInt(limitStr, 10, 32); e == nil && l <= 100 {
			limit = int32(l)
		}
	}

	// Validate page and limit
	if page < 1 {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Page must be >= 1",
			Err:     fmt.Errorf("invalid page parameter"),
		})
		return
	}

	if limit < 1 || limit > 100 {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Limit must be between 1 and 100",
			Err:     fmt.Errorf("invalid limit parameter"),
		})
		return
	}

	// Handle search query
	if searchStr != "" {
		response, err := h.consultationService.SearchConsultations(r.Context(), user.ID, searchStr, page, limit)
		writeResponse(h.cfg, w, r, response, err)
		return
	}

	// Build list parameters
	params := &consultation.ListConsultationsParams{
		UserID: user.ID,
		Page:   page,
		Limit:  limit,
	}

	// Parse status filter
	if statusStr != "" {
		status := consultation.ConsultationStatus(statusStr)
		if !status.IsValid() {
			writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
				Message: "Invalid status. Must be one of: draft, completed, archived",
				Err:     fmt.Errorf("invalid status parameter"),
			})
			return
		}
		params.Status = &status
	}

	// TODO: Implement additional filters (industry, urgency, sort, order)
	// These would require extending the service layer and repository

	response, err := h.consultationService.ListConsultations(r.Context(), params)
	writeResponse(h.cfg, w, r, response, err)
}

// createConsultation handles POST /consultations
func (h *Handler) createConsultation(w http.ResponseWriter, r *http.Request) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	user, err := h.authService.Auth(accessToken, auth.CreateConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Parse request body
	var input consultation.CreateConsultationInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Invalid JSON format",
			Err:     fmt.Errorf("error decoding JSON: %w", err),
		})
		return
	}

	// Set user ID from authenticated user
	input.UserID = user.ID

	// Create consultation
	result, err := h.consultationService.CreateConsultation(r.Context(), &input)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Return 201 Created with the consultation DTO
	w.WriteHeader(http.StatusCreated)
	writeResponse(h.cfg, w, r, result.ToDTO(), nil)
}

// getConsultation handles GET /consultations/{id}
func (h *Handler) getConsultation(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	_, err := h.authService.Auth(accessToken, auth.GetConsultations)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Get consultation with validation
	consultation, err := h.consultationService.GetConsultationWithValidation(r.Context(), consultationID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Consultation not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, consultation.ToDTO(), nil)
}

// updateConsultation handles PUT /consultations/{id}
func (h *Handler) updateConsultation(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	_, err := h.authService.Auth(accessToken, auth.EditConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Parse request body
	var input consultation.UpdateConsultationInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Invalid JSON format",
			Err:     fmt.Errorf("error decoding JSON: %w", err),
		})
		return
	}

	// Update consultation
	result, err := h.consultationService.UpdateConsultation(r.Context(), consultationID, &input)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Consultation not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, result.ToDTO(), nil)
}

// deleteConsultation handles DELETE /consultations/{id}
func (h *Handler) deleteConsultation(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	_, err := h.authService.Auth(accessToken, auth.DeleteConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Delete consultation
	err = h.consultationService.DeleteConsultation(r.Context(), consultationID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Consultation not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Return 204 No Content
	w.WriteHeader(http.StatusNoContent)
}

// Draft management handlers

// getDraft handles GET /consultations/{id}/drafts
func (h *Handler) getDraft(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	user, err := h.authService.Auth(accessToken, auth.GetConsultations)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Get draft
	draft, err := h.consultationService.GetDraft(r.Context(), consultationID, user.ID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Draft not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, draft.ToDTO(), nil)
}

// createDraft handles POST /consultations/{id}/drafts
func (h *Handler) createDraft(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	user, err := h.authService.Auth(accessToken, auth.EditConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Parse request body as generic map for draft data
	var draftData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&draftData); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Invalid JSON format",
			Err:     fmt.Errorf("error decoding JSON: %w", err),
		})
		return
	}

	// Auto-save draft
	err = h.consultationService.AutoSaveDraft(r.Context(), consultationID, user.ID, draftData)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Get the saved draft to return
	draft, err := h.consultationService.GetDraft(r.Context(), consultationID, user.ID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Return 201 Created with the draft DTO
	w.WriteHeader(http.StatusCreated)
	writeResponse(h.cfg, w, r, draft.ToDTO(), nil)
}

// updateDraft handles PUT /consultations/{id}/drafts
func (h *Handler) updateDraft(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	user, err := h.authService.Auth(accessToken, auth.EditConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Parse request body as generic map for draft data
	var draftData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&draftData); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Invalid JSON format",
			Err:     fmt.Errorf("error decoding JSON: %w", err),
		})
		return
	}

	// Auto-save draft (this will update if it exists)
	err = h.consultationService.AutoSaveDraft(r.Context(), consultationID, user.ID, draftData)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Get the updated draft to return
	draft, err := h.consultationService.GetDraft(r.Context(), consultationID, user.ID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, draft.ToDTO(), nil)
}

// deleteDraft handles DELETE /consultations/{id}/drafts
func (h *Handler) deleteDraft(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	user, err := h.authService.Auth(accessToken, auth.EditConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Delete draft
	err = h.consultationService.DeleteDraft(r.Context(), consultationID, user.ID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Draft not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Return 204 No Content
	w.WriteHeader(http.StatusNoContent)
}

// Version management handlers

// getVersionHistory handles GET /consultations/{id}/versions
func (h *Handler) getVersionHistory(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	_, err := h.authService.Auth(accessToken, auth.GetConsultations)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Parse query parameters
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	// Set defaults
	page := int32(1)
	limit := int32(10)

	if pageStr != "" {
		if p, e := strconv.ParseInt(pageStr, 10, 32); e == nil {
			page = int32(p)
		}
	}

	if limitStr != "" {
		if l, e := strconv.ParseInt(limitStr, 10, 32); e == nil && l <= 50 {
			limit = int32(l)
		}
	}

	// Validate pagination
	if page < 1 {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Page must be >= 1",
			Err:     fmt.Errorf("invalid page parameter"),
		})
		return
	}

	if limit < 1 || limit > 50 {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Limit must be between 1 and 50",
			Err:     fmt.Errorf("invalid limit parameter"),
		})
		return
	}

	// Get version history
	response, err := h.consultationService.GetVersionHistory(r.Context(), consultationID, page, limit)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, response.ToDTO(), nil)
}

// getVersionDetail handles GET /consultations/{id}/versions/{versionNumber}
func (h *Handler) getVersionDetail(w http.ResponseWriter, r *http.Request, consultationID uuid.UUID, versionNumberStr string) {
	accessToken := extractAccessToken(r)

	// Authenticate user
	user, err := h.authService.Auth(accessToken, auth.GetConsultations)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Parse version number
	versionNumber, err := strconv.ParseInt(versionNumberStr, 10, 32)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{
			Message: "Invalid version number",
			Err:     fmt.Errorf("error parsing version number: %w", err),
		})
		return
	}

	// Rollback to version (this actually returns the consultation at that version)
	consultation, err := h.consultationService.RollbackToVersion(r.Context(), consultationID, int32(versionNumber), user.ID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Version not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, consultation.ToDTO(), nil)
}

// Additional utility endpoints

// handleConsultationComplete handles POST /consultations/{id}/complete
func (h *Handler) handleConsultationComplete(w http.ResponseWriter, r *http.Request) {
	consultationIDStr := r.PathValue("id")
	consultationID, err := uuid.Parse(consultationIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Invalid consultation ID",
			Err:     fmt.Errorf("error parsing consultation ID: %w", err),
		})
		return
	}

	accessToken := extractAccessToken(r)

	// Authenticate user
	_, err = h.authService.Auth(accessToken, auth.EditConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Complete consultation
	consultation, err := h.consultationService.CompleteConsultation(r.Context(), consultationID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Consultation not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, consultation.ToDTO(), nil)
}

// handleConsultationArchive handles POST /consultations/{id}/archive
func (h *Handler) handleConsultationArchive(w http.ResponseWriter, r *http.Request) {
	consultationIDStr := r.PathValue("id")
	consultationID, err := uuid.Parse(consultationIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Invalid consultation ID",
			Err:     fmt.Errorf("error parsing consultation ID: %w", err),
		})
		return
	}

	accessToken := extractAccessToken(r)

	// Authenticate user
	_, err = h.authService.Auth(accessToken, auth.EditConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Archive consultation
	consultation, err := h.consultationService.ArchiveConsultation(r.Context(), consultationID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Consultation not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, consultation.ToDTO(), nil)
}

// handleConsultationRestore handles POST /consultations/{id}/restore
func (h *Handler) handleConsultationRestore(w http.ResponseWriter, r *http.Request) {
	consultationIDStr := r.PathValue("id")
	consultationID, err := uuid.Parse(consultationIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{
			Message: "Invalid consultation ID",
			Err:     fmt.Errorf("error parsing consultation ID: %w", err),
		})
		return
	}

	accessToken := extractAccessToken(r)

	// Authenticate user
	_, err = h.authService.Auth(accessToken, auth.EditConsultation)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Restore consultation
	consultation, err := h.consultationService.RestoreConsultation(r.Context(), consultationID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{
				Message: "Consultation not found",
				Err:     err,
			})
			return
		}
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, consultation.ToDTO(), nil)
}
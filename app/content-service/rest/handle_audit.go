package rest

import "net/http"

func (h *Handler) handleStartAudit(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetAudit(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetAuditIssues(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetAuditBacklinks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetAuditKeywords(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetAuditCompetitors(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGenerateAuditReport(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

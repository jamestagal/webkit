package rest

import "net/http"

func (h *Handler) handleGetBrandProfile(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGenerateBrandProfile(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleUpdateBrandProfile(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

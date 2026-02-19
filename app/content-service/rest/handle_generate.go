package rest

import "net/http"

func (h *Handler) handleGenerateCopy(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGenerateMeta(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGenerateStructure(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGenerateBulk(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

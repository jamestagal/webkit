package rest

import "net/http"

func (h *Handler) handleGetCopyVersions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleUpdateCopy(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleDeleteCopy(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleExportCopy(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

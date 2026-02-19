package rest

import "net/http"

func (h *Handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, successResponse("ok"))
}

func (h *Handler) handleReady(w http.ResponseWriter, r *http.Request) {
	if err := h.db.PingContext(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, errorResponse("database not ready"))
		return
	}
	writeJSON(w, http.StatusOK, successResponse("ready"))
}

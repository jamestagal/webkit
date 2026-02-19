package rest

import "net/http"

func (h *Handler) handleStartCrawl(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetCrawlStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleCancelCrawl(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetPages(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleGetPage(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

func (h *Handler) handleUpdatePage(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, errorResponse("not implemented"))
}

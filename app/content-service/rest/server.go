package rest

import (
	"log/slog"
	"net/http"
)

func Run(h *Handler) *http.Server {
	mux := http.NewServeMux()

	// Crawl routes
	mux.HandleFunc("POST /api/content/crawl", h.authMiddleware(h.handleStartCrawl))
	mux.HandleFunc("GET /api/content/crawl/{jobId}", h.authMiddleware(h.handleGetCrawlStatus))
	mux.HandleFunc("POST /api/content/crawl/{jobId}/cancel", h.authMiddleware(h.handleCancelCrawl))

	// Pages routes
	mux.HandleFunc("GET /api/content/pages/{clientId}", h.authMiddleware(h.handleGetPages))
	mux.HandleFunc("GET /api/content/pages/{clientId}/{pageId}", h.authMiddleware(h.handleGetPage))
	mux.HandleFunc("PATCH /api/content/pages/{clientId}/{pageId}", h.authMiddleware(h.handleUpdatePage))

	// Brand profile routes
	mux.HandleFunc("GET /api/content/brand/{clientId}", h.authMiddleware(h.handleGetBrandProfile))
	mux.HandleFunc("POST /api/content/brand/{clientId}/generate", h.authMiddleware(h.handleGenerateBrandProfile))
	mux.HandleFunc("PUT /api/content/brand/{clientId}", h.authMiddleware(h.handleUpdateBrandProfile))

	// SEO audit routes
	mux.HandleFunc("POST /api/content/audit/{clientId}", h.authMiddleware(h.handleStartAudit))
	mux.HandleFunc("GET /api/content/audit/{auditId}", h.authMiddleware(h.handleGetAudit))
	mux.HandleFunc("GET /api/content/audit/{auditId}/issues", h.authMiddleware(h.handleGetAuditIssues))
	mux.HandleFunc("GET /api/content/audit/{auditId}/backlinks", h.authMiddleware(h.handleGetAuditBacklinks))
	mux.HandleFunc("GET /api/content/audit/{auditId}/keywords", h.authMiddleware(h.handleGetAuditKeywords))
	mux.HandleFunc("GET /api/content/audit/{auditId}/competitors", h.authMiddleware(h.handleGetAuditCompetitors))
	mux.HandleFunc("POST /api/content/audit/{auditId}/report", h.authMiddleware(h.handleGenerateAuditReport))

	// Content generation routes
	mux.HandleFunc("POST /api/content/generate/copy", h.authMiddleware(h.handleGenerateCopy))
	mux.HandleFunc("POST /api/content/generate/meta", h.authMiddleware(h.handleGenerateMeta))
	mux.HandleFunc("POST /api/content/generate/structure", h.authMiddleware(h.handleGenerateStructure))
	mux.HandleFunc("POST /api/content/generate/bulk", h.authMiddleware(h.handleGenerateBulk))
	mux.HandleFunc("POST /api/content/generate/social", h.authMiddleware(h.handleGenerateSocial))

	// Social media routes
	mux.HandleFunc("GET /api/content/social/{clientId}", h.authMiddleware(h.handleGetSocialPosts))

	// Copy management routes
	mux.HandleFunc("GET /api/content/copy/{clientId}", h.authMiddleware(h.handleGetCopyVersions))
	mux.HandleFunc("PATCH /api/content/copy/{copyId}", h.authMiddleware(h.handleUpdateCopy))
	mux.HandleFunc("DELETE /api/content/copy/{copyId}", h.authMiddleware(h.handleDeleteCopy))
	mux.HandleFunc("POST /api/content/copy/export/{clientId}", h.authMiddleware(h.handleExportCopy))

	// Overview routes
	mux.HandleFunc("GET /api/content/overview/{clientId}", h.authMiddleware(h.handleGetOverview))

	// Health checks
	mux.HandleFunc("GET /health", h.handleHealth)
	mux.HandleFunc("GET /ready", h.handleReady)

	// Apply global middleware
	handler := corsMiddleware(h.cfg.ClientURL, mux)
	handler = loggingMiddleware(handler)

	server := &http.Server{
		Addr:              ":" + h.cfg.HTTPPort,
		Handler:           handler,
		ReadHeaderTimeout: h.cfg.HTTPTimeout,
		WriteTimeout:      h.cfg.HTTPTimeout,
	}

	go func() {
		slog.Info("Content service HTTP server listening on", "port", h.cfg.HTTPPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Error serving HTTP", "error", err)
			panic(err)
		}
	}()

	return server
}

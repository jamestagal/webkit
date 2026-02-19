package jobs

import (
	"encoding/json"
	"log/slog"

	"github.com/nats-io/nats.go"
)

// handleCrawlComplete logs the completion of a crawl job.
// Future waves will use this to trigger brand profile generation.
func (m *Manager) handleCrawlComplete(msg *nats.Msg) {
	var complete CrawlCompleteMsg
	if err := json.Unmarshal(msg.Data, &complete); err != nil {
		slog.Error("Failed to unmarshal crawl complete", "error", err)
		return
	}
	slog.Info("Crawl completed",
		"job_id", complete.JobID,
		"total_pages", complete.TotalPages,
		"pages_changed", complete.PagesChanged,
		"success", complete.Success,
	)
	// Future: trigger brand profile generation
}

// handleProfileGenerate is a stub for brand profile generation (future wave).
func (m *Manager) handleProfileGenerate(msg *nats.Msg) {
	slog.Warn("Profile generation not implemented")
}

// handleAuditStart is a stub for SEO audit start (future wave).
func (m *Manager) handleAuditStart(msg *nats.Msg) {
	slog.Warn("Audit start not implemented")
}

// handleAuditComplete is a stub for SEO audit completion (future wave).
func (m *Manager) handleAuditComplete(msg *nats.Msg) {
	slog.Warn("Audit complete not implemented")
}

// handleGenerateCopy is a stub for AI copy generation (future wave).
func (m *Manager) handleGenerateCopy(msg *nats.Msg) {
	slog.Warn("Copy generation not implemented")
}

// handleGenerateBulk is a stub for bulk content generation (future wave).
func (m *Manager) handleGenerateBulk(msg *nats.Msg) {
	slog.Warn("Bulk generation not implemented")
}

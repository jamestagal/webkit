package jobs

import (
	"encoding/json"
	"log/slog"

	"content-service/internal/embeddings"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// handleCrawlPage handles embedding generation for a single page.
// This is used for on-demand re-embedding of individual pages.
func (m *Manager) handleCrawlPage(msg *nats.Msg) {
	var pageMsg CrawlPageMsg
	if err := json.Unmarshal(msg.Data, &pageMsg); err != nil {
		slog.Error("Failed to unmarshal crawl page", "error", err)
		return
	}

	pageID, err := uuid.Parse(pageMsg.PageID)
	if err != nil {
		slog.Error("Invalid page_id", "page_id", pageMsg.PageID, "error", err)
		return
	}
	clientID, err := uuid.Parse(pageMsg.ClientID)
	if err != nil {
		slog.Error("Invalid client_id", "client_id", pageMsg.ClientID, "error", err)
		return
	}

	slog.Info("Processing page embedding",
		"job_id", pageMsg.JobID,
		"page_id", pageID,
		"url", pageMsg.URL,
	)

	// Fetch the page data from the database.
	var (
		dbPageID   uuid.UUID
		dbClientID uuid.UUID
		pageType   string
		url        string
		bodyText   string
	)
	err = m.db.QueryRowContext(m.ctx,
		"SELECT id, client_id, page_type, url, body_text FROM content_pages WHERE id = $1",
		pageID,
	).Scan(&dbPageID, &dbClientID, &pageType, &url, &bodyText)
	if err != nil {
		slog.Error("Failed to fetch page for embedding",
			"page_id", pageID,
			"error", err,
		)
		return
	}

	input := embeddings.PageInput{
		ClientID: clientID,
		PageID:   dbPageID,
		PageType: pageType,
		URL:      url,
		BodyText: bodyText,
	}

	if err := embeddings.RunPipeline(m.ctx, m.db, m.embedClient, input); err != nil {
		slog.Error("Page embedding pipeline failed",
			"page_id", pageID,
			"url", url,
			"error", err,
		)
		return
	}

	slog.Info("Page embedding complete",
		"page_id", pageID,
		"url", url,
	)
}

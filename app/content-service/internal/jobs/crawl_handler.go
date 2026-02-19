package jobs

import (
	"encoding/json"
	"log/slog"
	"time"

	"content-service/internal/crawler"
	"content-service/internal/embeddings"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// handleCrawlStart receives a CrawlStartMsg, launches a crawl in a goroutine,
// runs the embedding pipeline on the results, and publishes a CrawlCompleteMsg.
func (m *Manager) handleCrawlStart(msg *nats.Msg) {
	var startMsg CrawlStartMsg
	if err := json.Unmarshal(msg.Data, &startMsg); err != nil {
		slog.Error("Failed to unmarshal crawl start", "error", err)
		return
	}

	jobID, err := uuid.Parse(startMsg.JobID)
	if err != nil {
		slog.Error("Invalid job_id", "job_id", startMsg.JobID, "error", err)
		return
	}
	agencyID, err := uuid.Parse(startMsg.AgencyID)
	if err != nil {
		slog.Error("Invalid agency_id", "agency_id", startMsg.AgencyID, "error", err)
		return
	}
	clientID, err := uuid.Parse(startMsg.ClientID)
	if err != nil {
		slog.Error("Invalid client_id", "client_id", startMsg.ClientID, "error", err)
		return
	}

	slog.Info("Crawl job starting",
		"job_id", jobID,
		"source_url", startMsg.SourceURL,
		"max_depth", startMsg.MaxDepth,
		"crawl_target", startMsg.CrawlTarget,
	)

	// Mark job as crawling.
	_, err = m.db.ExecContext(m.ctx,
		"UPDATE content_crawl_jobs SET status = 'crawling', started_at = NOW() WHERE id = $1",
		jobID,
	)
	if err != nil {
		slog.Error("Failed to update job status to crawling", "job_id", jobID, "error", err)
		return
	}

	// Build crawler config.
	cfg := crawler.CrawlConfig{
		SourceURL:   startMsg.SourceURL,
		MaxDepth:    startMsg.MaxDepth,
		MaxPages:    200,
		Parallelism: 3,
		CrawlDelay:  2 * time.Second,
		CrawlTarget: startMsg.CrawlTarget,
		JobID:       jobID,
		AgencyID:    agencyID,
		ClientID:    clientID,
	}
	c := crawler.New(cfg, m.db, m.cfClient, m.jinaClient, m.cfg.AnthropicAPIKey)

	// Run the crawl in a tracked goroutine.
	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		m.runCrawlPipeline(c, jobID, agencyID, clientID)
	}()
}

// runCrawlPipeline executes the crawl, runs embeddings on the results,
// updates the job row, and publishes a completion message.
func (m *Manager) runCrawlPipeline(c *crawler.Crawler, jobID, agencyID, clientID uuid.UUID) {
	result := c.Run(m.ctx)

	// Handle crawl failure.
	if result.Error != nil {
		slog.Error("Crawl failed",
			"job_id", jobID,
			"error", result.Error,
		)
		_, dbErr := m.db.ExecContext(m.ctx,
			"UPDATE content_crawl_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2",
			result.Error.Error(), jobID,
		)
		if dbErr != nil {
			slog.Error("Failed to update job status to failed", "job_id", jobID, "error", dbErr)
		}
		m.publishCrawlComplete(jobID, agencyID, clientID, result.PagesDiscovered, result.PagesChanged, false, result.Error.Error())
		return
	}

	slog.Info("Crawl phase complete, starting embedding pipeline",
		"job_id", jobID,
		"pages_discovered", result.PagesDiscovered,
		"pages_processed", result.PagesProcessed,
		"pages_changed", result.PagesChanged,
	)

	// Transition to embedding phase.
	_, err := m.db.ExecContext(m.ctx,
		"UPDATE content_crawl_jobs SET status = 'embedding' WHERE id = $1",
		jobID,
	)
	if err != nil {
		slog.Error("Failed to update job status to embedding", "job_id", jobID, "error", err)
	}

	// Run embedding pipeline on all crawled pages with body text.
	embeddingErrors := m.runEmbeddingPhase(jobID, clientID)

	// Final status update.
	finalStatus := "complete"
	var errMsg string
	if embeddingErrors > 0 {
		slog.Warn("Embedding pipeline had errors",
			"job_id", jobID,
			"error_count", embeddingErrors,
		)
		// Still mark as complete; embedding failures are non-fatal.
	}

	_, err = m.db.ExecContext(m.ctx,
		`UPDATE content_crawl_jobs
		 SET status = $1, completed_at = NOW(),
		     pages_discovered = $2, pages_processed = $3, pages_changed = $4
		 WHERE id = $5`,
		finalStatus, result.PagesDiscovered, result.PagesProcessed, result.PagesChanged, jobID,
	)
	if err != nil {
		slog.Error("Failed to update job status to complete", "job_id", jobID, "error", err)
	}

	m.publishCrawlComplete(jobID, agencyID, clientID, result.PagesDiscovered, result.PagesChanged, true, errMsg)
}

// runEmbeddingPhase selects all pages for the job that have body text and
// runs each through the embedding pipeline. Returns the count of errors.
func (m *Manager) runEmbeddingPhase(jobID, clientID uuid.UUID) int {
	rows, err := m.db.QueryContext(m.ctx,
		`SELECT id, page_type, url, body_text
		 FROM content_pages
		 WHERE crawl_job_id = $1 AND body_text IS NOT NULL AND body_text != ''`,
		jobID,
	)
	if err != nil {
		slog.Error("Failed to query pages for embedding", "job_id", jobID, "error", err)
		return 1
	}
	defer rows.Close()

	var errCount int
	for rows.Next() {
		var (
			pageID   uuid.UUID
			pageType string
			url      string
			bodyText string
		)
		if err := rows.Scan(&pageID, &pageType, &url, &bodyText); err != nil {
			slog.Error("Failed to scan page row", "job_id", jobID, "error", err)
			errCount++
			continue
		}

		input := embeddings.PageInput{
			ClientID: clientID,
			PageID:   pageID,
			PageType: pageType,
			URL:      url,
			BodyText: bodyText,
		}
		if err := embeddings.RunPipeline(m.ctx, m.db, m.embedClient, input); err != nil {
			slog.Error("Embedding pipeline failed for page",
				"page_id", pageID,
				"url", url,
				"error", err,
			)
			errCount++
		}
	}
	if err := rows.Err(); err != nil {
		slog.Error("Error iterating page rows", "job_id", jobID, "error", err)
		errCount++
	}

	return errCount
}

// publishCrawlComplete publishes a CrawlCompleteMsg to NATS.
func (m *Manager) publishCrawlComplete(jobID, agencyID, clientID uuid.UUID, totalPages, pagesChanged int, success bool, errMsg string) {
	complete := CrawlCompleteMsg{
		JobID:        jobID.String(),
		AgencyID:     agencyID.String(),
		ClientID:     clientID.String(),
		TotalPages:   totalPages,
		PagesChanged: pagesChanged,
		Success:      success,
		Error:        errMsg,
	}

	data, err := json.Marshal(complete)
	if err != nil {
		slog.Error("Failed to marshal crawl complete message", "job_id", jobID, "error", err)
		return
	}

	if err := m.nc.Publish(SubjectCrawlComplete, data); err != nil {
		slog.Error("Failed to publish crawl complete", "job_id", jobID, "error", err)
	}
}

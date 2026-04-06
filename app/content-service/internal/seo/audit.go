package seo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"sync"

	"app/pkg/dataforseo"
	"app/pkg/pagespeed"

	"github.com/google/uuid"
)

// AuditEngine orchestrates a full SEO audit for a client.
type AuditEngine struct {
	db           *sql.DB
	dfs          *dataforseo.Client
	psi          *pagespeed.Client
	anthropicKey string
}

// New creates a new AuditEngine.
func New(db *sql.DB, dfs *dataforseo.Client, psi *pagespeed.Client, anthropicKey string) *AuditEngine {
	return &AuditEngine{
		db:           db,
		dfs:          dfs,
		psi:          psi,
		anthropicKey: anthropicKey,
	}
}

// sectionProgress represents the status of one audit section.
type sectionProgress struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// updateProgress writes a single section's progress to the seo_audits.progress JSONB column.
// This is polled by the frontend every 3 seconds to show real-time audit status.
func (e *AuditEngine) updateProgress(ctx context.Context, auditID uuid.UUID, section, status, message string) {
	prog := sectionProgress{Status: status, Message: message}
	progJSON, err := json.Marshal(prog)
	if err != nil {
		return
	}
	_, err = e.db.ExecContext(ctx,
		`UPDATE seo_audits
		 SET progress = jsonb_set(COALESCE(progress, '{}'), $2::text[], $3::jsonb),
		     updated_at = NOW()
		 WHERE id = $1`,
		auditID,
		"{"+section+"}",
		string(progJSON),
	)
	if err != nil {
		slog.Debug("Failed to update progress", "audit_id", auditID, "section", section, "error", err)
	}
}

// Run executes a full SEO audit: content checks, technical audit,
// backlink analysis, keyword analysis, and competitor analysis.
func (e *AuditEngine) Run(ctx context.Context, auditID, clientID, agencyID uuid.UUID) error {
	// Mark audit as running.
	_, err := e.db.ExecContext(ctx,
		"UPDATE seo_audits SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1",
		auditID,
	)
	if err != nil {
		return fmt.Errorf("update audit status to running: %w", err)
	}

	// Get the source domain: try crawl job first, then fall back to client's website field.
	var sourceURL string
	err = e.db.QueryRowContext(ctx,
		`SELECT source_url FROM content_crawl_jobs
		 WHERE client_id = $1 AND status = 'complete' AND crawl_target = 'client'
		 ORDER BY completed_at DESC LIMIT 1`,
		clientID,
	).Scan(&sourceURL)
	if err == sql.ErrNoRows {
		// No crawl — fall back to the client's website URL
		err = e.db.QueryRowContext(ctx,
			`SELECT website FROM clients WHERE id = $1 AND website != ''`,
			clientID,
		).Scan(&sourceURL)
	}
	if err == sql.ErrNoRows {
		return fmt.Errorf("no website URL found for this client — please add a website URL in the client settings before running an SEO audit")
	}
	if err != nil {
		return fmt.Errorf("get source url: %w", err)
	}

	// Extract domain from the source URL.
	parsedURL, err := url.Parse(sourceURL)
	if err != nil {
		return fmt.Errorf("parse source url %q: %w", sourceURL, err)
	}
	domain := parsedURL.Hostname()
	if domain == "" {
		return fmt.Errorf("empty domain from source url %q", sourceURL)
	}

	slog.Info("SEO audit starting",
		"audit_id", auditID,
		"client_id", clientID,
		"domain", domain,
	)

	// Set initial progress for all sections.
	e.updateProgress(ctx, auditID, "technical", "waiting", "")
	e.updateProgress(ctx, auditID, "backlinks", "waiting", "")
	e.updateProgress(ctx, auditID, "keywords", "waiting", "")
	e.updateProgress(ctx, auditID, "competitors", "waiting", "")
	if e.psi != nil {
		e.updateProgress(ctx, auditID, "performance", "waiting", "")
	}

	// Run audit sections in parallel.
	var (
		wg             sync.WaitGroup
		mu             sync.Mutex
		errs           []error
		technicalScore = scoreUnavailable // Default to unavailable; set to real score on success
	)

	// Technical + Content audit (DataForSEO On-Page API).
	wg.Add(1)
	go func() {
		defer wg.Done()
		e.updateProgress(ctx, auditID, "technical", "running", fmt.Sprintf("Crawling %s...", domain))
		score, err := e.RunTechnicalAudit(ctx, auditID, clientID, domain)
		if err != nil {
			slog.Error("Technical audit failed — category will be excluded from overall score",
				"audit_id", auditID, "error", err)
			e.updateProgress(ctx, auditID, "technical", "failed", "Audit failed")
			mu.Lock()
			errs = append(errs, fmt.Errorf("technical audit: %w", err))
			mu.Unlock()
			return
		}
		e.updateProgress(ctx, auditID, "technical", "complete", fmt.Sprintf("Score: %.0f/100", score))
		mu.Lock()
		technicalScore = score
		mu.Unlock()
	}()

	// Fallback: Run old content checks only if DataForSEO is NOT configured.
	if e.dfs == nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := e.RunContentChecks(ctx, auditID, clientID); err != nil {
				slog.Error("Content checks failed", "audit_id", auditID, "error", err)
				mu.Lock()
				errs = append(errs, fmt.Errorf("content checks: %w", err))
				mu.Unlock()
			}
		}()
	}

	// Backlink analysis (DataForSEO Backlinks API).
	wg.Add(1)
	go func() {
		defer wg.Done()
		e.updateProgress(ctx, auditID, "backlinks", "running", "Analyzing backlink profile...")
		if err := e.RunBacklinkAnalysis(ctx, auditID, clientID, domain); err != nil {
			slog.Error("Backlink analysis failed", "audit_id", auditID, "error", err)
			e.updateProgress(ctx, auditID, "backlinks", "failed", "Analysis failed")
			mu.Lock()
			errs = append(errs, fmt.Errorf("backlink analysis: %w", err))
			mu.Unlock()
			return
		}
		// Read backlink summary for progress message.
		var totalBacklinks, referringDomains int
		_ = e.db.QueryRowContext(ctx,
			"SELECT total_backlinks, referring_domains FROM backlink_profiles WHERE audit_id = $1 LIMIT 1",
			auditID,
		).Scan(&totalBacklinks, &referringDomains)
		e.updateProgress(ctx, auditID, "backlinks", "complete",
			fmt.Sprintf("%d backlinks from %d domains", totalBacklinks, referringDomains))
	}()

	// Keyword analysis (DataForSEO Labs).
	wg.Add(1)
	go func() {
		defer wg.Done()
		e.updateProgress(ctx, auditID, "keywords", "running", "Analyzing keyword rankings...")
		if err := e.RunKeywordAnalysis(ctx, auditID, clientID, domain); err != nil {
			slog.Error("Keyword analysis failed", "audit_id", auditID, "error", err)
			e.updateProgress(ctx, auditID, "keywords", "failed", "Analysis failed")
			mu.Lock()
			errs = append(errs, fmt.Errorf("keyword analysis: %w", err))
			mu.Unlock()
			return
		}
		// Check if keyword data was found.
		var count int
		err := e.db.QueryRowContext(ctx,
			"SELECT total_ranking_keywords FROM keyword_profiles WHERE audit_id = $1 LIMIT 1",
			auditID,
		).Scan(&count)
		if err != nil {
			e.updateProgress(ctx, auditID, "keywords", "skipped", "No data available")
		} else {
			e.updateProgress(ctx, auditID, "keywords", "complete",
				fmt.Sprintf("%d ranking keywords", count))
		}
	}()

	// Competitor analysis (DataForSEO Labs).
	wg.Add(1)
	go func() {
		defer wg.Done()
		e.updateProgress(ctx, auditID, "competitors", "running", "Analyzing competitors...")
		if err := e.RunCompetitorAnalysis(ctx, auditID, clientID, domain); err != nil {
			slog.Error("Competitor analysis failed", "audit_id", auditID, "error", err)
			e.updateProgress(ctx, auditID, "competitors", "failed", "Analysis failed")
			mu.Lock()
			errs = append(errs, fmt.Errorf("competitor analysis: %w", err))
			mu.Unlock()
			return
		}
		var count int
		_ = e.db.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM competitor_analyses WHERE audit_id = $1",
			auditID,
		).Scan(&count)
		e.updateProgress(ctx, auditID, "competitors", "complete",
			fmt.Sprintf("%d competitors analyzed", count))
	}()

	// Google PageSpeed Insights (only if API key configured).
	if e.psi != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			e.updateProgress(ctx, auditID, "performance", "running", "Running PageSpeed Insights...")
			if err := e.RunPerformanceAudit(ctx, auditID, clientID, sourceURL); err != nil {
				slog.Error("Performance audit failed", "audit_id", auditID, "error", err)
				e.updateProgress(ctx, auditID, "performance", "failed", "PageSpeed analysis failed")
				mu.Lock()
				errs = append(errs, fmt.Errorf("performance audit: %w", err))
				mu.Unlock()
				return
			}
		}()
	}

	wg.Wait()

	if len(errs) > 0 {
		slog.Warn("SEO audit completed with errors",
			"audit_id", auditID,
			"error_count", len(errs),
		)
		// Continue to scoring even with partial failures.
	}

	// Calculate scores and finalize.
	e.updateProgress(ctx, auditID, "scoring", "running", "Calculating final scores...")
	if err := e.CalculateScores(ctx, auditID, technicalScore); err != nil {
		return fmt.Errorf("calculate scores: %w", err)
	}
	e.updateProgress(ctx, auditID, "scoring", "complete", "Done")

	slog.Info("SEO audit completed",
		"audit_id", auditID,
		"client_id", clientID,
	)

	return nil
}

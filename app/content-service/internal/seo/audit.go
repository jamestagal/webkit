package seo

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/url"
	"sync"

	"app/pkg/dataforseo"

	"github.com/google/uuid"
)

// AuditEngine orchestrates a full SEO audit for a client.
type AuditEngine struct {
	db           *sql.DB
	dfs          *dataforseo.Client
	anthropicKey string
}

// New creates a new AuditEngine.
func New(db *sql.DB, dfs *dataforseo.Client, anthropicKey string) *AuditEngine {
	return &AuditEngine{
		db:           db,
		dfs:          dfs,
		anthropicKey: anthropicKey,
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

	// Get the source domain from the latest completed client crawl.
	var sourceURL string
	err = e.db.QueryRowContext(ctx,
		`SELECT source_url FROM content_crawl_jobs
		 WHERE client_id = $1 AND status = 'complete' AND crawl_target = 'client'
		 ORDER BY completed_at DESC LIMIT 1`,
		clientID,
	).Scan(&sourceURL)
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

	// Run 5 audit sections in parallel.
	var (
		wg             sync.WaitGroup
		mu             sync.Mutex
		errs           []error
		technicalScore float64
	)

	// Content checks (no external API).
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

	// Technical audit (DataForSEO On-Page API).
	wg.Add(1)
	go func() {
		defer wg.Done()
		score, err := e.RunTechnicalAudit(ctx, auditID, clientID, domain)
		if err != nil {
			slog.Error("Technical audit failed", "audit_id", auditID, "error", err)
			mu.Lock()
			errs = append(errs, fmt.Errorf("technical audit: %w", err))
			mu.Unlock()
			return
		}
		mu.Lock()
		technicalScore = score
		mu.Unlock()
	}()

	// Backlink analysis (DataForSEO Backlinks API).
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := e.RunBacklinkAnalysis(ctx, auditID, clientID, domain); err != nil {
			slog.Error("Backlink analysis failed", "audit_id", auditID, "error", err)
			mu.Lock()
			errs = append(errs, fmt.Errorf("backlink analysis: %w", err))
			mu.Unlock()
		}
	}()

	// Keyword analysis (DataForSEO Labs).
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := e.RunKeywordAnalysis(ctx, auditID, clientID, domain); err != nil {
			slog.Error("Keyword analysis failed", "audit_id", auditID, "error", err)
			mu.Lock()
			errs = append(errs, fmt.Errorf("keyword analysis: %w", err))
			mu.Unlock()
		}
	}()

	// Competitor analysis (DataForSEO Labs).
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := e.RunCompetitorAnalysis(ctx, auditID, clientID, domain); err != nil {
			slog.Error("Competitor analysis failed", "audit_id", auditID, "error", err)
			mu.Lock()
			errs = append(errs, fmt.Errorf("competitor analysis: %w", err))
			mu.Unlock()
		}
	}()

	wg.Wait()

	if len(errs) > 0 {
		slog.Warn("SEO audit completed with errors",
			"audit_id", auditID,
			"error_count", len(errs),
		)
		// Continue to scoring even with partial failures.
	}

	// Calculate scores and finalize.
	if err := e.CalculateScores(ctx, auditID, technicalScore); err != nil {
		return fmt.Errorf("calculate scores: %w", err)
	}

	slog.Info("SEO audit completed",
		"audit_id", auditID,
		"client_id", clientID,
	)

	return nil
}

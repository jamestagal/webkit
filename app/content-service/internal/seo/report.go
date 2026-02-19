package seo

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"math"

	"github.com/google/uuid"
)

// CalculateScores computes the final audit scores from collected data
// and updates the seo_audits row with scores, issue counts, and completion status.
func (e *AuditEngine) CalculateScores(ctx context.Context, auditID uuid.UUID, technicalScore float64) error {
	// --- Content Score ---
	// Start at 100, subtract based on issue severity.
	contentScore := calculateContentScore(ctx, e.db, auditID)

	// --- Backlink Score ---
	backlinkScore := calculateBacklinkScore(ctx, e.db, auditID)

	// --- Keyword Score ---
	keywordScore := calculateKeywordScore(ctx, e.db, auditID)

	// --- Overall Score (weighted) ---
	overall := int(technicalScore*0.25 + contentScore*0.30 + backlinkScore*0.25 + keywordScore*0.20)
	if overall > 100 {
		overall = 100
	}
	if overall < 0 {
		overall = 0
	}

	// Count issues by severity.
	var criticalCount, warningCount, infoCount int
	rows, err := e.db.QueryContext(ctx,
		"SELECT severity, COUNT(*) FROM seo_issues WHERE audit_id = $1 GROUP BY severity",
		auditID,
	)
	if err != nil {
		slog.Error("Failed to count issues by severity", "audit_id", auditID, "error", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var severity string
			var count int
			if err := rows.Scan(&severity, &count); err != nil {
				continue
			}
			switch severity {
			case "critical":
				criticalCount = count
			case "warning":
				warningCount = count
			case "info":
				infoCount = count
			}
		}
	}

	// Count total pages analyzed.
	var totalPages int
	_ = e.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM content_pages WHERE client_id = (SELECT client_id FROM seo_audits WHERE id = $1) AND source_type = 'client'",
		auditID,
	).Scan(&totalPages)

	// Update the audit with scores and completion.
	_, err = e.db.ExecContext(ctx,
		`UPDATE seo_audits SET
			overall_score = $1,
			technical_score = $2,
			content_score = $3,
			backlink_score = $4,
			keyword_score = $5,
			total_pages = $6,
			critical_issues = $7,
			warning_issues = $8,
			opportunities = $9,
			passed_checks = $10,
			status = 'complete',
			completed_at = NOW(),
			updated_at = NOW()
		 WHERE id = $11`,
		overall,
		int(technicalScore),
		int(contentScore),
		int(backlinkScore),
		int(keywordScore),
		totalPages,
		criticalCount,
		warningCount,
		infoCount,
		max(0, totalPages-criticalCount-warningCount), // passed_checks approximation (clamped to 0)
		auditID,
	)
	if err != nil {
		return fmt.Errorf("update audit scores: %w", err)
	}

	slog.Info("Audit scores calculated",
		"audit_id", auditID,
		"overall", overall,
		"technical", int(technicalScore),
		"content", int(contentScore),
		"backlink", int(backlinkScore),
		"keyword", int(keywordScore),
		"critical", criticalCount,
		"warning", warningCount,
		"info", infoCount,
	)

	return nil
}

// calculateContentScore starts at 100 and subtracts based on issue severity.
func calculateContentScore(ctx context.Context, db *sql.DB, auditID uuid.UUID) float64 {
	var criticals, warnings, infos int

	rows, err := db.QueryContext(ctx,
		"SELECT severity, COUNT(*) FROM seo_issues WHERE audit_id = $1 AND category IN ('content', 'meta', 'accessibility', 'internal_links', 'structure') GROUP BY severity",
		auditID,
	)
	if err != nil {
		slog.Error("Failed to count content issues", "audit_id", auditID, "error", err)
		return 50 // Default mid-score on error.
	}
	defer rows.Close()

	for rows.Next() {
		var severity string
		var count int
		if err := rows.Scan(&severity, &count); err != nil {
			continue
		}
		switch severity {
		case "critical":
			criticals = count
		case "warning":
			warnings = count
		case "info":
			infos = count
		}
	}

	score := 100.0 - float64(criticals)*15.0 - float64(warnings)*5.0 - float64(infos)*1.0
	return math.Max(score, 0)
}

// calculateBacklinkScore normalizes backlink data into a 0-100 score.
func calculateBacklinkScore(ctx context.Context, db *sql.DB, auditID uuid.UUID) float64 {
	var referringDomains int
	var domainRank, spamScore float64

	err := db.QueryRowContext(ctx,
		"SELECT referring_domains, domain_rank, spam_score FROM backlink_profiles WHERE audit_id = $1 LIMIT 1",
		auditID,
	).Scan(&referringDomains, &domainRank, &spamScore)
	if err != nil {
		slog.Warn("No backlink profile for scoring", "audit_id", auditID, "error", err)
		return 0
	}

	// Normalize referring_domains: 100+ is good, log scale.
	domainScore := math.Min(float64(referringDomains)/100.0*50.0, 50.0)

	// Domain rank contribution (rank is 0-1000+ scale, higher = better).
	rankScore := math.Min(domainRank/100.0*30.0, 30.0)

	// Spam penalty (lower spam = better, 0-100 scale).
	spamPenalty := spamScore / 100.0 * 20.0

	score := domainScore + rankScore + (20.0 - spamPenalty)
	return math.Max(math.Min(score, 100), 0)
}

// calculateKeywordScore normalizes keyword data into a 0-100 score.
func calculateKeywordScore(ctx context.Context, db *sql.DB, auditID uuid.UUID) float64 {
	var top10Count int

	err := db.QueryRowContext(ctx,
		"SELECT keywords_top_10 FROM keyword_profiles WHERE audit_id = $1 LIMIT 1",
		auditID,
	).Scan(&top10Count)
	if err != nil {
		slog.Warn("No keyword profile for scoring", "audit_id", auditID, "error", err)
		return 0
	}

	// Get total keyword gaps from competitor_analyses rather than keyword_profiles,
	// because keywords and competitors run in parallel and keyword_profiles
	// won't have gap data at write time.
	var totalGaps int
	_ = db.QueryRowContext(ctx,
		"SELECT COALESCE(SUM(unique_keywords), 0) FROM competitor_analyses WHERE audit_id = $1",
		auditID,
	).Scan(&totalGaps)

	// Top 10 keywords contribution (more = better, log scale).
	kwScore := math.Min(float64(top10Count)/20.0*70.0, 70.0)

	// Opportunity score from gaps (more gaps = more opportunity, which is actually positive).
	gapScore := math.Min(float64(totalGaps)/50.0*30.0, 30.0)

	score := kwScore + gapScore
	return math.Max(math.Min(score, 100), 0)
}

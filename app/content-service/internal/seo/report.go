package seo

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"math"

	"github.com/google/uuid"
)

// scoreUnavailable is a sentinel value indicating that a score category
// has no data (e.g. API not subscribed, insufficient funds, or domain too small).
// This is distinct from a genuine score of 0.
const scoreUnavailable = -1.0

// CalculateScores computes the final audit scores from collected data
// and updates the seo_audits row with scores, issue counts, and completion status.
//
// When a category has no data (backlinks API not subscribed, keywords not available),
// its weight is redistributed proportionally to categories that do have data.
// This ensures the overall score reflects what was actually measured.
func (e *AuditEngine) CalculateScores(ctx context.Context, auditID uuid.UUID, technicalScore float64) error {
	// --- Content Score ---
	contentScore := calculateContentScore(ctx, e.db, auditID)

	// --- Backlink Score ---
	backlinkScore := calculateBacklinkScore(ctx, e.db, auditID)

	// --- Keyword Score ---
	keywordScore := calculateKeywordScore(ctx, e.db, auditID)

	// --- Overall Score (dynamic weighted average) ---
	// Base weights: technical 25%, content 30%, backlinks 25%, keywords 20%
	// When a category is unavailable, its weight redistributes to available categories.
	type scoreBucket struct {
		name       string
		score      float64
		baseWeight float64
	}
	buckets := []scoreBucket{
		{"technical", technicalScore, 0.25},
		{"content", contentScore, 0.30},
		{"backlinks", backlinkScore, 0.25},
		{"keywords", keywordScore, 0.20},
	}

	var totalWeight float64
	var weightedSum float64
	for _, b := range buckets {
		if b.score == scoreUnavailable {
			continue
		}
		totalWeight += b.baseWeight
		weightedSum += b.score * b.baseWeight
	}

	var overall int
	if totalWeight > 0 {
		// Normalize by actual weight sum so unavailable categories don't drag score down.
		overall = int(weightedSum / totalWeight)
	}
	if overall > 100 {
		overall = 100
	}
	if overall < 0 {
		overall = 0
	}

	// For DB storage, pass NULL for unavailable scores so the frontend shows "—".
	// scoreToDB returns *int (nil for unavailable) or a pointer to the int value.
	scoreToDB := func(s float64) interface{} {
		if s == scoreUnavailable {
			return nil
		}
		v := int(s)
		return v
	}
	dbTechnical := scoreToDB(technicalScore)
	dbContent := scoreToDB(contentScore)
	dbBacklink := scoreToDB(backlinkScore)
	dbKeyword := scoreToDB(keywordScore)

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
		dbTechnical,
		dbContent,
		dbBacklink,
		dbKeyword,
		totalPages,
		criticalCount,
		warningCount,
		infoCount,
		max(0, totalPages-criticalCount-warningCount),
		auditID,
	)
	if err != nil {
		return fmt.Errorf("update audit scores: %w", err)
	}

	// Log which categories contributed to the overall score.
	availableCategories := ""
	for _, b := range buckets {
		if b.score != scoreUnavailable {
			if availableCategories != "" {
				availableCategories += ", "
			}
			availableCategories += b.name
		}
	}

	// For logging, use the raw scores (not the DB values which may be nil).
	logScore := func(s float64) string {
		if s == scoreUnavailable {
			return "N/A"
		}
		return fmt.Sprintf("%d", int(s))
	}

	slog.Info("Audit scores calculated",
		"audit_id", auditID,
		"overall", overall,
		"technical", logScore(technicalScore),
		"content", logScore(contentScore),
		"backlink", logScore(backlinkScore),
		"keyword", logScore(keywordScore),
		"active_weights", fmt.Sprintf("%.0f%%", totalWeight*100),
		"scored_categories", availableCategories,
		"critical", criticalCount,
		"warning", warningCount,
		"info", infoCount,
	)

	return nil
}

// calculateContentScore computes a 0-100 content quality score based on issue severity.
// Penalties are normalized by page count so larger sites aren't unfairly penalized
// for having more pages (each page can independently trigger the same checks).
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

	// Get page count for normalization.
	// Use the number of distinct pages that have content issues, with a floor
	// of the total HTML pages analyzed (whichever is larger).
	var pageCount int
	err = db.QueryRowContext(ctx,
		`SELECT COALESCE(
			(SELECT COUNT(*) FROM content_pages
			 WHERE client_id = (SELECT client_id FROM seo_audits WHERE id = $1)
			 AND source_type = 'client'), 1)`,
		auditID,
	).Scan(&pageCount)
	if err != nil || pageCount < 1 {
		pageCount = 1
	}

	// Normalize: compute per-page average penalty, then subtract from 100.
	// This way a site with 12 pages and 4 critical issues (on different pages)
	// gets penalty of (4*15)/12 = 5 per page, not 60.
	rawPenalty := float64(criticals)*15.0 + float64(warnings)*5.0 + float64(infos)*1.0
	normalizedPenalty := rawPenalty / float64(pageCount)
	score := 100.0 - normalizedPenalty

	slog.Debug("Content score calculation",
		"audit_id", auditID,
		"criticals", criticals,
		"warnings", warnings,
		"infos", infos,
		"page_count", pageCount,
		"raw_penalty", rawPenalty,
		"normalized_penalty", normalizedPenalty,
		"score", score,
	)

	return math.Max(score, 0)
}

// calculateBacklinkScore normalizes backlink data into a 0-100 score.
// Returns scoreUnavailable (-1) if no backlink data exists for this audit
// (e.g. Backlinks API not subscribed or insufficient funds).
func calculateBacklinkScore(ctx context.Context, db *sql.DB, auditID uuid.UUID) float64 {
	var referringDomains int
	var domainRank, spamScore float64

	err := db.QueryRowContext(ctx,
		"SELECT referring_domains, domain_rank, spam_score FROM backlink_profiles WHERE audit_id = $1 LIMIT 1",
		auditID,
	).Scan(&referringDomains, &domainRank, &spamScore)
	if err != nil {
		slog.Warn("No backlink profile for scoring — category will be excluded from overall score",
			"audit_id", auditID, "error", err)
		return scoreUnavailable
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
// Returns scoreUnavailable (-1) if no keyword data exists for this audit
// (e.g. domain too small for DataForSEO keyword database coverage).
func calculateKeywordScore(ctx context.Context, db *sql.DB, auditID uuid.UUID) float64 {
	var top10Count int

	err := db.QueryRowContext(ctx,
		"SELECT keywords_top_10 FROM keyword_profiles WHERE audit_id = $1 LIMIT 1",
		auditID,
	).Scan(&top10Count)
	if err != nil {
		slog.Warn("No keyword profile for scoring — category will be excluded from overall score",
			"audit_id", auditID, "error", err)
		return scoreUnavailable
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

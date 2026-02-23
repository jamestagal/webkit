package seo

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"app/pkg/pagespeed"

	"github.com/google/uuid"
)

// RunPerformanceAudit calls Google PageSpeed Insights for the source URL
// and stores the results in seo_audits.performance_data.
// Performance score is supplementary — it does NOT factor into the overall score.
func (e *AuditEngine) RunPerformanceAudit(ctx context.Context, auditID, clientID uuid.UUID, sourceURL string) error {
	if e.psi == nil {
		return nil // PageSpeed not configured; skip silently.
	}

	slog.Info("Running PageSpeed Insights", "audit_id", auditID, "url", sourceURL)

	result, err := e.psi.Run(ctx, sourceURL, "mobile")
	if err != nil {
		return fmt.Errorf("pagespeed run: %w", err)
	}

	slog.Info("PageSpeed Insights complete",
		"audit_id", auditID,
		"performance", result.Performance,
		"accessibility", result.Accessibility,
		"best_practices", result.BestPractices,
		"seo", result.SEO,
		"load_time", result.LoadTime,
	)

	// Marshal result to JSON for JSONB storage.
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("marshal pagespeed result: %w", err)
	}

	// Store in seo_audits.performance_data.
	_, err = e.db.ExecContext(ctx,
		`UPDATE seo_audits SET performance_data = $2, updated_at = NOW() WHERE id = $1`,
		auditID, string(resultJSON),
	)
	if err != nil {
		return fmt.Errorf("store pagespeed result: %w", err)
	}

	// Update progress with score.
	e.updateProgress(ctx, auditID, "performance", "complete",
		fmt.Sprintf("Performance: %d/100", result.Performance))

	// Insert poor Core Web Vitals as seo_issues for visibility.
	e.insertPerformanceIssues(ctx, auditID, clientID, result)

	return nil
}

// insertPerformanceIssues creates seo_issues entries for poor Core Web Vitals.
func (e *AuditEngine) insertPerformanceIssues(ctx context.Context, auditID, clientID uuid.UUID, result *pagespeed.Result) {
	type metricInfo struct {
		Acronym     string
		FullName    string
		Description string
		Threshold   string
	}

	metricNames := map[string]metricInfo{
		"LCP": {"LCP", "Largest Contentful Paint", "Main content takes too long to appear", "< 2.5s"},
		"CLS": {"CLS", "Cumulative Layout Shift", "Visual instability — page elements shift during load", "< 0.1"},
		"FCP": {"FCP", "First Contentful Paint", "Browser takes too long to render first content", "< 1.8s"},
		"TBT": {"TBT", "Total Blocking Time", "Main thread is blocked for too long", "< 200ms"},
		"SI":  {"SI", "Speed Index", "Content is visually rendered too slowly", "< 3.4s"},
	}

	for key, metric := range result.Metrics {
		if metric.Category != "poor" {
			continue
		}
		info, ok := metricNames[key]
		if !ok {
			continue
		}

		issue := seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil, // No local page_id for performance metrics
			ClientID:         clientID,
			Category:         "performance",
			Severity:         "warning",
			CheckName:        "core_web_vital_" + key,
			Title:            fmt.Sprintf("Poor %s (%s)", info.FullName, info.Acronym),
			Description:      fmt.Sprintf("%s — current value: %s (threshold: %s)", info.Description, metric.Value, info.Threshold),
			CurrentValue:     metric.Value,
			RecommendedValue: info.Threshold,
			Impact:           "high",
		}

		if err := e.insertSingleIssue(ctx, issue); err != nil {
			slog.Warn("Failed to insert performance issue", "metric", key, "error", err)
		}
	}
}

// insertSingleIssue inserts a single seo_issue row.
func (e *AuditEngine) insertSingleIssue(ctx context.Context, issue seoIssue) error {
	// Convert uuid.Nil to SQL NULL for FK constraint (see gotchas.md).
	var pageID interface{}
	if issue.PageID != uuid.Nil {
		pageID = issue.PageID
	}

	_, err := e.db.ExecContext(ctx,
		`INSERT INTO seo_issues (id, audit_id, page_id, client_id, category, severity, check_name,
			title, description, current_value, recommended_value, impact)
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		issue.AuditID, pageID, issue.ClientID, issue.Category, issue.Severity, issue.CheckName,
		issue.Title, issue.Description, issue.CurrentValue, issue.RecommendedValue, issue.Impact,
	)
	return err
}

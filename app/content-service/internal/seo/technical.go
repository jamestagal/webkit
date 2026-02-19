package seo

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"app/pkg/dataforseo"

	"github.com/google/uuid"
)

// technicalCheckMapping maps DataForSEO on-page check names to seo_issues fields.
type technicalCheckMapping struct {
	CheckName   string
	Title       string
	Description string
	Severity    string
	Impact      string
}

// technicalChecks defines the checks we extract from DataForSEO Checks map.
var technicalChecks = []technicalCheckMapping{
	{CheckName: "no_title", Title: "Missing page title", Description: "Page is missing a title tag", Severity: "critical", Impact: "high"},
	{CheckName: "no_description", Title: "Missing meta description", Description: "Page is missing a meta description", Severity: "warning", Impact: "medium"},
	{CheckName: "no_h1_tag", Title: "Missing H1 tag", Description: "Page has no H1 heading", Severity: "critical", Impact: "high"},
	{CheckName: "is_redirect", Title: "Redirect detected", Description: "Page redirects to another URL", Severity: "info", Impact: "low"},
	{CheckName: "is_broken", Title: "Broken page", Description: "Page returns an error status code", Severity: "critical", Impact: "high"},
	{CheckName: "is_4xx_code", Title: "4xx error", Description: "Page returns a 4xx client error", Severity: "critical", Impact: "high"},
	{CheckName: "is_5xx_code", Title: "5xx error", Description: "Page returns a 5xx server error", Severity: "critical", Impact: "high"},
	{CheckName: "has_redirect", Title: "Has redirect chain", Description: "Page has a redirect chain", Severity: "warning", Impact: "medium"},
	{CheckName: "duplicate_title", Title: "Duplicate title", Description: "Page has the same title as another page", Severity: "warning", Impact: "medium"},
	{CheckName: "duplicate_description", Title: "Duplicate meta description", Description: "Page has the same meta description as another page", Severity: "warning", Impact: "medium"},
	{CheckName: "duplicate_content", Title: "Duplicate content", Description: "Page has substantially similar content to another page", Severity: "warning", Impact: "medium"},
	{CheckName: "no_content_encoding", Title: "No content encoding", Description: "Page response is not compressed (no gzip/brotli)", Severity: "info", Impact: "low"},
	{CheckName: "high_loading_time", Title: "Slow page load", Description: "Page takes too long to load", Severity: "warning", Impact: "medium"},
	{CheckName: "no_image_alt", Title: "Images without alt text", Description: "Page has images missing alt attributes", Severity: "warning", Impact: "medium"},
	{CheckName: "no_image_title", Title: "Images without title", Description: "Page has images missing title attributes", Severity: "info", Impact: "low"},
	{CheckName: "seo_friendly_url_characters_check", Title: "Non-SEO-friendly URL", Description: "URL contains characters that are not SEO-friendly", Severity: "info", Impact: "low"},
	{CheckName: "seo_friendly_url_dynamic_check", Title: "Dynamic URL parameters", Description: "URL contains dynamic query parameters", Severity: "info", Impact: "low"},
	{CheckName: "seo_friendly_url_keywords_check", Title: "URL lacks keywords", Description: "URL does not contain relevant keywords", Severity: "info", Impact: "low"},
	{CheckName: "seo_friendly_url_relative_length_check", Title: "URL too long", Description: "URL path is excessively long", Severity: "info", Impact: "low"},
	{CheckName: "canonical", Title: "Canonical tag issue", Description: "Page has a canonical tag pointing elsewhere", Severity: "info", Impact: "low"},
}

// RunTechnicalAudit runs a DataForSEO On-Page audit on the domain.
// Returns the average on-page score (0-100) and any error.
func (e *AuditEngine) RunTechnicalAudit(ctx context.Context, auditID, clientID uuid.UUID, domain string) (float64, error) {
	// Step 1: Create the on-page task.
	taskID, err := e.dfs.CreateOnPageTask(ctx, dataforseo.OnPageTaskPostRequest{
		Target:           domain,
		MaxCrawlPages:    100,
		EnableJavascript: true,
	})
	if err != nil {
		return 0, fmt.Errorf("create on-page task: %w", err)
	}

	slog.Info("On-page task created",
		"audit_id", auditID,
		"task_id", taskID,
		"domain", domain,
	)

	// Step 2: Poll for completion (every 10s, max 10 retries).
	var summary *dataforseo.OnPageSummary
	for i := 0; i < 10; i++ {
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case <-time.After(10 * time.Second):
		}

		summary, err = e.dfs.GetOnPageSummary(ctx, taskID)
		if err != nil {
			slog.Warn("Failed to get on-page summary, retrying",
				"task_id", taskID,
				"attempt", i+1,
				"error", err,
			)
			continue
		}

		if summary.CrawlProgress == "finished" {
			break
		}

		slog.Info("On-page crawl in progress",
			"task_id", taskID,
			"progress", summary.CrawlProgress,
			"attempt", i+1,
		)
	}

	if summary == nil || summary.CrawlProgress != "finished" {
		return 0, fmt.Errorf("on-page task %s did not finish after polling", taskID)
	}

	// Step 3: Get crawled pages.
	pages, _, err := e.dfs.GetOnPagePages(ctx, taskID, 100, 0)
	if err != nil {
		return 0, fmt.Errorf("get on-page pages: %w", err)
	}

	if len(pages) == 0 {
		slog.Warn("No pages returned from on-page audit", "task_id", taskID)
		return 0, nil
	}

	// Map DataForSEO checks to seo_issues and compute average score.
	var (
		totalScore float64
		pageCount  int
		issues     []seoIssue
	)

	for _, page := range pages {
		if page.ResourceType != "html" {
			continue
		}

		totalScore += page.OnPageScore
		pageCount++

		// Check each technical mapping against the page's checks.
		for _, check := range technicalChecks {
			if flagged, ok := page.Checks[check.CheckName]; ok && flagged {
				issues = append(issues, seoIssue{
					AuditID:          auditID,
					PageID:           uuid.Nil, // Technical checks are page-level from DFS, no local page_id
					ClientID:         clientID,
					Category:         "technical",
					Severity:         check.Severity,
					CheckName:        check.CheckName,
					Title:            check.Title,
					Description:      fmt.Sprintf("%s — %s", check.Description, page.URL),
					CurrentValue:     page.URL,
					RecommendedValue: "Fix the issue",
					Impact:           check.Impact,
				})
			}
		}
	}

	// Batch insert technical issues.
	if len(issues) > 0 {
		if err := batchInsertIssues(ctx, e.db, issues); err != nil {
			slog.Error("Failed to insert technical issues", "audit_id", auditID, "error", err)
			// Non-fatal; continue with score calculation.
		}
	}

	// Return average on-page score.
	if pageCount == 0 {
		return 0, nil
	}
	return totalScore / float64(pageCount), nil
}

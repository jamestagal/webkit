package seo

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
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

// technicalChecks defines the purely-technical checks we extract from DataForSEO Checks map.
// Content-related checks (no_title, no_description, no_h1_tag, no_image_alt) are handled
// separately via page.Meta data with proper content categories for accurate scoring.
var technicalChecks = []technicalCheckMapping{
	{CheckName: "is_redirect", Title: "Redirect detected", Description: "Page redirects to another URL", Severity: "info", Impact: "low"},
	{CheckName: "is_broken", Title: "Broken page", Description: "Page returns an error status code", Severity: "critical", Impact: "high"},
	{CheckName: "is_4xx_code", Title: "4xx error", Description: "Page returns a 4xx client error", Severity: "critical", Impact: "high"},
	{CheckName: "is_5xx_code", Title: "5xx error", Description: "Page returns a 5xx server error", Severity: "critical", Impact: "high"},
	{CheckName: "has_redirect", Title: "Has redirect chain", Description: "Page has a redirect chain", Severity: "warning", Impact: "medium"},
	{CheckName: "duplicate_title", Title: "Duplicate title", Description: "Page has the same title as another page", Severity: "warning", Impact: "medium"},
	{CheckName: "duplicate_description", Title: "Duplicate meta description", Description: "Page has the same meta description as another page", Severity: "warning", Impact: "medium"},
	{CheckName: "duplicate_content", Title: "Duplicate content", Description: "Page has substantially similar content to another page", Severity: "warning", Impact: "medium"},
	{CheckName: "no_content_encoding", Title: "No content encoding", Description: "Page response is not compressed (no gzip/brotli)", Severity: "info", Impact: "low"},
	// NOTE: high_loading_time is handled separately with actual timing data
	// so we don't blindly trust DFS's boolean flag. See processPageTiming().
	// NOTE: seo_friendly_url_characters_check, seo_friendly_url_keywords_check, and
	// seo_friendly_url_relative_length_check are intentionally excluded — DataForSEO
	// flags these too aggressively (e.g. "/about/" as "too long", "/contact/" as "non-SEO-friendly").
	// Only keep the dynamic URL check which catches actual query-string parameters.
	{CheckName: "seo_friendly_url_dynamic_check", Title: "Dynamic URL parameters", Description: "URL contains dynamic query parameters", Severity: "info", Impact: "low"},
	{CheckName: "canonical", Title: "Canonical tag issue", Description: "Page has a canonical tag pointing elsewhere", Severity: "info", Impact: "low"},
}

// RunTechnicalAudit runs a DataForSEO On-Page audit on the domain.
// It also generates content-level SEO issues from the page metadata (title, description,
// headings, word count, etc.) which is more accurate than our markdown-based extractor.
// Returns the average on-page score (0-100) and any error.
func (e *AuditEngine) RunTechnicalAudit(ctx context.Context, auditID, clientID uuid.UUID, domain string) (float64, error) {
	if e.dfs == nil {
		slog.Info("Skipping technical audit — DataForSEO client not configured", "audit_id", auditID)
		return 0, nil
	}

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

	// Step 2: Poll for completion.
	var summary *dataforseo.OnPageSummary
	for i := 0; i < 20; i++ {
		delay := 20 * time.Second
		if i == 0 {
			delay = 60 * time.Second
		}
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case <-time.After(delay):
		}

		summary, err = e.dfs.GetOnPageSummary(ctx, taskID)
		if err != nil {
			if errors.Is(err, dataforseo.ErrTaskNotReady) {
				slog.Info("On-page task still processing, waiting...",
					"task_id", taskID,
					"attempt", i+1,
				)
				continue
			}
			return 0, fmt.Errorf("get on-page summary: %w", err)
		}

		if summary.CrawlProgress == "finished" {
			slog.Info("On-page crawl finished",
				"task_id", taskID,
				"attempt", i+1,
			)
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

	// Log summary metrics for debugging.
	if summary.PageMetrics != nil {
		slog.Info("On-page summary metrics",
			"task_id", taskID,
			"total_pages", summary.PageMetrics.TotalPages,
			"onpage_score", summary.PageMetrics.OnPageScore,
			"broken_links", summary.PageMetrics.BrokenLinks,
			"duplicate_title", summary.PageMetrics.DuplicateTitle,
		)
	}
	if summary.CrawlStatus != nil {
		slog.Info("On-page crawl status",
			"task_id", taskID,
			"pages_crawled", summary.CrawlStatus.PagesCrawled,
			"max_crawl_pages", summary.CrawlStatus.MaxCrawlPages,
		)
	}

	// Step 3: Get crawled pages.
	pages, totalCount, err := e.dfs.GetOnPagePages(ctx, taskID, 100, 0)
	if err != nil {
		return 0, fmt.Errorf("get on-page pages: %w", err)
	}

	slog.Info("On-page pages retrieved",
		"task_id", taskID,
		"returned_count", len(pages),
		"total_count", totalCount,
	)

	if len(pages) == 0 {
		slog.Warn("No pages returned from on-page audit", "task_id", taskID)
		return 0, nil
	}

	// Log resource type distribution for debugging.
	resourceTypes := map[string]int{}
	for _, page := range pages {
		resourceTypes[page.ResourceType]++
	}
	slog.Info("On-page resource type distribution",
		"task_id", taskID,
		"types", fmt.Sprintf("%v", resourceTypes),
	)

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

		slog.Debug("On-page page detail",
			"url", page.URL,
			"score", page.OnPageScore,
			"status", page.StatusCode,
			"has_meta", page.Meta != nil,
		)

		// --- Technical checks from Checks map ---
		for _, check := range technicalChecks {
			if flagged, ok := page.Checks[check.CheckName]; ok && flagged {
				issues = append(issues, seoIssue{
					AuditID:          auditID,
					PageID:           uuid.Nil,
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

		// --- Content checks from page.Meta ---
		// These replace the old RunContentChecks that read from content_pages table,
		// which was inaccurate because it relied on markdown-parsed data from Jina Reader.
		// DataForSEO parses actual HTML, so title/description/headings are accurate.
		if page.Meta != nil {
			issues = append(issues, runDFSContentChecks(auditID, clientID, page)...)
		}

		// --- Page timing check (replaces blind high_loading_time boolean) ---
		if timingIssue := processPageTiming(auditID, clientID, page); timingIssue != nil {
			issues = append(issues, *timingIssue)
		}
	}

	// Batch insert all issues (technical + content).
	if len(issues) > 0 {
		if err := batchInsertIssues(ctx, e.db, issues); err != nil {
			slog.Error("Failed to insert issues", "audit_id", auditID, "error", err)
		}
	}

	slog.Info("On-page audit complete",
		"audit_id", auditID,
		"html_pages", pageCount,
		"total_issues", len(issues),
		"avg_score", func() float64 {
			if pageCount == 0 {
				return 0
			}
			return totalScore / float64(pageCount)
		}(),
	)

	if pageCount == 0 {
		slog.Warn("No HTML pages found in on-page results",
			"audit_id", auditID,
			"task_id", taskID,
			"total_pages_returned", len(pages),
		)
		return 0, nil
	}
	return totalScore / float64(pageCount), nil
}

// processPageTiming checks actual page timing metrics instead of trusting the
// high_loading_time boolean flag from DataForSEO. DFS flags pages as "slow" based
// on their crawler's perspective which can be misleading (e.g. flagging a 2ms load).
// We only raise an issue when LCP > 2.5s (Google's "Good" threshold).
func processPageTiming(auditID, clientID uuid.UUID, page dataforseo.OnPagePage) *seoIssue {
	if page.PageTiming == nil {
		return nil
	}
	t := page.PageTiming

	// Use LCP as the primary metric; fall back to DOMComplete.
	// LCP from DFS is in seconds (e.g. 2.5 = 2.5s).
	metricSec := t.LargestContentfulPaint
	metricName := "LCP"
	if metricSec <= 0 {
		// DOMComplete from DFS is in milliseconds (e.g. 599 = 0.599s).
		// Convert to seconds so all comparisons use the same unit.
		if t.DOMComplete > 0 {
			metricSec = t.DOMComplete / 1000.0
			metricName = "DOM Complete"
		}
	}
	if metricSec <= 0 {
		return nil
	}

	// Google Web Vitals thresholds (in seconds):
	//   Good: ≤ 2.5s, Needs Improvement: ≤ 4s, Poor: > 4s
	if metricSec <= 2.5 {
		return nil // fast enough
	}

	severity := "info"
	if metricSec > 4.0 {
		severity = "warning"
	}

	return &seoIssue{
		AuditID:          auditID,
		PageID:           uuid.Nil,
		ClientID:         clientID,
		Category:         "technical",
		Severity:         severity,
		CheckName:        "high_loading_time",
		Title:            "Slow page load",
		Description:      fmt.Sprintf("Page %s is %.1fs (%s) — %s", metricName, metricSec, severity, page.URL),
		CurrentValue:     fmt.Sprintf("%.1fs %s", metricSec, metricName),
		RecommendedValue: "< 2.5s LCP",
		Impact:           "medium",
	}
}

// runDFSContentChecks generates content-level SEO issues from DataForSEO page metadata.
// This uses real HTML-parsed data from DataForSEO instead of our markdown extractor.
func runDFSContentChecks(auditID, clientID uuid.UUID, page dataforseo.OnPagePage) []seoIssue {
	var issues []seoIssue
	meta := page.Meta

	// 1. missing_title
	if strings.TrimSpace(meta.Title) == "" {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "meta",
			Severity:         "critical",
			CheckName:        "missing_title",
			Title:            "Missing page title",
			Description:      fmt.Sprintf("Page has no title tag. Every page must have a unique, descriptive title. — %s", page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "50-60 characters",
			Impact:           "high",
		})
	}

	// 2. missing_meta_description
	descLen := len(strings.TrimSpace(meta.Description))
	if descLen == 0 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "meta",
			Severity:         "warning",
			CheckName:        "missing_meta_description",
			Title:            "Missing meta description",
			Description:      fmt.Sprintf("Page has no meta description. Add a compelling description for search results. — %s", page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "120-160 characters",
			Impact:           "medium",
		})
	} else {
		// 3. short_meta_description
		if descLen < 120 {
			issues = append(issues, seoIssue{
				AuditID:          auditID,
				PageID:           uuid.Nil,
				ClientID:         clientID,
				Category:         "meta",
				Severity:         "info",
				CheckName:        "short_meta_description",
				Title:            "Short meta description",
				Description:      fmt.Sprintf("Meta description is %d characters. Aim for 120-160 characters. — %s", descLen, page.URL),
				CurrentValue:     page.URL,
				RecommendedValue: "120-160 characters",
				Impact:           "low",
			})
		}

		// 4. long_meta_description
		if descLen > 160 {
			issues = append(issues, seoIssue{
				AuditID:          auditID,
				PageID:           uuid.Nil,
				ClientID:         clientID,
				Category:         "meta",
				Severity:         "info",
				CheckName:        "long_meta_description",
				Title:            "Long meta description",
				Description:      fmt.Sprintf("Meta description is %d characters. It may be truncated in search results. — %s", descLen, page.URL),
				CurrentValue:     page.URL,
				RecommendedValue: "120-160 characters",
				Impact:           "low",
			})
		}
	}

	// 5. missing_h1 — use HTags map from DataForSEO (parsed from actual HTML)
	h1Tags := meta.HTags["h1"]
	if len(h1Tags) == 0 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "critical",
			CheckName:        "missing_h1",
			Title:            "Missing H1 tag",
			Description:      fmt.Sprintf("Page has no H1 heading. Every page should have exactly one H1. — %s", page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "1 H1 tag",
			Impact:           "high",
		})
	}

	// 6. duplicate_h1
	if len(h1Tags) > 1 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "warning",
			CheckName:        "duplicate_h1",
			Title:            "Multiple H1 tags",
			Description:      fmt.Sprintf("Page has %d H1 tags. Use only one H1 per page. — %s", len(h1Tags), page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "1 H1 tag",
			Impact:           "medium",
		})
	}

	// 7. thin_content — use WordCount from DataForSEO Meta (nested content object)
	wordCount := meta.WordCount()
	if wordCount < 100 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "critical",
			CheckName:        "thin_content",
			Title:            "Extremely thin content",
			Description:      fmt.Sprintf("Page has only %d words. Aim for at least 300 words. — %s", wordCount, page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "300+ words",
			Impact:           "high",
		})
	} else if wordCount < 300 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "warning",
			CheckName:        "thin_content",
			Title:            "Thin content",
			Description:      fmt.Sprintf("Page has only %d words. Aim for at least 300 words. — %s", wordCount, page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "300+ words",
			Impact:           "medium",
		})
	}

	// 8. images_missing_alt — use DataForSEO Checks map (more accurate than our regex)
	if flagged, ok := page.Checks["no_image_alt"]; ok && flagged {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "accessibility",
			Severity:         "warning",
			CheckName:        "images_missing_alt",
			Title:            "Images missing alt text",
			Description:      fmt.Sprintf("Page has images missing alt attributes. — %s", page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "All images should have alt text",
			Impact:           "medium",
		})
	}

	// 9. low_internal_links
	if meta.InternalLinksCount < 3 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "internal_links",
			Severity:         "info",
			CheckName:        "low_internal_links",
			Title:            "Low internal linking",
			Description:      fmt.Sprintf("Page has only %d internal links. Add more to improve crawlability. — %s", meta.InternalLinksCount, page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "3+ internal links",
			Impact:           "low",
		})
	}

	// 10. heading_hierarchy — no H2 subheadings on long content
	h2Tags := meta.HTags["h2"]
	if len(h2Tags) == 0 && wordCount > 500 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           uuid.Nil,
			ClientID:         clientID,
			Category:         "structure",
			Severity:         "warning",
			CheckName:        "heading_hierarchy",
			Title:            "Missing subheadings",
			Description:      fmt.Sprintf("Page has %d words but no H2 subheadings. Break up content with headings. — %s", wordCount, page.URL),
			CurrentValue:     page.URL,
			RecommendedValue: "2+ H2 tags for long content",
			Impact:           "medium",
		})
	}

	return issues
}

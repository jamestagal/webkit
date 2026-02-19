package seo

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
)

// contentPage holds the fields needed for content-based SEO checks.
type contentPage struct {
	ID                uuid.UUID
	URL               string
	Title             sql.NullString
	MetaDescription   sql.NullString
	H1Tags            sql.NullString // PostgreSQL TEXT[] stored as string
	H2Tags            sql.NullString
	WordCount         int
	InternalLinksCount int
	ImageCount        int
	ImagesMissingAlt  int
}

// seoIssue represents a single SEO issue to be inserted into seo_issues.
type seoIssue struct {
	AuditID          uuid.UUID
	PageID           uuid.UUID
	ClientID         uuid.UUID
	Category         string
	Severity         string
	CheckName        string
	Title            string
	Description      string
	CurrentValue     string
	RecommendedValue string
	Impact           string
}

// RunContentChecks analyzes crawled pages for content-level SEO issues.
// This function makes NO external API calls; it only reads from the database.
func (e *AuditEngine) RunContentChecks(ctx context.Context, auditID, clientID uuid.UUID) error {
	rows, err := e.db.QueryContext(ctx,
		`SELECT id, url, title, meta_description, h1_tags, h2_tags,
			word_count, internal_links_count, image_count, images_missing_alt
		 FROM content_pages
		 WHERE client_id = $1 AND source_type = 'client'`,
		clientID,
	)
	if err != nil {
		return fmt.Errorf("query content pages: %w", err)
	}
	defer rows.Close()

	var issues []seoIssue

	for rows.Next() {
		var p contentPage
		if err := rows.Scan(
			&p.ID, &p.URL, &p.Title, &p.MetaDescription,
			&p.H1Tags, &p.H2Tags, &p.WordCount,
			&p.InternalLinksCount, &p.ImageCount, &p.ImagesMissingAlt,
		); err != nil {
			slog.Error("Error scanning content page", "error", err)
			continue
		}

		pageIssues := runPageChecks(auditID, clientID, p)
		issues = append(issues, pageIssues...)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate content pages: %w", err)
	}

	if len(issues) == 0 {
		return nil
	}

	// Batch insert all issues.
	return batchInsertIssues(ctx, e.db, issues)
}

// runPageChecks runs all 10 content checks against a single page.
func runPageChecks(auditID, clientID uuid.UUID, p contentPage) []seoIssue {
	var issues []seoIssue

	// 1. thin_content: word_count < 300 (warning), < 100 (critical)
	if p.WordCount < 100 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "critical",
			CheckName:        "thin_content",
			Title:            "Extremely thin content",
			Description:      fmt.Sprintf("Page has only %d words. Aim for at least 300 words.", p.WordCount),
			CurrentValue:     fmt.Sprintf("%d words", p.WordCount),
			RecommendedValue: "300+ words",
			Impact:           "high",
		})
	} else if p.WordCount < 300 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "warning",
			CheckName:        "thin_content",
			Title:            "Thin content",
			Description:      fmt.Sprintf("Page has only %d words. Aim for at least 300 words.", p.WordCount),
			CurrentValue:     fmt.Sprintf("%d words", p.WordCount),
			RecommendedValue: "300+ words",
			Impact:           "medium",
		})
	}

	// 2. missing_h1: h1_tags IS NULL or empty
	h1s := parsePGArray(p.H1Tags)
	if len(h1s) == 0 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "critical",
			CheckName:        "missing_h1",
			Title:            "Missing H1 tag",
			Description:      "Page has no H1 heading. Every page should have exactly one H1.",
			CurrentValue:     "none",
			RecommendedValue: "1 H1 tag",
			Impact:           "high",
		})
	}

	// 3. duplicate_h1: len(h1_tags) > 1
	if len(h1s) > 1 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "content",
			Severity:         "warning",
			CheckName:        "duplicate_h1",
			Title:            "Multiple H1 tags",
			Description:      fmt.Sprintf("Page has %d H1 tags. Use only one H1 per page.", len(h1s)),
			CurrentValue:     fmt.Sprintf("%d H1 tags", len(h1s)),
			RecommendedValue: "1 H1 tag",
			Impact:           "medium",
		})
	}

	// 4. missing_meta_description
	if !p.MetaDescription.Valid || strings.TrimSpace(p.MetaDescription.String) == "" {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "meta",
			Severity:         "warning",
			CheckName:        "missing_meta_description",
			Title:            "Missing meta description",
			Description:      "Page has no meta description. Add a compelling description for search results.",
			CurrentValue:     "none",
			RecommendedValue: "120-160 characters",
			Impact:           "medium",
		})
	} else {
		descLen := len(p.MetaDescription.String)

		// 5. short_meta_description: len < 120
		if descLen < 120 {
			issues = append(issues, seoIssue{
				AuditID:          auditID,
				PageID:           p.ID,
				ClientID:         clientID,
				Category:         "meta",
				Severity:         "info",
				CheckName:        "short_meta_description",
				Title:            "Short meta description",
				Description:      fmt.Sprintf("Meta description is %d characters. Aim for 120-160 characters.", descLen),
				CurrentValue:     fmt.Sprintf("%d characters", descLen),
				RecommendedValue: "120-160 characters",
				Impact:           "low",
			})
		}

		// 6. long_meta_description: len > 160
		if descLen > 160 {
			issues = append(issues, seoIssue{
				AuditID:          auditID,
				PageID:           p.ID,
				ClientID:         clientID,
				Category:         "meta",
				Severity:         "info",
				CheckName:        "long_meta_description",
				Title:            "Long meta description",
				Description:      fmt.Sprintf("Meta description is %d characters. It may be truncated in search results.", descLen),
				CurrentValue:     fmt.Sprintf("%d characters", descLen),
				RecommendedValue: "120-160 characters",
				Impact:           "low",
			})
		}
	}

	// 7. missing_title
	if !p.Title.Valid || strings.TrimSpace(p.Title.String) == "" {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "meta",
			Severity:         "critical",
			CheckName:        "missing_title",
			Title:            "Missing page title",
			Description:      "Page has no title tag. Every page must have a unique, descriptive title.",
			CurrentValue:     "none",
			RecommendedValue: "50-60 characters",
			Impact:           "high",
		})
	}

	// 8. images_missing_alt
	if p.ImagesMissingAlt > 0 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "accessibility",
			Severity:         "warning",
			CheckName:        "images_missing_alt",
			Title:            "Images missing alt text",
			Description:      fmt.Sprintf("%d of %d images are missing alt text.", p.ImagesMissingAlt, p.ImageCount),
			CurrentValue:     fmt.Sprintf("%d missing", p.ImagesMissingAlt),
			RecommendedValue: "0 missing",
			Impact:           "medium",
		})
	}

	// 9. low_internal_links: internal_links_count < 3
	if p.InternalLinksCount < 3 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "internal_links",
			Severity:         "info",
			CheckName:        "low_internal_links",
			Title:            "Low internal linking",
			Description:      fmt.Sprintf("Page has only %d internal links. Add more to improve crawlability.", p.InternalLinksCount),
			CurrentValue:     fmt.Sprintf("%d links", p.InternalLinksCount),
			RecommendedValue: "3+ internal links",
			Impact:           "low",
		})
	}

	// 10. heading_hierarchy: h2_tags empty but word_count > 500
	h2s := parsePGArray(p.H2Tags)
	if len(h2s) == 0 && p.WordCount > 500 {
		issues = append(issues, seoIssue{
			AuditID:          auditID,
			PageID:           p.ID,
			ClientID:         clientID,
			Category:         "structure",
			Severity:         "warning",
			CheckName:        "heading_hierarchy",
			Title:            "Missing subheadings",
			Description:      fmt.Sprintf("Page has %d words but no H2 subheadings. Break up content with headings.", p.WordCount),
			CurrentValue:     "0 H2 tags",
			RecommendedValue: "2+ H2 tags for long content",
			Impact:           "medium",
		})
	}

	return issues
}

// parsePGArray parses a PostgreSQL TEXT[] value like {val1,val2} into a string slice.
// Returns nil for NULL or empty arrays.
func parsePGArray(ns sql.NullString) []string {
	if !ns.Valid {
		return nil
	}
	s := strings.TrimSpace(ns.String)
	if s == "" || s == "{}" {
		return nil
	}
	// Strip outer braces.
	s = s[1 : len(s)-1]
	if s == "" {
		return nil
	}

	var result []string
	var current strings.Builder
	inQuote := false
	escaped := false

	for _, r := range s {
		if escaped {
			current.WriteRune(r)
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		if r == '"' {
			inQuote = !inQuote
			continue
		}
		if r == ',' && !inQuote {
			val := strings.TrimSpace(current.String())
			if val != "" {
				result = append(result, val)
			}
			current.Reset()
			continue
		}
		current.WriteRune(r)
	}
	// Last element.
	if val := strings.TrimSpace(current.String()); val != "" {
		result = append(result, val)
	}

	return result
}

// batchInsertIssues inserts all issues in a single transaction.
func batchInsertIssues(ctx context.Context, db *sql.DB, issues []seoIssue) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO seo_issues (id, audit_id, page_id, client_id, category, severity, check_name, title, description, current_value, recommended_value, impact)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
	)
	if err != nil {
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	for _, issue := range issues {
		_, err := stmt.ExecContext(ctx,
			uuid.New(),
			issue.AuditID,
			issue.PageID,
			issue.ClientID,
			issue.Category,
			issue.Severity,
			issue.CheckName,
			issue.Title,
			issue.Description,
			issue.CurrentValue,
			issue.RecommendedValue,
			issue.Impact,
		)
		if err != nil {
			slog.Error("Failed to insert SEO issue",
				"check_name", issue.CheckName,
				"page_id", issue.PageID,
				"error", err,
			)
			// Continue inserting remaining issues.
		}
	}

	return tx.Commit()
}

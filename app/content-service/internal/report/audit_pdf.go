package report

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// GenerateAuditPDF fetches audit data from the database, renders an HTML report,
// and converts it to PDF via Gotenberg's Chromium endpoint.
func GenerateAuditPDF(ctx context.Context, db *sql.DB, gotenbergURL string, agencyID, auditID uuid.UUID) ([]byte, error) {
	data, err := fetchAuditData(ctx, db, agencyID, auditID)
	if err != nil {
		return nil, fmt.Errorf("fetch audit data: %w", err)
	}

	htmlContent := RenderHTML(data)

	pdfBytes, err := convertHTMLToPDF(ctx, gotenbergURL, htmlContent)
	if err != nil {
		return nil, fmt.Errorf("convert html to pdf: %w", err)
	}

	return pdfBytes, nil
}

// fetchAuditData gathers all data needed for the report from the database.
func fetchAuditData(ctx context.Context, db *sql.DB, agencyID, auditID uuid.UUID) (auditData, error) {
	var d auditData

	// --- Fetch audit ---
	var overallScore, technicalScore, contentScore, backlinkScore, keywordScore sql.NullInt32
	var startedAt, completedAt sql.NullTime
	var clientID uuid.UUID

	err := db.QueryRowContext(ctx,
		`SELECT client_id, overall_score, technical_score, content_score,
			backlink_score, keyword_score, total_pages, critical_issues,
			warning_issues, passed_checks, opportunities, started_at, completed_at
		 FROM seo_audits WHERE id = $1 AND agency_id = $2`,
		auditID, agencyID,
	).Scan(
		&clientID, &overallScore, &technicalScore, &contentScore,
		&backlinkScore, &keywordScore, &d.TotalPages, &d.CriticalIssues,
		&d.WarningIssues, &d.PassedChecks, &d.Opportunities, &startedAt, &completedAt,
	)
	if err != nil {
		return d, fmt.Errorf("query audit: %w", err)
	}

	if overallScore.Valid {
		v := int(overallScore.Int32)
		d.OverallScore = &v
	}
	if technicalScore.Valid {
		v := int(technicalScore.Int32)
		d.TechnicalScore = &v
	}
	if contentScore.Valid {
		v := int(contentScore.Int32)
		d.ContentScore = &v
	}
	if backlinkScore.Valid {
		v := int(backlinkScore.Int32)
		d.BacklinkScore = &v
	}
	if keywordScore.Valid {
		v := int(keywordScore.Int32)
		d.KeywordScore = &v
	}

	if completedAt.Valid {
		d.AuditDate = completedAt.Time
	} else if startedAt.Valid {
		d.AuditDate = startedAt.Time
	} else {
		d.AuditDate = time.Now()
	}

	// --- Fetch client info ---
	err = db.QueryRowContext(ctx,
		`SELECT business_name, website_url FROM clients WHERE id = $1`,
		clientID,
	).Scan(&d.BusinessName, &d.WebsiteURL)
	if err != nil {
		slog.Warn("Could not fetch client info for report", "client_id", clientID, "error", err)
		d.BusinessName = "Unknown Client"
		d.WebsiteURL = ""
	}

	// --- Fetch top 20 issues by severity ---
	issueRows, err := db.QueryContext(ctx,
		`SELECT title, category, severity, description
		 FROM seo_issues WHERE audit_id = $1
		 ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 WHEN 'info' THEN 3 ELSE 4 END
		 LIMIT 20`,
		auditID,
	)
	if err != nil {
		slog.Warn("Could not fetch issues for report", "audit_id", auditID, "error", err)
	} else {
		defer issueRows.Close()
		for issueRows.Next() {
			var issue issueData
			if err := issueRows.Scan(&issue.Title, &issue.Category, &issue.Severity, &issue.Description); err != nil {
				slog.Warn("Error scanning issue row", "error", err)
				continue
			}
			d.Issues = append(d.Issues, issue)
		}
	}

	// --- Fetch backlink profile ---
	var bl backlinkData
	err = db.QueryRowContext(ctx,
		`SELECT total_backlinks, referring_domains, dofollow_links, nofollow_links, domain_rank, spam_score
		 FROM backlink_profiles WHERE audit_id = $1`,
		auditID,
	).Scan(&bl.TotalBacklinks, &bl.ReferringDomains, &bl.DofollowLinks, &bl.NofollowLinks, &bl.DomainRank, &bl.SpamScore)
	if err == nil {
		d.Backlinks = &bl
	} else if err != sql.ErrNoRows {
		slog.Warn("Could not fetch backlink profile for report", "audit_id", auditID, "error", err)
	}

	// --- Fetch keyword profile ---
	var kw keywordData
	err = db.QueryRowContext(ctx,
		`SELECT total_ranking_keywords, keywords_top_3, keywords_top_10, keywords_top_50, total_keyword_gaps, estimated_traffic
		 FROM keyword_profiles WHERE audit_id = $1`,
		auditID,
	).Scan(&kw.TotalRankingKeywords, &kw.KeywordsTop3, &kw.KeywordsTop10, &kw.KeywordsTop50, &kw.TotalKeywordGaps, &kw.EstimatedTraffic)
	if err == nil {
		d.Keywords = &kw
	} else if err != sql.ErrNoRows {
		slog.Warn("Could not fetch keyword profile for report", "audit_id", auditID, "error", err)
	}

	// --- Fetch competitors ---
	compRows, err := db.QueryContext(ctx,
		`SELECT competitor_domain, domain_rank, total_backlinks, referring_domains, total_ranking_keywords, estimated_traffic
		 FROM competitor_analyses WHERE audit_id = $1
		 ORDER BY estimated_traffic DESC`,
		auditID,
	)
	if err != nil {
		slog.Warn("Could not fetch competitors for report", "audit_id", auditID, "error", err)
	} else {
		defer compRows.Close()
		for compRows.Next() {
			var c competitorData
			if err := compRows.Scan(&c.Domain, &c.DomainRank, &c.TotalBacklinks, &c.ReferringDomains, &c.RankingKeywords, &c.EstimatedTraffic); err != nil {
				slog.Warn("Error scanning competitor row", "error", err)
				continue
			}
			d.Competitors = append(d.Competitors, c)
		}
	}

	return d, nil
}

// convertHTMLToPDF sends HTML to Gotenberg's Chromium convert endpoint and returns the PDF bytes.
func convertHTMLToPDF(ctx context.Context, gotenbergURL, htmlContent string) ([]byte, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add the HTML file as a form file upload (Gotenberg expects "index.html").
	part, err := writer.CreateFormFile("files", "index.html")
	if err != nil {
		return nil, fmt.Errorf("create form file: %w", err)
	}
	if _, err := io.WriteString(part, htmlContent); err != nil {
		return nil, fmt.Errorf("write html to form: %w", err)
	}

	// Set paper dimensions (A4).
	_ = writer.WriteField("paperWidth", "8.27")
	_ = writer.WriteField("paperHeight", "11.69")
	_ = writer.WriteField("marginTop", "0.4")
	_ = writer.WriteField("marginBottom", "0.4")
	_ = writer.WriteField("marginLeft", "0.4")
	_ = writer.WriteField("marginRight", "0.4")
	_ = writer.WriteField("printBackground", "true")

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart writer: %w", err)
	}

	// POST to Gotenberg.
	url := gotenbergURL + "/forms/chromium/convert/html"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &buf)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gotenberg request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gotenberg returned %d: %s", resp.StatusCode, string(body))
	}

	pdfBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read gotenberg response: %w", err)
	}

	return pdfBytes, nil
}

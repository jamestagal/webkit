package export

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ExportRequest describes which copy items to export and in what format.
type ExportRequest struct {
	Format          string   `json:"format"`            // markdown, txt, pdf
	Scope           string   `json:"scope"`             // final_only, all, selected
	SelectedCopyIDs []string `json:"selected_copy_ids"` // used when scope=selected
}

// ExportResult is the binary payload to be sent back to the caller.
type ExportResult struct {
	Data        []byte
	Filename    string
	ContentType string
}

// copyRow holds a single content_copy row for export rendering.
type copyRow struct {
	ID              string
	CopyType        string
	Title           string
	Content         string
	TargetKeyword   sql.NullString
	TargetWordCount sql.NullInt32
	ActualWordCount int
	Status          string
	CreatedAt       time.Time
}

// Export fetches copy rows matching the request scope and routes to the
// appropriate format handler.
func Export(
	ctx context.Context,
	db *sql.DB,
	gotenbergURL string,
	agencyID, clientID uuid.UUID,
	req ExportRequest,
) (*ExportResult, error) {
	// Validate format.
	switch req.Format {
	case "markdown", "txt", "pdf":
	default:
		return nil, fmt.Errorf("unsupported export format: %s", req.Format)
	}

	// Validate scope.
	switch req.Scope {
	case "final_only", "all", "selected":
	default:
		return nil, fmt.Errorf("unsupported export scope: %s", req.Scope)
	}

	// Fetch matching copy rows.
	rows, err := fetchCopyRows(ctx, db, agencyID, clientID, req)
	if err != nil {
		return nil, fmt.Errorf("fetching copy rows: %w", err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("no copy items found for the given scope")
	}

	// Resolve a human-friendly domain label for filenames.
	domain := resolveClientDomain(ctx, db, agencyID, clientID)

	// Route to format handler.
	switch req.Format {
	case "markdown":
		return exportMarkdown(rows, domain)
	case "txt":
		return exportText(rows, domain)
	case "pdf":
		return exportPDF(ctx, gotenbergURL, rows, domain)
	default:
		return nil, fmt.Errorf("unsupported format: %s", req.Format)
	}
}

// fetchCopyRows builds and executes the query for the requested scope.
func fetchCopyRows(
	ctx context.Context,
	db *sql.DB,
	agencyID, clientID uuid.UUID,
	req ExportRequest,
) ([]copyRow, error) {
	query := `SELECT id, copy_type, title, content, target_keyword,
	                 target_word_count, actual_word_count, status, created_at
	          FROM content_copy
	          WHERE client_id = $1 AND agency_id = $2`
	args := []any{clientID, agencyID}
	argIdx := 3

	switch req.Scope {
	case "final_only":
		query += " AND status = 'final'"
	case "selected":
		if len(req.SelectedCopyIDs) == 0 {
			return nil, fmt.Errorf("scope=selected but no selected_copy_ids provided")
		}
		placeholders := make([]string, len(req.SelectedCopyIDs))
		for i, id := range req.SelectedCopyIDs {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, id)
			argIdx++
		}
		query += " AND id IN (" + strings.Join(placeholders, ",") + ")"
	}

	query += " ORDER BY created_at ASC"

	dbRows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer dbRows.Close()

	var result []copyRow
	for dbRows.Next() {
		var c copyRow
		if err := dbRows.Scan(
			&c.ID, &c.CopyType, &c.Title, &c.Content, &c.TargetKeyword,
			&c.TargetWordCount, &c.ActualWordCount, &c.Status, &c.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning copy row: %w", err)
		}
		result = append(result, c)
	}
	return result, dbRows.Err()
}

// resolveClientDomain returns a filesystem-safe label derived from the
// most recent crawl job's source_url, falling back to the client's
// business_name.
func resolveClientDomain(ctx context.Context, db *sql.DB, agencyID, clientID uuid.UUID) string {
	// Try the latest crawl job source_url.
	var sourceURL sql.NullString
	_ = db.QueryRowContext(ctx,
		`SELECT source_url FROM content_crawl_jobs
		 WHERE client_id = $1 AND agency_id = $2
		 ORDER BY created_at DESC LIMIT 1`,
		clientID, agencyID,
	).Scan(&sourceURL)

	if sourceURL.Valid && sourceURL.String != "" {
		if u, err := url.Parse(sourceURL.String); err == nil && u.Host != "" {
			return sanitiseFilename(u.Host)
		}
	}

	// Fallback: client business_name.
	var bizName sql.NullString
	_ = db.QueryRowContext(ctx,
		`SELECT business_name FROM clients WHERE id = $1 AND agency_id = $2`,
		clientID, agencyID,
	).Scan(&bizName)

	if bizName.Valid && bizName.String != "" {
		return sanitiseFilename(bizName.String)
	}

	slog.Warn("Could not resolve client domain for export filename",
		"client_id", clientID, "agency_id", agencyID)
	return "export"
}

// sanitiseFilename replaces characters that are unsafe in filenames.
func sanitiseFilename(s string) string {
	s = strings.ToLower(s)
	replacer := strings.NewReplacer(
		" ", "-",
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "",
	)
	return replacer.Replace(s)
}

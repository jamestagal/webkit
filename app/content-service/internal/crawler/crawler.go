package crawler

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"strings"
	"sync"
	"time"

	"app/pkg/cfbrowser"
	"app/pkg/jina"

	"github.com/gocolly/colly/v2"
	"github.com/google/uuid"
)

// CrawlConfig holds configuration for a crawl job.
type CrawlConfig struct {
	SourceURL   string
	MaxDepth    int
	MaxPages    int
	Parallelism int
	CrawlDelay  time.Duration
	CrawlTarget string // "client" or "competitor"
	JobID       uuid.UUID
	AgencyID    uuid.UUID
	ClientID    uuid.UUID
}

// CrawlResult holds the outcome of a crawl job.
type CrawlResult struct {
	PagesDiscovered int
	PagesProcessed  int
	PagesChanged    int
	Error           error
}

// PageData holds extracted data from a single crawled page.
type PageData struct {
	URL                string
	CanonicalURL       string
	PageType           string
	ClassConfidence    float64
	ClassMethod        string
	Title              string
	MetaDescription    string
	H1Tags             []string
	H2Tags             []string
	BodyText           string
	MarkdownContent    string
	WordCount          int
	ReadingTimeMinutes int
	HTTPStatus         int
	ContentHash        string
	SchemaTypes        []string
	HasCanonical       bool
	HasRobotsMeta      bool
	RobotsDirectives   string
	InternalLinksCount int
	ExternalLinksCount int
	ImageCount         int
	ImagesMissingAlt   int
}

// Crawler coordinates a Colly-based crawl of a website.
type Crawler struct {
	cfg          CrawlConfig
	db           *sql.DB
	transport    *BrowserTransport
	classifier   *Classifier
	mu           sync.Mutex
	result       CrawlResult
	failedVisits int
}

// New creates a new Crawler instance.
func New(cfg CrawlConfig, db *sql.DB, cf *cfbrowser.Client, jinaClient *jina.Client, anthropicKey string) *Crawler {
	// Apply defaults
	if cfg.MaxDepth <= 0 {
		cfg.MaxDepth = 3
	}
	if cfg.MaxPages <= 0 {
		cfg.MaxPages = 200
	}
	if cfg.Parallelism <= 0 {
		cfg.Parallelism = 3
	}
	if cfg.CrawlDelay <= 0 {
		cfg.CrawlDelay = 2 * time.Second
	}
	if cfg.CrawlTarget == "" {
		cfg.CrawlTarget = "client"
	}

	return &Crawler{
		cfg:        cfg,
		db:         db,
		transport:  NewBrowserTransport(cf, jinaClient),
		classifier: NewClassifier(anthropicKey),
	}
}

// Run executes the crawl and returns the result.
func (c *Crawler) Run(ctx context.Context) CrawlResult {
	slog.Info("Starting crawl",
		"job_id", c.cfg.JobID,
		"source_url", c.cfg.SourceURL,
		"max_depth", c.cfg.MaxDepth,
		"max_pages", c.cfg.MaxPages,
	)

	// Extract the allowed domain from source URL
	sourceURL, err := url.Parse(c.cfg.SourceURL)
	if err != nil {
		c.result.Error = fmt.Errorf("invalid source URL: %w", err)
		return c.result
	}
	allowedDomain := sourceURL.Hostname()

	// 1. Try to fetch sitemap
	sitemapURLs, _ := ParseSitemap(ctx, c.cfg.SourceURL)
	slog.Info("Sitemap parsed", "urls_found", len(sitemapURLs))

	// 2. Create Colly collector
	collector := colly.NewCollector(
		colly.MaxDepth(c.cfg.MaxDepth),
		colly.Async(true),
		colly.AllowedDomains(allowedDomain),
	)

	// Set rate limiting
	err = collector.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Parallelism: c.cfg.Parallelism,
		Delay:       c.cfg.CrawlDelay,
	})
	if err != nil {
		slog.Warn("Failed to set rate limit", "error", err)
	}

	// 3. Set custom transport for browser rendering
	collector.WithTransport(c.transport)

	// 4. OnResponse: process each page
	collector.OnResponse(func(r *colly.Response) {
		// Check if we've exceeded max pages
		c.mu.Lock()
		if c.result.PagesProcessed >= c.cfg.MaxPages {
			c.mu.Unlock()
			return
		}
		c.result.PagesDiscovered++
		c.mu.Unlock()

		pageURL := r.Request.URL.String()
		markdownContent := string(r.Body)

		// Get stored links and HTML title from transport
		links := c.transport.GetStoredLinks(pageURL)
		htmlTitle := c.transport.GetStoredTitle(pageURL)

		// Visit discovered links
		for _, link := range links {
			if link.URL == "" {
				continue
			}
			// Resolve relative URLs
			linkURL, err := r.Request.URL.Parse(link.URL)
			if err != nil {
				continue
			}
			// Only visit links on the allowed domain
			if linkURL.Hostname() == allowedDomain {
				_ = r.Request.Visit(linkURL.String())
			}
		}

		// Classify the page — prefer HTML title, fall back to H1/Jina markdown
		title := htmlTitle
		if title == "" {
			title = extractTitleFromMarkdown(markdownContent)
		}
		slog.Debug("Page title resolved", "url", pageURL, "title", title, "html_title", htmlTitle)
		classification := c.classifier.Classify(ctx, pageURL, title, markdownContent)

		// Extract page data — pass resolved title (HTML title or markdown fallback)
		pageData := ExtractPageData(pageURL, markdownContent, links, classification, c.cfg.SourceURL, title)

		// Upsert into content_pages
		changed, upsertErr := c.upsertPage(ctx, pageData)
		if upsertErr != nil {
			slog.Error("Failed to upsert page", "url", pageURL, "error", upsertErr)
			return
		}

		c.mu.Lock()
		c.result.PagesProcessed++
		if changed {
			c.result.PagesChanged++
		}
		c.mu.Unlock()

		slog.Debug("Processed page",
			"url", pageURL,
			"type", classification.PageType,
			"method", classification.Method,
			"words", pageData.WordCount,
		)

		// Update job progress periodically
		c.mu.Lock()
		processed := c.result.PagesProcessed
		discovered := c.result.PagesDiscovered
		changedCount := c.result.PagesChanged
		c.mu.Unlock()

		if processed%5 == 0 {
			c.updateJobProgress(ctx, discovered, processed, changedCount)
		}
	})

	collector.OnError(func(r *colly.Response, err error) {
		slog.Warn("Crawl error", "url", r.Request.URL.String(), "error", err)
		c.mu.Lock()
		c.failedVisits++
		c.mu.Unlock()
	})

	// 5. Start crawling
	if len(sitemapURLs) > 0 {
		for _, u := range sitemapURLs {
			c.mu.Lock()
			if c.result.PagesProcessed >= c.cfg.MaxPages {
				c.mu.Unlock()
				break
			}
			c.mu.Unlock()
			_ = collector.Visit(u)
		}
	}
	// Always visit the source URL as well
	_ = collector.Visit(c.cfg.SourceURL)

	// 6. Wait for completion
	collector.Wait()

	slog.Info("Crawl completed",
		"job_id", c.cfg.JobID,
		"discovered", c.result.PagesDiscovered,
		"processed", c.result.PagesProcessed,
		"changed", c.result.PagesChanged,
		"failed", c.failedVisits,
	)

	// 7. Detect silent failures — if we attempted pages but discovered none,
	// the crawl should report an error rather than "success with 0 pages".
	if c.result.PagesDiscovered == 0 && c.failedVisits > 0 {
		c.result.Error = fmt.Errorf(
			"crawl discovered 0 pages but %d page fetch(es) failed — the site may be blocking automated access (Cloudflare, rate limiting, etc.)",
			c.failedVisits,
		)
	}

	return c.result
}

// upsertPage inserts or updates a page in content_pages. Returns true if content changed.
func (c *Crawler) upsertPage(ctx context.Context, pd PageData) (bool, error) {
	pageID := uuid.New()
	sourceType := c.cfg.CrawlTarget

	query := `
		INSERT INTO content_pages (
			id, client_id, crawl_job_id, url, canonical_url, source_type,
			page_type, classification_confidence, classification_method,
			title, meta_description, h1_tags, h2_tags,
			body_text, markdown_content, word_count, reading_time_minutes,
			http_status, content_hash, schema_types,
			has_canonical, has_robots_meta, robots_directives,
			internal_links_count, external_links_count,
			image_count, images_missing_alt
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9,
			$10, $11, $12, $13,
			$14, $15, $16, $17,
			$18, $19, $20,
			$21, $22, $23,
			$24, $25,
			$26, $27
		)
		ON CONFLICT (client_id, url) DO UPDATE SET
			crawl_job_id = EXCLUDED.crawl_job_id,
			canonical_url = EXCLUDED.canonical_url,
			page_type = EXCLUDED.page_type,
			classification_confidence = EXCLUDED.classification_confidence,
			classification_method = EXCLUDED.classification_method,
			title = EXCLUDED.title,
			meta_description = EXCLUDED.meta_description,
			h1_tags = EXCLUDED.h1_tags,
			h2_tags = EXCLUDED.h2_tags,
			body_text = EXCLUDED.body_text,
			markdown_content = EXCLUDED.markdown_content,
			word_count = EXCLUDED.word_count,
			reading_time_minutes = EXCLUDED.reading_time_minutes,
			http_status = EXCLUDED.http_status,
			content_hash = EXCLUDED.content_hash,
			schema_types = EXCLUDED.schema_types,
			has_canonical = EXCLUDED.has_canonical,
			has_robots_meta = EXCLUDED.has_robots_meta,
			robots_directives = EXCLUDED.robots_directives,
			internal_links_count = EXCLUDED.internal_links_count,
			external_links_count = EXCLUDED.external_links_count,
			image_count = EXCLUDED.image_count,
			images_missing_alt = EXCLUDED.images_missing_alt,
			last_scraped_at = NOW(),
			content_changed_at = CASE
				WHEN content_pages.content_hash != EXCLUDED.content_hash THEN NOW()
				ELSE content_pages.content_changed_at
			END,
			updated_at = NOW()
		RETURNING (xmax = 0) AS is_insert,
			CASE WHEN xmax != 0 AND content_hash != $19 THEN TRUE ELSE FALSE END AS content_changed`

	var isInsert, contentChanged bool
	err := c.db.QueryRowContext(ctx, query,
		pageID,                          // $1
		c.cfg.ClientID,                  // $2
		c.cfg.JobID,                     // $3
		pd.URL,                          // $4
		pd.CanonicalURL,                 // $5
		sourceType,                      // $6
		pd.PageType,                     // $7
		pd.ClassConfidence,              // $8
		pd.ClassMethod,                  // $9
		pd.Title,                        // $10
		pd.MetaDescription,              // $11
		formatPGArray(pd.H1Tags),        // $12
		formatPGArray(pd.H2Tags),        // $13
		pd.BodyText,                     // $14
		pd.MarkdownContent,              // $15
		pd.WordCount,                    // $16
		pd.ReadingTimeMinutes,           // $17
		pd.HTTPStatus,                   // $18
		pd.ContentHash,                  // $19
		formatPGArray(pd.SchemaTypes),   // $20
		pd.HasCanonical,                 // $21
		pd.HasRobotsMeta,                // $22
		pd.RobotsDirectives,             // $23
		pd.InternalLinksCount,           // $24
		pd.ExternalLinksCount,           // $25
		pd.ImageCount,                   // $26
		pd.ImagesMissingAlt,             // $27
	).Scan(&isInsert, &contentChanged)

	if err != nil {
		return false, fmt.Errorf("upsert page %s: %w", pd.URL, err)
	}

	return isInsert || contentChanged, nil
}

// updateJobProgress updates the crawl job's progress counters.
func (c *Crawler) updateJobProgress(ctx context.Context, discovered, processed, changed int) {
	_, err := c.db.ExecContext(ctx,
		`UPDATE content_crawl_jobs SET pages_discovered = $1, pages_processed = $2, pages_changed = $3, updated_at = NOW() WHERE id = $4`,
		discovered, processed, changed, c.cfg.JobID,
	)
	if err != nil {
		slog.Warn("Failed to update job progress", "job_id", c.cfg.JobID, "error", err)
	}
}

// formatPGArray formats a string slice as a PostgreSQL TEXT[] literal: {val1,val2,...}
func formatPGArray(vals []string) string {
	if len(vals) == 0 {
		return "{}"
	}

	escaped := make([]string, len(vals))
	for i, v := range vals {
		// Escape backslashes and double quotes for PostgreSQL array format
		v = strings.ReplaceAll(v, `\`, `\\`)
		v = strings.ReplaceAll(v, `"`, `\"`)
		escaped[i] = `"` + v + `"`
	}
	return "{" + strings.Join(escaped, ",") + "}"
}

// extractTitleFromMarkdown extracts the first H1 heading from markdown.
// Falls back to "Title: ..." metadata line (Jina Reader format).
func extractTitleFromMarkdown(markdown string) string {
	reader := strings.NewReader(markdown)
	var jinaTitle string
	// Read line by line looking for # heading or Title: metadata
	for {
		b, err := readLine(reader)
		if err != nil {
			break
		}
		line := string(b)
		if strings.HasPrefix(line, "# ") {
			return strings.TrimSpace(line[2:])
		}
		if jinaTitle == "" && strings.HasPrefix(line, "Title:") {
			jinaTitle = strings.TrimSpace(line[len("Title:"):])
		}
	}
	return jinaTitle
}

// readLine reads a single line from a reader.
func readLine(r *strings.Reader) ([]byte, error) {
	var line []byte
	for {
		b, err := r.ReadByte()
		if err != nil {
			if err == io.EOF && len(line) > 0 {
				return line, nil
			}
			return nil, err
		}
		if b == '\n' {
			return line, nil
		}
		line = append(line, b)
	}
}

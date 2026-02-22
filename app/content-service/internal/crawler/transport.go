package crawler

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"app/pkg/cfbrowser"
	"app/pkg/jina"
)

// BrowserTransport is a custom http.RoundTripper that uses Cloudflare Browser
// Rendering (with Jina fallback) to fetch page content as markdown.
// It stores discovered links per URL for later retrieval.
type BrowserTransport struct {
	cfClient   *cfbrowser.Client
	jinaClient *jina.Client
	links      sync.Map // url string → []cfbrowser.Link
	titles     sync.Map // url string → string (HTML <title>)
}

// NewBrowserTransport creates a new transport that fetches pages via browser rendering.
func NewBrowserTransport(cf *cfbrowser.Client, jina *jina.Client) *BrowserTransport {
	return &BrowserTransport{
		cfClient:   cf,
		jinaClient: jina,
	}
}

// RoundTrip implements http.RoundTripper. It fetches the URL via browser rendering
// services and returns a synthetic HTTP response with the markdown content as body.
func (t *BrowserTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	pageURL := req.URL.String()

	// 1. Get markdown via CF Browser Rendering, fallback to Jina
	var md *cfbrowser.MarkdownResponse

	if t.cfClient != nil {
		cfResp, err := t.cfClient.GetMarkdown(req.Context(), pageURL)
		if err != nil {
			slog.Debug("CF Browser Rendering failed, trying Jina", "url", pageURL, "error", err)
		} else {
			md = cfResp
		}
	}

	if md == nil && t.jinaClient != nil {
		content, jinaErr := t.jinaClient.GetMarkdown(req.Context(), pageURL)
		if jinaErr != nil {
			if t.cfClient != nil {
				return nil, fmt.Errorf("both rendering services failed for %s: %v", pageURL, jinaErr)
			}
			return nil, fmt.Errorf("jina rendering failed for %s: %w", pageURL, jinaErr)
		}
		// Jina Reader returns metadata header lines like "Title: ...\nURL Source: ...\n\n"
		// Extract the title from the header before treating the rest as content.
		title, cleanContent := extractJinaTitle(content)
		md = &cfbrowser.MarkdownResponse{Content: cleanContent, Title: title, URL: pageURL}
		slog.Debug("Used Jina fallback", "url", pageURL, "title", title)
	}

	if md == nil {
		return nil, fmt.Errorf("no rendering service available for %s", pageURL)
	}

	// 2. Store HTML <title> if available
	if md.Title != "" {
		t.titles.Store(pageURL, md.Title)
	}

	// 3. Get links (best-effort, only via CF Browser since it has GetLinks)
	if t.cfClient != nil {
		links, linkErr := t.cfClient.GetLinks(req.Context(), pageURL)
		if linkErr == nil && links != nil {
			t.links.Store(pageURL, links.Links)
		} else if linkErr != nil {
			slog.Debug("Failed to get links", "url", pageURL, "error", linkErr)
		}
	}

	// 4. Return synthetic response with markdown as body
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/markdown"}},
		Body:       io.NopCloser(strings.NewReader(md.Content)),
		Request:    req,
	}, nil
}

// GetStoredLinks retrieves and removes the links discovered for a given URL.
func (t *BrowserTransport) GetStoredLinks(pageURL string) []cfbrowser.Link {
	if v, ok := t.links.LoadAndDelete(pageURL); ok {
		return v.([]cfbrowser.Link)
	}
	return nil
}

// GetStoredTitle retrieves and removes the HTML <title> for a given URL.
func (t *BrowserTransport) GetStoredTitle(pageURL string) string {
	if v, ok := t.titles.LoadAndDelete(pageURL); ok {
		return v.(string)
	}
	return ""
}

// extractJinaTitle extracts the "Title: ..." line from Jina Reader output.
// Jina returns a header block like:
//
//	Title: Page Title Here
//	URL Source: https://example.com
//	Published Time: ...
//	(blank line)
//	Markdown content...
//
// Returns the extracted title and the content with the header stripped.
func extractJinaTitle(raw string) (title, content string) {
	// Find the first blank line — it separates the Jina metadata from content.
	// Scan at most 2000 bytes to avoid processing huge content.
	scanLimit := len(raw)
	if scanLimit > 2000 {
		scanLimit = 2000
	}
	headerEnd := -1
	pos := 0
	for pos < scanLimit {
		nlIdx := strings.IndexByte(raw[pos:], '\n')
		if nlIdx < 0 {
			break
		}
		line := raw[pos : pos+nlIdx]
		trimmed := strings.TrimSpace(line)

		if trimmed == "" && pos > 0 {
			headerEnd = pos + nlIdx + 1 // byte offset right after the blank line
			break
		}
		if strings.HasPrefix(trimmed, "Title:") {
			title = strings.TrimSpace(trimmed[len("Title:"):])
		}
		pos += nlIdx + 1
	}
	if headerEnd > 0 && title != "" {
		return title, strings.TrimSpace(raw[headerEnd:])
	}
	return "", raw
}

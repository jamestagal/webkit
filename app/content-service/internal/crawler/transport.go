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
		md = &cfbrowser.MarkdownResponse{Content: content, URL: pageURL}
		slog.Debug("Used Jina fallback", "url", pageURL)
	}

	if md == nil {
		return nil, fmt.Errorf("no rendering service available for %s", pageURL)
	}

	// 2. Get links (best-effort, only via CF Browser since it has GetLinks)
	if t.cfClient != nil {
		links, linkErr := t.cfClient.GetLinks(req.Context(), pageURL)
		if linkErr == nil && links != nil {
			t.links.Store(pageURL, links.Links)
		} else if linkErr != nil {
			slog.Debug("Failed to get links", "url", pageURL, "error", linkErr)
		}
	}

	// 3. Return synthetic response with markdown as body
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

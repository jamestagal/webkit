package crawler

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"app/pkg/cfbrowser"
	"app/pkg/jina"

	"golang.org/x/net/html"
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
			// Don't return early — fall through to direct HTTP fallback.
			slog.Debug("Jina rendering failed, will try direct HTTP", "url", pageURL, "error", jinaErr)
		} else {
			// Jina Reader returns metadata header lines like "Title: ...\nURL Source: ...\n\n"
			// Extract the title from the header before treating the rest as content.
			title, cleanContent := extractJinaTitle(content)
			md = &cfbrowser.MarkdownResponse{Content: cleanContent, Title: title, URL: pageURL}
			slog.Debug("Used Jina fallback", "url", pageURL, "title", title)
		}
	}

	// 2. Direct HTTP fallback — many sites serve fully rendered HTML and don't need
	// a browser rendering service. This is especially useful when Jina/CF timeout
	// on Cloudflare-protected sites that actually serve static HTML.
	var directLinks []cfbrowser.Link
	if md == nil {
		slog.Debug("Rendering services unavailable, trying direct HTTP", "url", pageURL)
		directMD, links, directErr := t.fetchDirect(req.Context(), pageURL)
		if directErr != nil {
			return nil, fmt.Errorf("all fetch methods failed for %s (direct: %v)", pageURL, directErr)
		}
		md = directMD
		directLinks = links
		slog.Debug("Used direct HTTP fallback", "url", pageURL, "title", md.Title)
	}

	// 3. Store HTML <title> if available
	if md.Title != "" {
		t.titles.Store(pageURL, md.Title)
	}

	// 4. Get links (CF Browser → direct HTML extraction fallback)
	if directLinks != nil {
		// Already extracted from direct HTTP fallback
		t.links.Store(pageURL, directLinks)
	} else if t.cfClient != nil {
		links, linkErr := t.cfClient.GetLinks(req.Context(), pageURL)
		if linkErr == nil && links != nil {
			t.links.Store(pageURL, links.Links)
		} else if linkErr != nil {
			slog.Debug("Failed to get links", "url", pageURL, "error", linkErr)
		}
	}

	// 5. Return synthetic response with markdown as body
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

// directHTTPClient is a shared client for direct HTTP fallback requests.
var directHTTPClient = &http.Client{
	Timeout: 15 * time.Second,
}

// fetchDirect performs a plain HTTP GET and extracts content from the raw HTML.
// Returns a MarkdownResponse (with body text converted to simple markdown),
// extracted links, or an error.
func (t *BrowserTransport) fetchDirect(ctx context.Context, pageURL string) (*cfbrowser.MarkdownResponse, []cfbrowser.Link, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pageURL, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; WebkitBot/1.0)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := directHTTPClient.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("HTTP GET: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, pageURL)
	}

	// Limit read to 2MB to avoid huge pages.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, nil, fmt.Errorf("read body: %w", err)
	}

	title, content, links := parseHTML(string(body), pageURL)

	return &cfbrowser.MarkdownResponse{
		Content: content,
		Title:   title,
		URL:     pageURL,
	}, links, nil
}

// parseHTML does a lightweight extraction of title, body text, and links from raw HTML.
// Body text is returned as simple markdown (headings prefixed with #, paragraphs separated by newlines).
func parseHTML(rawHTML, baseURL string) (title, markdown string, links []cfbrowser.Link) {
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		// If parsing fails, return raw text stripped of tags.
		return "", rawHTML, nil
	}

	var (
		titleBuf   strings.Builder
		bodyBuf    strings.Builder
		inTitle    bool
		inScript   bool
		inStyle    bool
		inHeading  int // 1-6 for h1-h6, 0 otherwise
	)

	base, _ := (&url.URL{}).Parse(baseURL)

	var walk func(*html.Node)
	walk = func(n *html.Node) {
		switch n.Type {
		case html.ElementNode:
			tag := strings.ToLower(n.Data)

			switch tag {
			case "title":
				inTitle = true
			case "script", "noscript":
				inScript = true
			case "style":
				inStyle = true
			case "h1":
				inHeading = 1
			case "h2":
				inHeading = 2
			case "h3":
				inHeading = 3
			case "h4":
				inHeading = 4
			case "h5":
				inHeading = 5
			case "h6":
				inHeading = 6
			case "p", "div", "section", "article", "main", "li":
				bodyBuf.WriteString("\n")
			case "br":
				bodyBuf.WriteString("\n")
			case "a":
				href := getAttr(n, "href")
				if href != "" && !strings.HasPrefix(href, "#") && !strings.HasPrefix(href, "javascript:") {
					linkText := extractText(n)
					if base != nil {
						if resolved, err := base.Parse(href); err == nil {
							href = resolved.String()
						}
					}
					links = append(links, cfbrowser.Link{URL: href, Text: linkText})
				}
			}

		case html.TextNode:
			if inScript || inStyle {
				break
			}
			text := strings.TrimSpace(n.Data)
			if text == "" {
				break
			}
			if inTitle {
				titleBuf.WriteString(text)
			}
			if inHeading > 0 {
				bodyBuf.WriteString("\n" + strings.Repeat("#", inHeading) + " " + text + "\n")
			} else {
				bodyBuf.WriteString(text + " ")
			}
		}

		for child := n.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}

		// Close tags
		if n.Type == html.ElementNode {
			tag := strings.ToLower(n.Data)
			switch tag {
			case "title":
				inTitle = false
			case "script", "noscript":
				inScript = false
			case "style":
				inStyle = false
			case "h1", "h2", "h3", "h4", "h5", "h6":
				inHeading = 0
			case "p", "div", "section", "article", "main", "li":
				bodyBuf.WriteString("\n")
			}
		}
	}

	walk(doc)

	return strings.TrimSpace(titleBuf.String()), strings.TrimSpace(bodyBuf.String()), links
}

// extractText returns all text content from a node and its children.
func extractText(n *html.Node) string {
	var buf strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			buf.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return strings.TrimSpace(buf.String())
}

// getAttr returns the value of an attribute on an HTML node, or empty string.
func getAttr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
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

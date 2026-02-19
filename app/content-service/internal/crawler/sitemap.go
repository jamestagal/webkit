package crawler

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// sitemapIndex represents a sitemap index file containing references to other sitemaps.
type sitemapIndex struct {
	XMLName  xml.Name       `xml:"sitemapindex"`
	Sitemaps []sitemapEntry `xml:"sitemap"`
}

type sitemapEntry struct {
	Loc string `xml:"loc"`
}

// urlSet represents a standard sitemap with URL entries.
type urlSet struct {
	XMLName xml.Name   `xml:"urlset"`
	URLs    []urlEntry `xml:"url"`
}

type urlEntry struct {
	Loc string `xml:"loc"`
}

// ParseSitemap fetches and parses sitemap.xml from the given base URL.
// Returns a deduplicated list of URLs found in the sitemap.
// If the sitemap is not found or cannot be parsed, returns an empty list and nil error
// since sitemaps are optional.
func ParseSitemap(ctx context.Context, baseURL string) ([]string, error) {
	baseURL = strings.TrimRight(baseURL, "/")
	sitemapURL := baseURL + "/sitemap.xml"

	urls, err := fetchSitemap(ctx, sitemapURL)
	if err != nil {
		slog.Debug("Sitemap not available", "url", sitemapURL, "error", err)
		return nil, nil
	}

	return deduplicate(urls), nil
}

func fetchSitemap(ctx context.Context, sitemapURL string) ([]string, error) {
	client := &http.Client{Timeout: 15 * time.Second}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sitemapURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "WebkitCrawler/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch sitemap: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sitemap returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024)) // 10MB limit
	if err != nil {
		return nil, fmt.Errorf("read sitemap: %w", err)
	}

	// Try parsing as sitemap index first.
	var idx sitemapIndex
	if err := xml.Unmarshal(body, &idx); err == nil && len(idx.Sitemaps) > 0 {
		slog.Debug("Found sitemap index", "sub_sitemaps", len(idx.Sitemaps))
		var allURLs []string
		for _, sm := range idx.Sitemaps {
			subURLs, subErr := fetchSitemap(ctx, sm.Loc)
			if subErr != nil {
				slog.Debug("Failed to fetch sub-sitemap", "url", sm.Loc, "error", subErr)
				continue
			}
			allURLs = append(allURLs, subURLs...)
		}
		return allURLs, nil
	}

	// Parse as standard URL set.
	var us urlSet
	if err := xml.Unmarshal(body, &us); err != nil {
		return nil, fmt.Errorf("parse sitemap XML: %w", err)
	}

	urls := make([]string, 0, len(us.URLs))
	for _, u := range us.URLs {
		if u.Loc != "" {
			urls = append(urls, u.Loc)
		}
	}

	slog.Debug("Parsed sitemap", "url_count", len(urls))
	return urls, nil
}

func deduplicate(urls []string) []string {
	seen := make(map[string]struct{}, len(urls))
	result := make([]string, 0, len(urls))
	for _, u := range urls {
		if _, ok := seen[u]; !ok {
			seen[u] = struct{}{}
			result = append(result, u)
		}
	}
	return result
}

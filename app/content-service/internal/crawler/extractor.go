package crawler

import (
	"crypto/sha256"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"app/pkg/cfbrowser"
)

var (
	h1Regex    = regexp.MustCompile(`(?m)^# (.+)$`)
	h2Regex    = regexp.MustCompile(`(?m)^## (.+)$`)
	headingAll = regexp.MustCompile(`(?m)^#{1,6} .+$`)
	imgRegex   = regexp.MustCompile(`!\[([^\]]*)\]\(`)
)

// ExtractPageData extracts structured page data from markdown content and discovered links.
func ExtractPageData(pageURL string, markdownContent string, links []cfbrowser.Link, classification Classification, sourceURL string) PageData {
	// Extract headings
	h1Matches := h1Regex.FindAllStringSubmatch(markdownContent, -1)
	h1Tags := make([]string, 0, len(h1Matches))
	for _, m := range h1Matches {
		h1Tags = append(h1Tags, strings.TrimSpace(m[1]))
	}

	h2Matches := h2Regex.FindAllStringSubmatch(markdownContent, -1)
	h2Tags := make([]string, 0, len(h2Matches))
	for _, m := range h2Matches {
		h2Tags = append(h2Tags, strings.TrimSpace(m[1]))
	}

	// Title: first H1 heading, or empty
	title := ""
	if len(h1Tags) > 0 {
		title = h1Tags[0]
	}

	// Body text: markdown with headings stripped
	bodyText := headingAll.ReplaceAllString(markdownContent, "")
	bodyText = strings.TrimSpace(bodyText)

	wordCount := CountWords(bodyText)
	readingTime := EstimateReadingTime(wordCount)
	contentHash := ComputeContentHash(bodyText)

	// Count internal vs external links
	sourceHost := extractHost(sourceURL)
	internalCount := 0
	externalCount := 0
	for _, link := range links {
		linkHost := extractHost(link.URL)
		if linkHost == sourceHost {
			internalCount++
		} else if linkHost != "" {
			externalCount++
		}
	}

	// Count images and images missing alt text
	imgMatches := imgRegex.FindAllStringSubmatch(markdownContent, -1)
	imageCount := len(imgMatches)
	imagesMissingAlt := 0
	for _, m := range imgMatches {
		if strings.TrimSpace(m[1]) == "" {
			imagesMissingAlt++
		}
	}

	// Determine canonical URL
	canonicalURL := pageURL
	hasCanonical := false

	return PageData{
		URL:             pageURL,
		CanonicalURL:    canonicalURL,
		PageType:        classification.PageType,
		ClassConfidence: classification.Confidence,
		ClassMethod:     classification.Method,
		Title:           title,
		MetaDescription: "", // Not available from markdown alone
		H1Tags:          h1Tags,
		H2Tags:          h2Tags,
		BodyText:        bodyText,
		MarkdownContent: markdownContent,
		WordCount:       wordCount,
		ReadingTimeMinutes: readingTime,
		HTTPStatus:         200,
		ContentHash:        contentHash,
		SchemaTypes:        nil,
		HasCanonical:       hasCanonical,
		HasRobotsMeta:      false,
		RobotsDirectives:   "",
		InternalLinksCount: internalCount,
		ExternalLinksCount: externalCount,
		ImageCount:         imageCount,
		ImagesMissingAlt:   imagesMissingAlt,
	}
}

// ComputeContentHash returns the SHA-256 hex digest of the given text.
func ComputeContentHash(bodyText string) string {
	h := sha256.Sum256([]byte(bodyText))
	return fmt.Sprintf("%x", h)
}

// EstimateReadingTime estimates minutes to read based on word count.
// Assumes average reading speed of 200 words per minute.
func EstimateReadingTime(wordCount int) int {
	if wordCount <= 0 {
		return 1
	}
	minutes := wordCount / 200
	if minutes < 1 {
		return 1
	}
	return minutes
}

// CountWords counts the number of words in the given text.
func CountWords(text string) int {
	return len(strings.Fields(text))
}

// extractHost returns the lowercase hostname from a URL string.
func extractHost(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

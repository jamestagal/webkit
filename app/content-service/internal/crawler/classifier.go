package crawler

import (
	"context"
	"log/slog"
	"net/url"
	"strings"

	"github.com/liushuangls/go-anthropic/v2"

	otel "app/pkg/otel"
)

// Classification represents the result of page type classification.
type Classification struct {
	PageType   string  // one of the valid page_type values
	Confidence float64 // 0.0 to 1.0
	Method     string  // "url_pattern", "html_structure", "llm"
}

// Classifier performs three-layer page type classification.
type Classifier struct {
	anthropicKey string
}

// NewClassifier creates a new page classifier.
func NewClassifier(anthropicKey string) *Classifier {
	return &Classifier{anthropicKey: anthropicKey}
}

// Classify determines the page type using a three-layer approach:
// 1. URL pattern matching (fast, high confidence for obvious patterns)
// 2. HTML/content structure analysis (medium confidence)
// 3. LLM classification via Anthropic Haiku (highest accuracy, slowest)
func (c *Classifier) Classify(ctx context.Context, pageURL string, title string, markdown string) Classification {
	// Layer 1: URL pattern matching
	if pageType, confidence, matched := classifyByURL(pageURL); matched {
		slog.Debug("Classified by URL pattern", "url", pageURL, "type", pageType, "confidence", confidence)
		return Classification{PageType: pageType, Confidence: confidence, Method: "url_pattern"}
	}

	// Layer 2: Content structure analysis
	h1Tags := extractH1FromMarkdown(markdown)
	wordCount := CountWords(markdown)
	if pageType, confidence, matched := classifyByStructure(title, h1Tags, wordCount); matched {
		slog.Debug("Classified by structure", "url", pageURL, "type", pageType, "confidence", confidence)
		return Classification{PageType: pageType, Confidence: confidence, Method: "html_structure"}
	}

	// Layer 3: LLM classification
	if c.anthropicKey != "" {
		if pageType, confidence := c.classifyByLLM(ctx, pageURL, title, markdown); pageType != "" {
			slog.Debug("Classified by LLM", "url", pageURL, "type", pageType, "confidence", confidence)
			return Classification{PageType: pageType, Confidence: confidence, Method: "llm"}
		}
	}

	return Classification{PageType: "unknown", Confidence: 0.0, Method: "url_pattern"}
}

// classifyByURL checks URL path against known patterns.
func classifyByURL(rawURL string) (string, float64, bool) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", 0, false
	}

	path := strings.ToLower(u.Path)
	path = strings.TrimRight(path, "/")

	// Homepage check
	if path == "" || path == "/" {
		return "homepage", 0.95, true
	}

	// Pattern matching on URL path segments
	patterns := []struct {
		prefix     string
		pageType   string
		confidence float64
	}{
		{"/about", "about", 0.9},
		{"/contact", "contact", 0.9},
		{"/faq", "faq", 0.9},
		{"/blog", "blog_post", 0.85},
		{"/services", "service", 0.85},
		{"/service", "service", 0.85},
		{"/products", "product", 0.85},
		{"/product", "product", 0.85},
		{"/team", "team", 0.85},
		{"/our-team", "team", 0.85},
		{"/portfolio", "portfolio", 0.85},
		{"/work", "portfolio", 0.80},
		{"/case-stud", "case_study", 0.85},
		{"/testimonial", "testimonial", 0.85},
		{"/review", "testimonial", 0.80},
		{"/news", "news", 0.8},
		{"/category", "category", 0.8},
		{"/tag", "category", 0.75},
		{"/landing", "landing", 0.8},
	}

	for _, p := range patterns {
		if strings.HasPrefix(path, p.prefix) {
			return p.pageType, p.confidence, true
		}
	}

	return "", 0, false
}

// classifyByStructure analyzes title, headings, and content length to infer page type.
func classifyByStructure(title string, headings []string, wordCount int) (string, float64, bool) {
	// Combine title and headings for keyword search
	combined := strings.ToLower(title)
	for _, h := range headings {
		combined += " " + strings.ToLower(h)
	}

	type rule struct {
		keywords   []string
		pageType   string
		confidence float64
	}

	rules := []rule{
		{[]string{"about us", "about our", "who we are", "our story"}, "about", 0.8},
		{[]string{"contact us", "get in touch", "reach out"}, "contact", 0.85},
		{[]string{"frequently asked", "faq", "common questions"}, "faq", 0.85},
		{[]string{"our team", "meet the team", "team members"}, "team", 0.8},
		{[]string{"blog", "articles", "latest posts"}, "blog_post", 0.75},
		{[]string{"our services", "what we do", "services we offer"}, "service", 0.75},
		{[]string{"portfolio", "our work", "case studies"}, "portfolio", 0.75},
		{[]string{"testimonials", "what our clients say", "reviews"}, "testimonial", 0.8},
	}

	for _, r := range rules {
		for _, kw := range r.keywords {
			if strings.Contains(combined, kw) {
				return r.pageType, r.confidence, true
			}
		}
	}

	// Short pages with "contact" anywhere → contact
	if wordCount < 100 && strings.Contains(combined, "contact") {
		return "contact", 0.75, true
	}

	// Long pages (800+ words) are often blog posts — weak signal only
	if wordCount > 800 {
		// Check for date-like patterns in the content (very rough heuristic)
		// This is intentionally conservative; LLM will catch what we miss
		return "", 0, false
	}

	return "", 0, false
}

// classifyByLLM uses Anthropic Haiku to classify the page type.
func (c *Classifier) classifyByLLM(ctx context.Context, pageURL string, title string, markdown string) (string, float64) {
	// Truncate markdown to first 500 characters for the snippet
	snippet := markdown
	if len(snippet) > 500 {
		snippet = snippet[:500]
	}

	client := anthropic.NewClient(c.anthropicKey)

	systemPrompt := "You are a page classifier. Given a URL, title, and text snippet, respond with ONLY the page type from this list: homepage, about, service, product, blog_post, case_study, testimonial, contact, team, faq, landing, category, portfolio, news, other"

	userMessage := "URL: " + pageURL + "\nTitle: " + title + "\nSnippet: " + snippet

	done := otel.StartExternalCall(ctx, "anthropic", "crawler_classify")
	resp, err := client.CreateMessages(ctx, anthropic.MessagesRequest{
		Model: anthropic.ModelClaudeHaiku4Dot5,
		Messages: []anthropic.Message{
			{
				Role: anthropic.RoleUser,
				Content: []anthropic.MessageContent{
					anthropic.NewTextMessageContent(userMessage),
				},
			},
		},
		System:    systemPrompt,
		MaxTokens: 50,
	})
	done(err)
	if err != nil {
		slog.Warn("LLM classification failed", "url", pageURL, "error", err)
		return "", 0
	}

	if len(resp.Content) == 0 {
		return "", 0
	}

	// Extract the text response using the helper
	raw := resp.GetFirstContentText()

	pageType := strings.TrimSpace(strings.ToLower(raw))

	// Validate against allowed types
	validTypes := map[string]bool{
		"homepage": true, "about": true, "service": true, "product": true,
		"blog_post": true, "case_study": true, "testimonial": true,
		"contact": true, "team": true, "faq": true, "landing": true,
		"category": true, "portfolio": true, "news": true, "other": true,
	}

	if validTypes[pageType] {
		return pageType, 0.95
	}

	// Try to fuzzy match common variations
	if strings.Contains(pageType, "blog") {
		return "blog_post", 0.90
	}
	if strings.Contains(pageType, "case") {
		return "case_study", 0.90
	}

	return "other", 0.7
}

// extractH1FromMarkdown extracts H1 headings from markdown content.
func extractH1FromMarkdown(markdown string) []string {
	matches := h1Regex.FindAllStringSubmatch(markdown, -1)
	headings := make([]string, 0, len(matches))
	for _, m := range matches {
		headings = append(headings, strings.TrimSpace(m[1]))
	}
	return headings
}

package crawler

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestClassify_URLPattern_Homepage(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	tests := []struct {
		name string
		url  string
	}{
		{"root slash", "https://example.com/"},
		{"root no path", "https://example.com"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := c.Classify(ctx, tt.url, "", "")
			assert.Equal(t, "homepage", result.PageType)
			assert.Equal(t, 0.95, result.Confidence)
			assert.Equal(t, "url_pattern", result.Method)
		})
	}
}

func TestClassify_URLPattern_About(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/about-us", "", "")
	assert.Equal(t, "about", result.PageType)
	assert.Equal(t, 0.9, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

func TestClassify_URLPattern_Contact(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/contact", "", "")
	assert.Equal(t, "contact", result.PageType)
	assert.Equal(t, 0.9, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

func TestClassify_URLPattern_Blog(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/blog/my-post", "", "")
	assert.Equal(t, "blog_post", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

func TestClassify_URLPattern_Services(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/services/web-design", "", "")
	assert.Equal(t, "service", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

func TestClassify_URLPattern_Product(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/products/widget", "", "")
	assert.Equal(t, "product", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

func TestClassify_URLPattern_CaseStudy(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/case-studies/client", "", "")
	assert.Equal(t, "case_study", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

func TestClassify_URLPattern_Portfolio(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/portfolio", "", "")
	assert.Equal(t, "portfolio", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

func TestClassify_URLPatterns_TableDriven(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	tests := []struct {
		name       string
		url        string
		wantType   string
		wantConf   float64
	}{
		{"faq", "https://example.com/faq", "faq", 0.9},
		{"team", "https://example.com/team", "team", 0.85},
		{"our-team", "https://example.com/our-team", "team", 0.85},
		{"testimonial", "https://example.com/testimonials", "testimonial", 0.85},
		{"review", "https://example.com/reviews", "testimonial", 0.80},
		{"news", "https://example.com/news", "news", 0.8},
		{"category", "https://example.com/category/tech", "category", 0.8},
		{"tag", "https://example.com/tag/golang", "category", 0.75},
		{"landing", "https://example.com/landing/promo", "landing", 0.8},
		{"work as portfolio", "https://example.com/work/project-x", "portfolio", 0.80},
		{"service singular", "https://example.com/service/consulting", "service", 0.85},
		{"product singular", "https://example.com/product/item", "product", 0.85},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := c.Classify(ctx, tt.url, "", "")
			assert.Equal(t, tt.wantType, result.PageType, "page type mismatch")
			assert.Equal(t, tt.wantConf, result.Confidence, "confidence mismatch")
			assert.Equal(t, "url_pattern", result.Method)
		})
	}
}

func TestClassify_StructureFallback_About(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	// URL "/foo" won't match any URL pattern, so it falls through to structure
	result := c.Classify(ctx, "https://example.com/foo", "About Us", "Some content about the company.")
	assert.Equal(t, "about", result.PageType)
	assert.Equal(t, 0.8, result.Confidence)
	assert.Equal(t, "html_structure", result.Method)
}

func TestClassify_StructureFallback_Contact(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/foo", "Get In Touch", "Send us a message.")
	assert.Equal(t, "contact", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "html_structure", result.Method)
}

func TestClassify_StructureFallback_FAQ(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	// The classifier extracts H1 headings from markdown and combines them with the title
	markdown := "# Frequently Asked Questions\n\nQ: How does this work?\nA: It works great."
	result := c.Classify(ctx, "https://example.com/foo", "", markdown)
	assert.Equal(t, "faq", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "html_structure", result.Method)
}

func TestClassify_StructureFallback_Team(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/foo", "Meet The Team", "Our talented people.")
	assert.Equal(t, "team", result.PageType)
	assert.Equal(t, 0.8, result.Confidence)
	assert.Equal(t, "html_structure", result.Method)
}

func TestClassify_StructureFallback_ShortContactPage(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	// Title "Info" doesn't match any keyword, but it has "contact" somewhere
	// and word count < 100, so the short-page contact rule triggers.
	// The markdown content needs to be short (< 100 words) and the title or
	// H1 headings must contain "contact" in the combined string.
	markdown := "# Contact\n\nPlease reach us at info@example.com."
	result := c.Classify(ctx, "https://example.com/foo", "Info", markdown)
	assert.Equal(t, "contact", result.PageType)
	assert.Equal(t, 0.75, result.Confidence)
	assert.Equal(t, "html_structure", result.Method)
}

func TestClassify_StructureFallback_Testimonials(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/foo", "Testimonials", "Great product!")
	assert.Equal(t, "testimonial", result.PageType)
	assert.Equal(t, 0.8, result.Confidence)
	assert.Equal(t, "html_structure", result.Method)
}

func TestClassify_StructureFallback_OurServices(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	result := c.Classify(ctx, "https://example.com/foo", "Our Services", "We offer web design.")
	assert.Equal(t, "service", result.PageType)
	assert.Equal(t, 0.75, result.Confidence)
	assert.Equal(t, "html_structure", result.Method)
}

func TestClassify_NoMatch_NoLLM(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	// URL "/foo" doesn't match, title "Random Stuff" doesn't match any rule,
	// no anthropic key so LLM is skipped.
	result := c.Classify(ctx, "https://example.com/foo", "Random Stuff", "Some random content that doesn't match anything.")
	assert.Equal(t, "unknown", result.PageType)
	assert.Equal(t, 0.0, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method) // default fallback uses url_pattern method
}

func TestClassify_URLPatternTakesPrecedenceOverStructure(t *testing.T) {
	c := NewClassifier("")
	ctx := context.Background()

	// Even though title says "About Us", the URL pattern /blog should win
	result := c.Classify(ctx, "https://example.com/blog/about-the-team", "About Us", "Story of our team.")
	assert.Equal(t, "blog_post", result.PageType)
	assert.Equal(t, 0.85, result.Confidence)
	assert.Equal(t, "url_pattern", result.Method)
}

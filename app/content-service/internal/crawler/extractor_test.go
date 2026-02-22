package crawler

import (
	"strings"
	"testing"

	"app/pkg/cfbrowser"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractPageData_BasicMarkdown(t *testing.T) {
	markdown := `# Welcome to Our Site

This is the body text of the page. It contains some useful information.

## Our Mission

We strive to build great products for our customers.

## Our Values

Integrity, innovation, and collaboration.`

	links := []cfbrowser.Link{
		{URL: "https://example.com/about", Text: "About"},
		{URL: "https://external.com/resource", Text: "External"},
	}

	classification := Classification{
		PageType:   "homepage",
		Confidence: 0.95,
		Method:     "url_pattern",
	}

	result := ExtractPageData("https://example.com/", markdown, links, classification, "https://example.com")

	assert.Equal(t, "https://example.com/", result.URL)
	assert.Equal(t, "Welcome to Our Site", result.Title)
	assert.Equal(t, []string{"Welcome to Our Site"}, result.H1Tags)
	assert.Equal(t, []string{"Our Mission", "Our Values"}, result.H2Tags)
	assert.Equal(t, "homepage", result.PageType)
	assert.Equal(t, 0.95, result.ClassConfidence)
	assert.Equal(t, "url_pattern", result.ClassMethod)
	assert.Greater(t, result.WordCount, 0)
	assert.GreaterOrEqual(t, result.ReadingTimeMinutes, 1)
	assert.NotEmpty(t, result.ContentHash)
	assert.Equal(t, 1, result.InternalLinksCount)
	assert.Equal(t, 1, result.ExternalLinksCount)
	assert.Equal(t, 200, result.HTTPStatus)
	// Body text should not contain heading markers
	assert.NotContains(t, result.BodyText, "# Welcome")
	assert.NotContains(t, result.BodyText, "## Our Mission")
}

func TestExtractPageData_MultipleH1(t *testing.T) {
	markdown := `# First Heading

Some content here.

# Second Heading

More content here.

# Third Heading

Even more content.`

	result := ExtractPageData("https://example.com/page", markdown, nil, Classification{}, "https://example.com")

	assert.Equal(t, "First Heading", result.Title, "title should be the first H1")
	assert.Equal(t, []string{"First Heading", "Second Heading", "Third Heading"}, result.H1Tags)
}

func TestExtractPageData_NoHeadings(t *testing.T) {
	markdown := "Just some plain text without any headings at all."

	result := ExtractPageData("https://example.com/page", markdown, nil, Classification{}, "https://example.com")

	assert.Equal(t, "", result.Title)
	assert.Empty(t, result.H1Tags)
	assert.Empty(t, result.H2Tags)
	assert.Greater(t, result.WordCount, 0)
}

func TestExtractPageData_InternalExternalLinks(t *testing.T) {
	links := []cfbrowser.Link{
		{URL: "https://example.com/page1", Text: "Page 1"},
		{URL: "https://example.com/page2", Text: "Page 2"},
		{URL: "https://example.com/page3", Text: "Page 3"},
		{URL: "https://other.com/resource", Text: "Other"},
		{URL: "https://cdn.external.io/file", Text: "CDN"},
	}

	result := ExtractPageData(
		"https://example.com/test",
		"# Test\n\nSome content.",
		links,
		Classification{},
		"https://example.com",
	)

	assert.Equal(t, 3, result.InternalLinksCount)
	assert.Equal(t, 2, result.ExternalLinksCount)
}

func TestExtractPageData_ImagesWithAndWithoutAlt(t *testing.T) {
	markdown := `# Gallery

Here is an image with alt text: ![A beautiful sunset](https://example.com/sunset.jpg)

And one without: ![](https://example.com/noalt.jpg)

Another with alt: ![Company logo](https://example.com/logo.png)

And another missing alt: ![](https://example.com/missing.png)
`

	result := ExtractPageData("https://example.com/gallery", markdown, nil, Classification{}, "https://example.com")

	assert.Equal(t, 4, result.ImageCount)
	assert.Equal(t, 2, result.ImagesMissingAlt)
}

func TestExtractPageData_MarkdownContentPreserved(t *testing.T) {
	markdown := "# Title\n\nBody content here."

	result := ExtractPageData("https://example.com/page", markdown, nil, Classification{}, "https://example.com")

	assert.Equal(t, markdown, result.MarkdownContent)
}

// --- ComputeContentHash tests ---

func TestComputeContentHash_Deterministic(t *testing.T) {
	input := "Hello, world! This is test content."

	hash1 := ComputeContentHash(input)
	hash2 := ComputeContentHash(input)

	assert.Equal(t, hash1, hash2, "same input must produce the same hash")
	assert.Len(t, hash1, 64, "SHA-256 hex digest should be 64 characters")
}

func TestComputeContentHash_DifferentInputs(t *testing.T) {
	hash1 := ComputeContentHash("Hello, world!")
	hash2 := ComputeContentHash("Goodbye, world!")

	assert.NotEqual(t, hash1, hash2, "different inputs must produce different hashes")
}

func TestComputeContentHash_EmptyString(t *testing.T) {
	hash := ComputeContentHash("")

	require.NotEmpty(t, hash)
	assert.Len(t, hash, 64)
}

// --- EstimateReadingTime tests ---

func TestEstimateReadingTime_ZeroWords(t *testing.T) {
	assert.Equal(t, 1, EstimateReadingTime(0))
}

func TestEstimateReadingTime_NegativeWords(t *testing.T) {
	assert.Equal(t, 1, EstimateReadingTime(-5))
}

func TestEstimateReadingTime_ShortText(t *testing.T) {
	// 100 words / 200 wpm = 0.5, rounds down to 0, min 1
	assert.Equal(t, 1, EstimateReadingTime(100))
}

func TestEstimateReadingTime_ExactlyOneMinute(t *testing.T) {
	// 200 words / 200 wpm = 1 minute
	assert.Equal(t, 1, EstimateReadingTime(200))
}

func TestEstimateReadingTime_MediumText(t *testing.T) {
	// 400 words / 200 wpm = 2 minutes
	assert.Equal(t, 2, EstimateReadingTime(400))
}

func TestEstimateReadingTime_LongText(t *testing.T) {
	// 1000 words / 200 wpm = 5 minutes
	assert.Equal(t, 5, EstimateReadingTime(1000))
}

func TestEstimateReadingTime_199Words(t *testing.T) {
	// 199 / 200 = 0 (integer division), min 1
	assert.Equal(t, 1, EstimateReadingTime(199))
}

// --- CountWords tests ---

func TestCountWords_EmptyString(t *testing.T) {
	assert.Equal(t, 0, CountWords(""))
}

func TestCountWords_SingleWord(t *testing.T) {
	assert.Equal(t, 1, CountWords("hello"))
}

func TestCountWords_MultipleWords(t *testing.T) {
	assert.Equal(t, 3, CountWords("hello world foo"))
}

func TestCountWords_WithExtraWhitespace(t *testing.T) {
	assert.Equal(t, 2, CountWords("  hello   world  "))
}

func TestCountWords_WithNewlines(t *testing.T) {
	assert.Equal(t, 3, CountWords("hello\nworld\nfoo"))
}

func TestCountWords_WithTabs(t *testing.T) {
	assert.Equal(t, 2, CountWords("hello\tworld"))
}

func TestCountWords_OnlyWhitespace(t *testing.T) {
	assert.Equal(t, 0, CountWords("   \t\n  "))
}

// --- Edge cases ---

func TestExtractPageData_EmptyMarkdown(t *testing.T) {
	result := ExtractPageData("https://example.com/empty", "", nil, Classification{PageType: "unknown"}, "https://example.com")

	assert.Equal(t, "", result.Title)
	assert.Empty(t, result.H1Tags)
	assert.Empty(t, result.H2Tags)
	assert.Equal(t, 0, result.WordCount)
	assert.Equal(t, 1, result.ReadingTimeMinutes) // minimum 1
	assert.Equal(t, 0, result.ImageCount)
	assert.Equal(t, 0, result.ImagesMissingAlt)
	assert.Equal(t, 0, result.InternalLinksCount)
	assert.Equal(t, 0, result.ExternalLinksCount)
}

func TestExtractPageData_BodyTextStripsAllHeadingLevels(t *testing.T) {
	markdown := `# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

Actual body content here.`

	result := ExtractPageData("https://example.com/page", markdown, nil, Classification{}, "https://example.com")

	assert.NotContains(t, result.BodyText, "# H1")
	assert.NotContains(t, result.BodyText, "## H2")
	assert.NotContains(t, result.BodyText, "### H3")
	assert.NotContains(t, result.BodyText, "#### H4")
	assert.NotContains(t, result.BodyText, "##### H5")
	assert.NotContains(t, result.BodyText, "###### H6")
	assert.Contains(t, result.BodyText, "Actual body content here.")
}

func TestExtractPageData_LargeWordCount(t *testing.T) {
	// Generate a 1000-word body
	words := make([]string, 1000)
	for i := range words {
		words[i] = "word"
	}
	markdown := "# Title\n\n" + strings.Join(words, " ")

	result := ExtractPageData("https://example.com/long", markdown, nil, Classification{}, "https://example.com")

	assert.Equal(t, 1000, result.WordCount)
	assert.Equal(t, 5, result.ReadingTimeMinutes)
}

// --- HTML title extraction tests ---

func TestExtractPageData_HTMLTitlePreferred(t *testing.T) {
	markdown := `# H1 Heading From Markdown

Some body content here.`

	result := ExtractPageData(
		"https://example.com/page",
		markdown, nil, Classification{}, "https://example.com",
		"HTML Title From Browser",
	)

	assert.Equal(t, "HTML Title From Browser", result.Title, "HTML <title> should be preferred over H1")
	assert.Equal(t, []string{"H1 Heading From Markdown"}, result.H1Tags, "H1 tags should still be extracted")
}

func TestExtractPageData_FallsBackToH1WhenNoHTMLTitle(t *testing.T) {
	markdown := `# Fallback H1 Title

Some body content.`

	// No htmlTitle argument
	result := ExtractPageData("https://example.com/page", markdown, nil, Classification{}, "https://example.com")

	assert.Equal(t, "Fallback H1 Title", result.Title, "should fall back to H1 when no HTML title")
}

func TestExtractPageData_HTMLTitleWithNoH1(t *testing.T) {
	markdown := "Just some plain text without any headings."

	result := ExtractPageData(
		"https://example.com/page",
		markdown, nil, Classification{}, "https://example.com",
		"Page Title From HTML",
	)

	assert.Equal(t, "Page Title From HTML", result.Title, "HTML title should work even with no H1")
	assert.Empty(t, result.H1Tags)
}

func TestExtractPageData_EmptyHTMLTitleFallsBackToH1(t *testing.T) {
	markdown := `# H1 As Fallback

Content here.`

	result := ExtractPageData(
		"https://example.com/page",
		markdown, nil, Classification{}, "https://example.com",
		"", // empty HTML title
	)

	assert.Equal(t, "H1 As Fallback", result.Title, "empty HTML title should fall back to H1")
}

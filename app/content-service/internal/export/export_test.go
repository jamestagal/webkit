package export

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func makeCopyRow(id, copyType, title, content, status string, wordCount int) copyRow {
	return copyRow{
		ID:              id,
		CopyType:        copyType,
		Title:           title,
		Content:         content,
		ActualWordCount: wordCount,
		Status:          status,
		CreatedAt:       time.Date(2025, 6, 1, 12, 0, 0, 0, time.UTC),
	}
}

func makeCopyRowWithKeyword(id, copyType, title, content, status, keyword string, wordCount int) copyRow {
	r := makeCopyRow(id, copyType, title, content, status, wordCount)
	r.TargetKeyword = sql.NullString{String: keyword, Valid: true}
	return r
}

// readZipEntries opens a zip archive from bytes and returns a map of
// filename -> contents.
func readZipEntries(t *testing.T, data []byte) map[string]string {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err, "opening zip archive")

	entries := make(map[string]string, len(zr.File))
	for _, f := range zr.File {
		rc, err := f.Open()
		require.NoError(t, err, "opening zip entry %s", f.Name)
		body, err := io.ReadAll(rc)
		require.NoError(t, err, "reading zip entry %s", f.Name)
		rc.Close()
		entries[f.Name] = string(body)
	}
	return entries
}

// zipFilenames returns sorted list of filenames from zip bytes.
func zipFilenames(t *testing.T, data []byte) []string {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)

	names := make([]string, len(zr.File))
	for i, f := range zr.File {
		names[i] = f.Name
	}
	return names
}

// ---------------------------------------------------------------------------
// sanitiseFilename
// ---------------------------------------------------------------------------

func TestSanitiseFilename_Simple(t *testing.T) {
	got := sanitiseFilename("Hello World")
	assert.Equal(t, "hello-world", got)
}

func TestSanitiseFilename_SpecialChars(t *testing.T) {
	got := sanitiseFilename(`file/name:with*bad?chars`)
	assert.Equal(t, "file-name-withbadchars", got)
}

func TestSanitiseFilename_AlreadyClean(t *testing.T) {
	got := sanitiseFilename("hello-world")
	assert.Equal(t, "hello-world", got)
}

// ---------------------------------------------------------------------------
// exportMarkdown
// ---------------------------------------------------------------------------

func TestExportMarkdown_SingleItem(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "landing_page", "Home", "Welcome to our site.", "final", 5),
	}
	result, err := exportMarkdown(rows, "example-com")
	require.NoError(t, err)

	entries := readZipEntries(t, result.Data)
	assert.Len(t, entries, 1, "expected exactly 1 file in zip")

	// The single entry should be a .md file.
	for name := range entries {
		assert.True(t, strings.HasSuffix(name, ".md"), "expected .md extension, got %s", name)
	}
}

func TestExportMarkdown_MultipleItems(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "landing_page", "Home", "Content A", "final", 2),
		makeCopyRow("2", "blog_post", "About", "Content B", "draft", 2),
		makeCopyRow("3", "service_page", "Services", "Content C", "final", 2),
	}
	result, err := exportMarkdown(rows, "example-com")
	require.NoError(t, err)

	names := zipFilenames(t, result.Data)
	require.Len(t, names, 3)
	assert.True(t, strings.HasPrefix(names[0], "001-"), "first file should start with 001-")
	assert.True(t, strings.HasPrefix(names[1], "002-"), "second file should start with 002-")
	assert.True(t, strings.HasPrefix(names[2], "003-"), "third file should start with 003-")
}

func TestExportMarkdown_FrontmatterFields(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "landing_page", "Home", "Body text.", "final", 42),
	}
	result, err := exportMarkdown(rows, "example-com")
	require.NoError(t, err)

	entries := readZipEntries(t, result.Data)
	var body string
	for _, v := range entries {
		body = v
		break
	}

	assert.Contains(t, body, "title:")
	assert.Contains(t, body, "copy_type: landing_page")
	assert.Contains(t, body, "status: final")
	assert.Contains(t, body, "word_count: 42")
}

func TestExportMarkdown_WithKeyword(t *testing.T) {
	rows := []copyRow{
		makeCopyRowWithKeyword("1", "landing_page", "Home", "Body.", "final", "best widgets", 10),
	}
	result, err := exportMarkdown(rows, "example-com")
	require.NoError(t, err)

	entries := readZipEntries(t, result.Data)
	var body string
	for _, v := range entries {
		body = v
		break
	}

	assert.Contains(t, body, "target_keyword:")
	assert.Contains(t, body, "best widgets")
}

func TestExportMarkdown_EmptyTitle(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "blog_post", "", "Content here.", "draft", 3),
	}
	result, err := exportMarkdown(rows, "example-com")
	require.NoError(t, err)

	names := zipFilenames(t, result.Data)
	require.Len(t, names, 1)
	// When title is empty, filename should use CopyType.
	assert.Contains(t, names[0], "blog_post")
}

func TestExportMarkdown_ContentType(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Test", "Body.", "final", 1),
	}
	result, err := exportMarkdown(rows, "example-com")
	require.NoError(t, err)
	assert.Equal(t, "application/zip", result.ContentType)
}

func TestExportMarkdown_FilenameFormat(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Test", "Body.", "final", 1),
	}
	result, err := exportMarkdown(rows, "mysite-com")
	require.NoError(t, err)
	assert.Equal(t, "mysite-com-copy-markdown.zip", result.Filename)
}

// ---------------------------------------------------------------------------
// exportText
// ---------------------------------------------------------------------------

func TestExportText_SingleItem(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "landing_page", "Home", "Welcome!", "final", 1),
	}
	result, err := exportText(rows, "example-com")
	require.NoError(t, err)

	entries := readZipEntries(t, result.Data)
	assert.Len(t, entries, 1)
	for name := range entries {
		assert.True(t, strings.HasSuffix(name, ".txt"), "expected .txt extension, got %s", name)
	}
}

func TestExportText_MultipleItems(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Home", "A", "final", 1),
		makeCopyRow("2", "page", "About", "B", "draft", 1),
		makeCopyRow("3", "page", "Contact", "C", "final", 1),
	}
	result, err := exportText(rows, "example-com")
	require.NoError(t, err)

	names := zipFilenames(t, result.Data)
	require.Len(t, names, 3)
	for _, n := range names {
		assert.True(t, strings.HasSuffix(n, ".txt"))
	}
}

func TestExportText_UppercaseHeadings(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Home Page", "Body.", "final", 1),
	}
	result, err := exportText(rows, "example-com")
	require.NoError(t, err)

	entries := readZipEntries(t, result.Data)
	var body string
	for _, v := range entries {
		body = v
		break
	}
	assert.Contains(t, body, "PAGE: HOME PAGE", "heading should be uppercase")
}

func TestExportText_MetadataLine(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "blog_post", "My Blog", "Some content.", "draft", 25),
	}
	result, err := exportText(rows, "example-com")
	require.NoError(t, err)

	entries := readZipEntries(t, result.Data)
	var body string
	for _, v := range entries {
		body = v
		break
	}
	assert.Contains(t, body, "TYPE: BLOG_POST")
	assert.Contains(t, body, "STATUS: DRAFT")
	assert.Contains(t, body, "WORDS: 25")
}

func TestExportText_WithKeyword(t *testing.T) {
	rows := []copyRow{
		makeCopyRowWithKeyword("1", "page", "Home", "Body.", "final", "seo tips", 5),
	}
	result, err := exportText(rows, "example-com")
	require.NoError(t, err)

	entries := readZipEntries(t, result.Data)
	var body string
	for _, v := range entries {
		body = v
		break
	}
	assert.Contains(t, body, "TARGET KEYWORD: seo tips")
}

func TestExportText_ContentType(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Test", "Body.", "final", 1),
	}
	result, err := exportText(rows, "example-com")
	require.NoError(t, err)
	assert.Equal(t, "application/zip", result.ContentType)
}

// ---------------------------------------------------------------------------
// buildHTMLDocument
// ---------------------------------------------------------------------------

func TestBuildHTMLDocument_HasDoctype(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Test", "Body.", "final", 1),
	}
	html := buildHTMLDocument(rows, "example.com")
	assert.True(t, strings.HasPrefix(html, "<!DOCTYPE html>"), "should start with DOCTYPE")
}

func TestBuildHTMLDocument_HasTOC(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Alpha", "Content A.", "final", 2),
		makeCopyRow("2", "page", "Beta", "Content B.", "draft", 2),
	}
	html := buildHTMLDocument(rows, "example.com")
	assert.Contains(t, html, `class="toc"`)
	assert.Contains(t, html, "Alpha")
	assert.Contains(t, html, "Beta")
}

func TestBuildHTMLDocument_EscapesHTML(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "<script>alert('xss')</script>", "Body.", "final", 1),
	}
	output := buildHTMLDocument(rows, "example.com")
	// The <script> tags should be escaped in the HTML output.
	assert.NotContains(t, output, "<script>")
	assert.Contains(t, output, "&lt;script&gt;")
}

func TestBuildHTMLDocument_MultipleChapters(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Chapter One", "Body A.", "final", 2),
		makeCopyRow("2", "page", "Chapter Two", "Body B.", "draft", 2),
	}
	output := buildHTMLDocument(rows, "example.com")
	// Count <h2> occurrences — each row produces one h2 chapter heading.
	count := strings.Count(output, "<h2>")
	assert.Equal(t, 2, count, "expected 2 <h2> chapter headings")
}

func TestBuildHTMLDocument_Footer(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Test", "Body.", "final", 1),
	}
	output := buildHTMLDocument(rows, "example.com")
	assert.Contains(t, output, "Generated by Webkit")
}

// ---------------------------------------------------------------------------
// convertHTMLToPDF (integration-style with httptest)
// ---------------------------------------------------------------------------

func TestConvertHTMLToPDF_Success(t *testing.T) {
	fakePDF := []byte("%PDF-1.4 fake content")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify it's a POST to the expected path.
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/forms/chromium/convert/html", r.URL.Path)

		// Verify content type is multipart form data.
		ct := r.Header.Get("Content-Type")
		assert.True(t, strings.HasPrefix(ct, "multipart/form-data"), "expected multipart/form-data, got %s", ct)

		// Parse the multipart form to verify index.html file is present.
		err := r.ParseMultipartForm(10 << 20)
		require.NoError(t, err)
		file, header, err := r.FormFile("files")
		require.NoError(t, err)
		defer file.Close()
		assert.Equal(t, "index.html", header.Filename)

		// Read and verify the HTML content is non-empty.
		htmlBytes, err := io.ReadAll(file)
		require.NoError(t, err)
		assert.True(t, len(htmlBytes) > 0, "HTML content should not be empty")

		w.WriteHeader(http.StatusOK)
		w.Write(fakePDF)
	}))
	defer srv.Close()

	result, err := convertHTMLToPDF(context.Background(), srv.URL, "<html><body>Hello</body></html>")
	require.NoError(t, err)
	assert.Equal(t, fakePDF, result)
}

func TestConvertHTMLToPDF_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, "internal server error")
	}))
	defer srv.Close()

	_, err := convertHTMLToPDF(context.Background(), srv.URL, "<html></html>")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "500")
}

func TestConvertHTMLToPDF_EmptyURL(t *testing.T) {
	rows := []copyRow{
		makeCopyRow("1", "page", "Test", "Body.", "final", 1),
	}
	// exportPDF checks for empty gotenbergURL and returns an error.
	_, err := exportPDF(context.Background(), "", rows, "example-com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "GOTENBERG_URL not configured")
}

// ---------------------------------------------------------------------------
// exportPDF
// ---------------------------------------------------------------------------

func TestExportPDF_Success(t *testing.T) {
	fakePDF := []byte("%PDF-1.4 test data")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write(fakePDF)
	}))
	defer srv.Close()

	rows := []copyRow{
		makeCopyRow("1", "page", "Test Page", "Hello world.", "final", 2),
	}
	result, err := exportPDF(context.Background(), srv.URL, rows, "example-com")
	require.NoError(t, err)
	assert.Equal(t, "application/pdf", result.ContentType)
	assert.Equal(t, fakePDF, result.Data)
}

func TestExportPDF_FilenameFormat(t *testing.T) {
	fakePDF := []byte("%PDF-1.4 test data")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write(fakePDF)
	}))
	defer srv.Close()

	rows := []copyRow{
		makeCopyRow("1", "page", "Test", "Body.", "final", 1),
	}
	result, err := exportPDF(context.Background(), srv.URL, rows, "mysite-com")
	require.NoError(t, err)
	assert.Equal(t, "mysite-com-copy.pdf", result.Filename)
}

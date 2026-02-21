package export

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"
)

// exportMarkdown creates a .zip archive with one .md file per copy item.
// Each file includes YAML front matter with metadata.
func exportMarkdown(rows []copyRow, domain string) (*ExportResult, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	for i, c := range rows {
		var md strings.Builder

		// YAML front matter.
		md.WriteString("---\n")
		md.WriteString(fmt.Sprintf("title: %q\n", c.Title))
		md.WriteString(fmt.Sprintf("copy_type: %s\n", c.CopyType))
		if c.TargetKeyword.Valid && c.TargetKeyword.String != "" {
			md.WriteString(fmt.Sprintf("target_keyword: %q\n", c.TargetKeyword.String))
		}
		md.WriteString(fmt.Sprintf("status: %s\n", c.Status))
		md.WriteString(fmt.Sprintf("word_count: %d\n", c.ActualWordCount))
		md.WriteString("---\n\n")

		// Title as H1.
		if c.Title != "" {
			md.WriteString(fmt.Sprintf("# %s\n\n", c.Title))
		}

		// Content body.
		md.WriteString(c.Content)
		md.WriteString("\n")

		// Filename: zero-padded index + sanitised title.
		fname := fmt.Sprintf("%03d-%s.md", i+1, sanitiseFilename(c.Title))
		if c.Title == "" {
			fname = fmt.Sprintf("%03d-%s.md", i+1, c.CopyType)
		}

		fw, err := zw.Create(fname)
		if err != nil {
			return nil, fmt.Errorf("creating zip entry %s: %w", fname, err)
		}
		if _, err := fw.Write([]byte(md.String())); err != nil {
			return nil, fmt.Errorf("writing zip entry %s: %w", fname, err)
		}
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("closing zip writer: %w", err)
	}

	return &ExportResult{
		Data:        buf.Bytes(),
		Filename:    domain + "-copy-markdown.zip",
		ContentType: "application/zip",
	}, nil
}

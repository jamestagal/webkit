package export

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"
)

// exportText creates a .zip archive with one .txt file per copy item.
// Uses ALL CAPS section headings, no markup.
func exportText(rows []copyRow, domain string) (*ExportResult, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	for i, c := range rows {
		var txt strings.Builder

		// Page heading.
		title := c.Title
		if title == "" {
			title = c.CopyType
		}
		txt.WriteString(strings.ToUpper("PAGE: " + title))
		txt.WriteString("\n")
		txt.WriteString(strings.Repeat("=", len("PAGE: "+title)))
		txt.WriteString("\n\n")

		// Target keyword.
		if c.TargetKeyword.Valid && c.TargetKeyword.String != "" {
			txt.WriteString("TARGET KEYWORD: " + c.TargetKeyword.String)
			txt.WriteString("\n")
		}

		// Metadata line.
		txt.WriteString(fmt.Sprintf("TYPE: %s | STATUS: %s | WORDS: %d",
			strings.ToUpper(c.CopyType),
			strings.ToUpper(c.Status),
			c.ActualWordCount,
		))
		txt.WriteString("\n")

		// Separator.
		txt.WriteString(strings.Repeat("-", 60))
		txt.WriteString("\n\n")

		// Content body (strip any markdown formatting for plain text).
		txt.WriteString(c.Content)
		txt.WriteString("\n")

		// Filename.
		fname := fmt.Sprintf("%03d-%s.txt", i+1, sanitiseFilename(title))

		fw, err := zw.Create(fname)
		if err != nil {
			return nil, fmt.Errorf("creating zip entry %s: %w", fname, err)
		}
		if _, err := fw.Write([]byte(txt.String())); err != nil {
			return nil, fmt.Errorf("writing zip entry %s: %w", fname, err)
		}
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("closing zip writer: %w", err)
	}

	return &ExportResult{
		Data:        buf.Bytes(),
		Filename:    domain + "-copy-text.zip",
		ContentType: "application/zip",
	}, nil
}

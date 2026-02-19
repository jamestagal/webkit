package profiler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/liushuangls/go-anthropic/v2"
)

// ContentTheme represents a theme extracted from page content.
type ContentTheme struct {
	Topic       string   `json:"topic"`
	Description string   `json:"description"`
	Examples    []string `json:"examples"`
	Frequency   int      `json:"frequency"`
	Sentiment   string   `json:"sentiment"`
}

// ExtractThemes uses Claude Haiku to identify recurring content themes from page snippets.
func (p *Profiler) ExtractThemes(ctx context.Context, pages []PageSnippet) ([]ContentTheme, error) {
	if len(pages) == 0 {
		return nil, nil
	}

	// Concatenate page texts, keeping to ~3-4k tokens (~12-16k characters)
	var sb strings.Builder
	const maxChars = 14000
	for i, pg := range pages {
		if sb.Len() >= maxChars {
			break
		}
		snippet := pg.BodyText
		remaining := maxChars - sb.Len()
		if len(snippet) > remaining {
			snippet = snippet[:remaining]
		}
		fmt.Fprintf(&sb, "--- Page %d: %s (%s) ---\n%s\n\n", i+1, pg.Title, pg.PageType, snippet)
	}

	client := anthropic.NewClient(p.anthropicKey)

	systemPrompt := `You are a content analyst. Analyze the provided website content and extract the 5-8 most prominent recurring themes.

Return ONLY a JSON array with this exact structure:
[
  {
    "topic": "short theme name",
    "description": "brief description of the theme",
    "examples": ["example quote or paraphrase from the content", "another example"],
    "frequency": 3,
    "sentiment": "positive"
  }
]

The frequency field is an estimate of how many pages reference this theme. The sentiment field should be one of: positive, negative, neutral, or mixed. The examples field should contain 1-3 direct quotes or close paraphrases from the content. Focus on brand messaging themes, value propositions, and recurring topics. Return valid JSON only, no markdown fences.`

	resp, err := client.CreateMessages(ctx, anthropic.MessagesRequest{
		Model: anthropic.ModelClaudeHaiku4Dot5,
		Messages: []anthropic.Message{
			{
				Role: anthropic.RoleUser,
				Content: []anthropic.MessageContent{
					anthropic.NewTextMessageContent(sb.String()),
				},
			},
		},
		System:    systemPrompt,
		MaxTokens: 2048,
	})
	if err != nil {
		return nil, fmt.Errorf("themes: anthropic call: %w", err)
	}

	raw := resp.GetFirstContentText()
	if raw == "" {
		return nil, fmt.Errorf("themes: empty response from LLM")
	}

	// Strip potential markdown code fences
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var themes []ContentTheme
	if err := json.Unmarshal([]byte(raw), &themes); err != nil {
		slog.Warn("Failed to parse themes JSON, returning empty",
			"error", err,
			"raw_response", raw[:min(len(raw), 200)],
		)
		return nil, fmt.Errorf("themes: parse response: %w", err)
	}

	return themes, nil
}

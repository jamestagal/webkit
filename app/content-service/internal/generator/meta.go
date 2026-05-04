package generator

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/liushuangls/go-anthropic/v2"

	otel "app/pkg/otel"
)

// ModelHaiku is the model used for lightweight tasks like meta generation.
var ModelHaiku = anthropic.ModelClaudeHaiku4Dot5

// MetaResult holds the generated meta title and description.
type MetaResult struct {
	MetaTitle       string    `json:"meta_title"`
	MetaDescription string    `json:"meta_description"`
	TitleCopyID     uuid.UUID `json:"title_copy_id"`
	DescCopyID      uuid.UUID `json:"desc_copy_id"`
	PromptTokens    int       `json:"prompt_tokens"`
	CompletionTokens int      `json:"completion_tokens"`
	ModelUsed       string    `json:"model_used"`
}

// GenerateMeta generates a meta title and meta description for a specific page.
func (g *Generator) GenerateMeta(
	ctx context.Context,
	clientID, agencyID, pageID uuid.UUID,
	targetKeyword string,
	generatedBy uuid.UUID,
) (*MetaResult, error) {
	// 1. Get page data.
	var pageTitle, bodyText, pageType sql.NullString
	err := g.db.QueryRowContext(ctx,
		"SELECT title, body_text, page_type FROM content_pages WHERE id = $1",
		pageID,
	).Scan(&pageTitle, &bodyText, &pageType)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("generator: page not found: %s", pageID)
	}
	if err != nil {
		return nil, fmt.Errorf("generator: fetch page: %w", err)
	}

	// 2. Get brand profile (Tier 1).
	var profileJSON sql.NullString
	_ = g.db.QueryRowContext(ctx,
		`SELECT profile FROM brand_profiles
		 WHERE client_id = $1 AND agency_id = $2 AND is_active = true
		 LIMIT 1`,
		clientID, agencyID,
	).Scan(&profileJSON)

	// 3. Build meta-specific prompt.
	systemPrompt := "You are an SEO specialist. Generate a meta title and meta description for a web page. " +
		"The meta title must be 50-60 characters. The meta description must be 150-160 characters. " +
		"Respond with ONLY valid JSON in this format: {\"meta_title\": \"...\", \"meta_description\": \"...\"}"

	if profileJSON.Valid && profileJSON.String != "" {
		systemPrompt += "\n\n[BRAND PROFILE]\n" + profileJSON.String
	}

	var userMsgParts []string
	if pageType.Valid {
		userMsgParts = append(userMsgParts, fmt.Sprintf("Page type: %s", pageType.String))
	}
	if pageTitle.Valid {
		userMsgParts = append(userMsgParts, fmt.Sprintf("Page title: %s", pageTitle.String))
	}
	if targetKeyword != "" {
		userMsgParts = append(userMsgParts, fmt.Sprintf("Target keyword: %s", targetKeyword))
	}
	if bodyText.Valid {
		// Truncate body text for the prompt.
		bt := bodyText.String
		if len(bt) > 1000 {
			bt = bt[:1000]
		}
		userMsgParts = append(userMsgParts, fmt.Sprintf("Page content excerpt:\n%s", bt))
	}
	userMsg := strings.Join(userMsgParts, "\n")

	// 4. Call Claude Haiku.
	client := anthropic.NewClient(g.apiKey)
	done := otel.StartExternalCall(ctx, "anthropic", "generator_meta")
	resp, err := client.CreateMessages(ctx, anthropic.MessagesRequest{
		Model: ModelHaiku,
		Messages: []anthropic.Message{
			{
				Role: anthropic.RoleUser,
				Content: []anthropic.MessageContent{
					anthropic.NewTextMessageContent(userMsg),
				},
			},
		},
		System:    systemPrompt,
		MaxTokens: 256,
	})
	done(err)
	if err != nil {
		return nil, fmt.Errorf("generator: anthropic API (meta): %w", err)
	}

	text := resp.GetFirstContentText()

	// 5. Parse JSON response.
	var metaResp struct {
		MetaTitle       string `json:"meta_title"`
		MetaDescription string `json:"meta_description"`
	}

	// Try to extract JSON from the response (may have markdown code fences).
	jsonText := extractJSON(text)
	if err := json.Unmarshal([]byte(jsonText), &metaResp); err != nil {
		return nil, fmt.Errorf("generator: parse meta response: %w (raw: %s)", err, text)
	}

	// Validate lengths (warn but don't fail).
	if len(metaResp.MetaTitle) > 70 {
		metaResp.MetaTitle = metaResp.MetaTitle[:70]
	}
	if len(metaResp.MetaDescription) > 170 {
		metaResp.MetaDescription = metaResp.MetaDescription[:170]
	}

	// 6. INSERT two content_copy rows.
	titleCopyID := uuid.New()
	descCopyID := uuid.New()

	_, err = g.db.ExecContext(ctx,
		`INSERT INTO content_copy
		 (id, client_id, agency_id, page_id, generated_by, copy_type, title, content,
		  target_keyword, actual_word_count, status,
		  prompt_tokens, completion_tokens, model_used, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, 'meta_title', $6, $6, $7, $8, 'draft',
		         $9, $10, $11, NOW(), NOW())`,
		titleCopyID,
		clientID,
		agencyID,
		pageID,
		generatedBy,
		metaResp.MetaTitle,
		targetKeyword,
		len(strings.Fields(metaResp.MetaTitle)),
		resp.Usage.InputTokens,
		resp.Usage.OutputTokens,
		ModelHaiku,
	)
	if err != nil {
		return nil, fmt.Errorf("generator: insert meta_title copy: %w", err)
	}

	_, err = g.db.ExecContext(ctx,
		`INSERT INTO content_copy
		 (id, client_id, agency_id, page_id, generated_by, copy_type, title, content,
		  target_keyword, actual_word_count, status,
		  prompt_tokens, completion_tokens, model_used, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, 'meta_description', $6, $7, $8, $9, 'draft',
		         $10, $11, $12, NOW(), NOW())`,
		descCopyID,
		clientID,
		agencyID,
		pageID,
		generatedBy,
		"Meta Description",
		metaResp.MetaDescription,
		targetKeyword,
		len(strings.Fields(metaResp.MetaDescription)),
		resp.Usage.InputTokens,
		resp.Usage.OutputTokens,
		ModelHaiku,
	)
	if err != nil {
		return nil, fmt.Errorf("generator: insert meta_description copy: %w", err)
	}

	return &MetaResult{
		MetaTitle:        metaResp.MetaTitle,
		MetaDescription:  metaResp.MetaDescription,
		TitleCopyID:      titleCopyID,
		DescCopyID:       descCopyID,
		PromptTokens:     resp.Usage.InputTokens,
		CompletionTokens: resp.Usage.OutputTokens,
		ModelUsed:        string(ModelHaiku),
	}, nil
}

// extractJSON attempts to extract a JSON object from text that may include
// markdown code fences or other wrapper text.
func extractJSON(text string) string {
	text = strings.TrimSpace(text)

	// Strip markdown code fences.
	if strings.HasPrefix(text, "```") {
		lines := strings.SplitN(text, "\n", 2)
		if len(lines) > 1 {
			text = lines[1]
		}
		if idx := strings.LastIndex(text, "```"); idx >= 0 {
			text = text[:idx]
		}
		text = strings.TrimSpace(text)
	}

	// Find the first { and last }.
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end > start {
		return text[start : end+1]
	}

	return text
}

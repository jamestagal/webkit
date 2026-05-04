package generator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/liushuangls/go-anthropic/v2"

	otel "app/pkg/otel"
)

// SocialVariation represents a single generated social post variation.
type SocialVariation struct {
	CopyID         uuid.UUID `json:"copy_id"`
	Angle          string    `json:"angle"`
	Post           string    `json:"post"`
	Hashtags       []string  `json:"hashtags"`
	CharacterCount int       `json:"character_count"`
}

// SocialResult is the output of a social media generation call.
type SocialResult struct {
	Platform         string            `json:"platform"`
	Variations       []SocialVariation `json:"variations"`
	PromptTokens     int               `json:"prompt_tokens"`
	CompletionTokens int               `json:"completion_tokens"`
	ModelUsed        string            `json:"model_used"`
}

// SocialRequest describes what social media content to generate.
type SocialRequest struct {
	AgencyID     uuid.UUID
	ClientID     uuid.UUID
	PageID       *uuid.UUID
	Platform     string
	Topic        string
	PostGoal     string
	ToneOverride string
	GeneratedBy  uuid.UUID
}

// GenerateSocial generates platform-specific social media posts with 3 variations.
func (g *Generator) GenerateSocial(ctx context.Context, req SocialRequest) (*SocialResult, error) {
	// 1. Assemble multi-tier context.
	genCtx, err := g.AssembleContext(ctx, req.ClientID, req.AgencyID, req.PageID, "")
	if err != nil {
		return nil, fmt.Errorf("generator: assemble context: %w", err)
	}

	// 2. Build system prompt.
	systemPrompt := buildSocialSystemPrompt(req.Platform, req.ToneOverride)

	// 3. Build user message from context.
	userMsg := buildSocialUserMessage(genCtx, req)

	// 4. Call Claude Haiku.
	client := anthropic.NewClient(g.apiKey)
	done := otel.StartExternalCall(ctx, "anthropic", "generator_social")
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
		MaxTokens: 2048,
	})
	done(err)
	if err != nil {
		return nil, fmt.Errorf("generator: anthropic API (social): %w", err)
	}

	text := resp.GetFirstContentText()

	// 5. Parse JSON response.
	var socialResp struct {
		Variations []struct {
			Angle          string   `json:"angle"`
			Post           string   `json:"post"`
			Hashtags       []string `json:"hashtags"`
			CharacterCount int      `json:"character_count"`
		} `json:"variations"`
	}

	jsonText := extractJSON(text)
	if err := json.Unmarshal([]byte(jsonText), &socialResp); err != nil {
		return nil, fmt.Errorf("generator: parse social response: %w (raw: %s)", err, text)
	}

	// 6. INSERT each variation as a separate content_copy row.
	result := &SocialResult{
		Platform:         req.Platform,
		Variations:       make([]SocialVariation, 0, len(socialResp.Variations)),
		PromptTokens:     resp.Usage.InputTokens,
		CompletionTokens: resp.Usage.OutputTokens,
		ModelUsed:        string(ModelHaiku),
	}

	for _, v := range socialResp.Variations {
		copyID := uuid.New()

		genConfigMap := map[string]any{
			"platform":       req.Platform,
			"angle":          v.Angle,
			"prompt_version": "1",
			"topic":          req.Topic,
			"hashtags":       v.Hashtags,
		}
		if req.PostGoal != "" {
			genConfigMap["post_goal"] = req.PostGoal
		}
		if req.ToneOverride != "" {
			genConfigMap["tone_override"] = req.ToneOverride
		}
		genConfig, _ := json.Marshal(genConfigMap)

		title := fmt.Sprintf("%s Post - %s", platformTitle(req.Platform), angleName(v.Angle))

		_, err = g.db.ExecContext(ctx,
			`INSERT INTO content_copy
			 (id, client_id, agency_id, page_id, generated_by, copy_type, title, content,
			  target_word_count, actual_word_count, status,
			  prompt_tokens, completion_tokens, model_used, generation_config, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, 'social_post', $6, $7, $8, $9, 'draft',
			         $10, $11, $12, $13, NOW(), NOW())`,
			copyID,
			req.ClientID,
			req.AgencyID,
			uuidPtrToNullable(req.PageID),
			req.GeneratedBy,
			title,
			v.Post,
			v.CharacterCount,
			len(strings.Fields(v.Post)),
			resp.Usage.InputTokens,
			resp.Usage.OutputTokens,
			ModelHaiku,
			genConfig,
		)
		if err != nil {
			return nil, fmt.Errorf("generator: insert social_post copy: %w", err)
		}

		result.Variations = append(result.Variations, SocialVariation{
			CopyID:         copyID,
			Angle:          v.Angle,
			Post:           v.Post,
			Hashtags:       v.Hashtags,
			CharacterCount: v.CharacterCount,
		})
	}

	return result, nil
}

// buildSocialSystemPrompt creates the system prompt for social media generation.
func buildSocialSystemPrompt(platform, toneOverride string) string {
	base := "You are a social media content expert. Generate 3 variations of a social media post " +
		"with different angles: informative, engaging, and story_driven. " +
		"Respond with ONLY valid JSON in this format:\n" +
		`{"variations": [{"angle": "informative", "post": "...", "hashtags": ["..."], "character_count": 280}, ` +
		`{"angle": "engaging", "post": "...", "hashtags": ["..."], "character_count": 275}, ` +
		`{"angle": "story_driven", "post": "...", "hashtags": ["..."], "character_count": 260}]}`

	constraints := "\n\nPlatform-specific constraints:\n"
	switch platform {
	case "twitter":
		constraints += "- Platform: Twitter/X\n- Maximum 280 characters per post\n- Use relevant hashtags (2-3)\n- Punchy, concise tone\n- Include a hook in the first line"
	case "linkedin":
		constraints += "- Platform: LinkedIn\n- Maximum 3000 characters per post\n- Professional, authoritative tone\n- Include a clear call-to-action\n- Use line breaks for readability"
	case "facebook":
		constraints += "- Platform: Facebook\n- Maximum 500 characters per post\n- Conversational, friendly tone\n- Emoji-friendly\n- Encourage engagement (questions, polls)"
	case "instagram":
		constraints += "- Platform: Instagram\n- Maximum 2200 characters per caption\n- Caption style with storytelling\n- Include a hashtag block at the end (5-10 hashtags)\n- Use line breaks and emojis for visual appeal"
	}

	if toneOverride != "" {
		constraints += fmt.Sprintf("\n- Tone override: Write in a %s tone", toneOverride)
	}

	return base + constraints
}

// buildSocialUserMessage constructs the user message for social media generation.
func buildSocialUserMessage(gc *GenerationContext, req SocialRequest) string {
	var sb strings.Builder

	if len(gc.BrandProfile) > 0 {
		sb.WriteString("[BRAND PROFILE]\n")
		sb.WriteString(string(gc.BrandProfile))
		sb.WriteString("\n\n")
	}

	if len(gc.ContentChunks) > 0 {
		sb.WriteString("[CONTENT CONTEXT]\n")
		sb.WriteString("Use the following content as source material for the social posts:\n\n")
		for i, chunk := range gc.ContentChunks {
			fmt.Fprintf(&sb, "--- Chunk %d ---\n%s\n\n", i+1, chunk)
		}
	}

	if gc.ClientBrief != nil {
		sb.WriteString("[CLIENT BRIEF]\n")
		fmt.Fprintf(&sb, "Business: %s\n", gc.ClientBrief.BusinessName)
		fmt.Fprintf(&sb, "Industry: %s\n", gc.ClientBrief.Industry)
		if len(gc.ClientBrief.PrimaryGoals) > 0 {
			fmt.Fprintf(&sb, "Goals: %s\n", string(gc.ClientBrief.PrimaryGoals))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("[INSTRUCTION]\n")
	fmt.Fprintf(&sb, "Topic: %s\n", req.Topic)
	fmt.Fprintf(&sb, "Generate 3 %s post variations about this topic. ", req.Platform)
	sb.WriteString("Each variation should take a different angle: informative, engaging, and story_driven.")
	if req.PostGoal != "" {
		fmt.Fprintf(&sb, "\nPost goal: %s — optimize the posts for this objective.", req.PostGoal)
	}

	return sb.String()
}

// platformTitle returns the display name for a platform.
func platformTitle(platform string) string {
	switch platform {
	case "twitter":
		return "Twitter"
	case "linkedin":
		return "LinkedIn"
	case "facebook":
		return "Facebook"
	case "instagram":
		return "Instagram"
	default:
		return platform
	}
}

// angleName returns the display name for a variation angle.
func angleName(angle string) string {
	switch angle {
	case "informative":
		return "Informative"
	case "engaging":
		return "Engaging"
	case "story_driven":
		return "Story Driven"
	default:
		return angle
	}
}

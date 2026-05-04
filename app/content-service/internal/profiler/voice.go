package profiler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/liushuangls/go-anthropic/v2"

	otel "app/pkg/otel"
)

// VoiceInput aggregates all source data for voice profile generation.
type VoiceInput struct {
	Pages         []PageSnippet
	Themes        []ContentTheme
	Questionnaire *QuestionnaireContext
	SourceType    SourceType
}

const voiceSystemPrompt = `You are a brand strategist specializing in voice and tone analysis. Analyze the provided content and business context to produce a structured brand voice profile.

Produce a JSON object matching this EXACT schema (no extra fields, no markdown fences):

{
  "personality_traits": ["string array of 3-5 personality traits"],
  "tone_guidelines": {
    "default": "description of default tone",
    "promotional": "description of promotional tone",
    "educational": "description of educational tone"
  },
  "vocabulary": {
    "formality_level": "formal|semi-formal|casual|mixed",
    "industry_jargon": ["industry-specific terms they use"],
    "avoided_terms": ["terms they seem to avoid or never use"],
    "signature_phrases": ["distinctive phrases or expressions"]
  },
  "sentence_structure": {
    "avg_length": "short|medium|long|varied",
    "active_passive": "mostly_active|mostly_passive|balanced",
    "uses_contractions": true
  },
  "messaging_pillars": [
    {"theme": "core theme name", "evidence": "supporting evidence from content"}
  ],
  "constraints": {
    "always": ["things the brand always does"],
    "never": ["things the brand never does"]
  },
  "competitive_positioning": {
    "differentiators": ["what makes this brand unique"],
    "industry_norms": ["standard industry practices they follow"],
    "gaps_to_fill": ["opportunities not yet addressed"]
  }
}

Base your analysis on the actual content provided. Be specific and evidence-based, not generic. Return valid JSON only.`

// GenerateVoiceProfile uses Claude Sonnet to generate a comprehensive brand voice profile.
func (p *Profiler) GenerateVoiceProfile(ctx context.Context, input VoiceInput) (*BrandProfile, error) {
	userMessage := buildVoiceUserMessage(input)

	client := anthropic.NewClient(p.anthropicKey)

	done := otel.StartExternalCall(ctx, "anthropic", "profiler_voice")
	resp, err := client.CreateMessages(ctx, anthropic.MessagesRequest{
		Model: anthropic.ModelClaudeSonnet4Dot5,
		Messages: []anthropic.Message{
			{
				Role: anthropic.RoleUser,
				Content: []anthropic.MessageContent{
					anthropic.NewTextMessageContent(userMessage),
				},
			},
		},
		System:    voiceSystemPrompt,
		MaxTokens: 4096,
	})
	done(err)
	if err != nil {
		return nil, fmt.Errorf("voice: anthropic call: %w", err)
	}

	raw := resp.GetFirstContentText()
	if raw == "" {
		return nil, fmt.Errorf("voice: empty response from LLM")
	}

	// Strip potential markdown code fences
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var profile BrandProfile
	if err := json.Unmarshal([]byte(raw), &profile); err != nil {
		slog.Warn("Failed to parse voice profile JSON",
			"error", err,
			"raw_response", raw[:min(len(raw), 300)],
		)
		return nil, fmt.Errorf("voice: parse response: %w", err)
	}

	return &profile, nil
}

// buildVoiceUserMessage assembles the user message from all available sources.
func buildVoiceUserMessage(input VoiceInput) string {
	var sb strings.Builder

	sb.WriteString("Analyze the following content and context to create a brand voice profile.\n\n")

	// Add questionnaire context if available
	if input.Questionnaire != nil {
		sb.WriteString("## Business Context\n\n")
		q := input.Questionnaire
		if q.BusinessName != "" {
			fmt.Fprintf(&sb, "- Business Name: %s\n", q.BusinessName)
		}
		if q.Industry != "" {
			fmt.Fprintf(&sb, "- Industry: %s\n", q.Industry)
		}
		if q.BusinessType != "" {
			fmt.Fprintf(&sb, "- Business Type: %s\n", q.BusinessType)
		}
		if q.ConversionGoal != "" {
			fmt.Fprintf(&sb, "- Conversion Goal: %s\n", q.ConversionGoal)
		}
		if len(q.PrimaryChallenges) > 0 {
			fmt.Fprintf(&sb, "- Primary Challenges: %s\n", strings.Join(q.PrimaryChallenges, ", "))
		}
		if len(q.PrimaryGoals) > 0 {
			fmt.Fprintf(&sb, "- Primary Goals: %s\n", strings.Join(q.PrimaryGoals, ", "))
		}
		if len(q.DesignStyles) > 0 {
			fmt.Fprintf(&sb, "- Design Preferences: %s\n", strings.Join(q.DesignStyles, ", "))
		}
		if len(q.AdmiredWebsites) > 0 {
			fmt.Fprintf(&sb, "- Admired Websites: %s\n", strings.Join(q.AdmiredWebsites, ", "))
		}
		if q.ConsultationNotes != "" {
			fmt.Fprintf(&sb, "- Notes: %s\n", q.ConsultationNotes)
		}
		if q.FormData != nil {
			formJSON, _ := json.Marshal(q.FormData)
			if len(formJSON) > 2 { // skip empty "{}"
				fmt.Fprintf(&sb, "- Additional Form Data: %s\n", string(formJSON))
			}
		}
		sb.WriteString("\n")
	}

	// Add extracted themes if available
	if len(input.Themes) > 0 {
		sb.WriteString("## Content Themes Identified\n\n")
		for i, t := range input.Themes {
			examples := strings.Join(t.Examples, "; ")
			fmt.Fprintf(&sb, "%d. **%s**: %s (found across ~%d pages, sentiment: %s)\n   Examples: %q\n",
				i+1, t.Topic, t.Description, t.Frequency, t.Sentiment, examples)
		}
		sb.WriteString("\n")
	}

	// Add page content samples
	if len(input.Pages) > 0 {
		sb.WriteString("## Website Content Samples\n\n")
		const maxTotalChars = 12000
		charCount := 0
		for i, pg := range input.Pages {
			if charCount >= maxTotalChars {
				break
			}
			snippet := pg.BodyText
			remaining := maxTotalChars - charCount
			if len(snippet) > remaining {
				snippet = snippet[:remaining]
			}
			fmt.Fprintf(&sb, "### Page %d: %s (%s)\nURL: %s\n%s\n\n",
				i+1, pg.Title, pg.PageType, pg.URL, snippet)
			charCount += len(snippet)
		}
	}

	return sb.String()
}

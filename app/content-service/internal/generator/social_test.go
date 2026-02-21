package generator

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestBuildSocialSystemPrompt(t *testing.T) {
	tests := []struct {
		name     string
		platform string
		contains string
	}{
		{
			name:     "twitter contains character limit",
			platform: "twitter",
			contains: "280 characters",
		},
		{
			name:     "linkedin contains character limit",
			platform: "linkedin",
			contains: "3000 characters",
		},
		{
			name:     "facebook contains character limit",
			platform: "facebook",
			contains: "500 characters",
		},
		{
			name:     "instagram contains character limit",
			platform: "instagram",
			contains: "2200 characters",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			prompt := buildSocialSystemPrompt(tc.platform, "")
			assert.Contains(t, prompt, tc.contains)
			// All prompts should contain the JSON format instruction
			assert.Contains(t, prompt, "variations")
			assert.Contains(t, prompt, "social media content expert")
		})
	}
}

func TestBuildSocialSystemPrompt_WithToneOverride(t *testing.T) {
	prompt := buildSocialSystemPrompt("twitter", "humorous")
	assert.Contains(t, prompt, "Tone override")
	assert.Contains(t, prompt, "humorous")
	assert.Contains(t, prompt, "280 characters")
}

func TestBuildSocialSystemPrompt_NoToneOverride(t *testing.T) {
	prompt := buildSocialSystemPrompt("twitter", "")
	assert.NotContains(t, prompt, "Tone override")
}

func TestBuildSocialUserMessage(t *testing.T) {
	t.Run("with brand profile", func(t *testing.T) {
		gc := &GenerationContext{
			BrandProfile: json.RawMessage(`{"tone":"professional","voice":"authoritative"}`),
		}
		req := SocialRequest{
			Platform: "twitter",
			Topic:    "AI in marketing",
		}

		msg := buildSocialUserMessage(gc, req)
		assert.Contains(t, msg, "[BRAND PROFILE]")
		assert.Contains(t, msg, "professional")
		assert.Contains(t, msg, "[INSTRUCTION]")
		assert.Contains(t, msg, "AI in marketing")
		assert.Contains(t, msg, "twitter")
	})

	t.Run("with topic", func(t *testing.T) {
		gc := &GenerationContext{}
		req := SocialRequest{
			Platform: "linkedin",
			Topic:    "remote work trends",
		}

		msg := buildSocialUserMessage(gc, req)
		assert.Contains(t, msg, "remote work trends")
		assert.Contains(t, msg, "linkedin")
		assert.Contains(t, msg, "3 linkedin post variations")
	})

	t.Run("with post goal", func(t *testing.T) {
		gc := &GenerationContext{}
		req := SocialRequest{
			Platform: "facebook",
			Topic:    "product launch",
			PostGoal: "engagement",
		}

		msg := buildSocialUserMessage(gc, req)
		assert.Contains(t, msg, "Post goal: engagement")
		assert.Contains(t, msg, "optimize the posts for this objective")
	})

	t.Run("without post goal", func(t *testing.T) {
		gc := &GenerationContext{}
		req := SocialRequest{
			Platform: "twitter",
			Topic:    "tech news",
		}

		msg := buildSocialUserMessage(gc, req)
		assert.NotContains(t, msg, "Post goal")
	})

	t.Run("with content chunks", func(t *testing.T) {
		gc := &GenerationContext{
			ContentChunks: []string{"chunk one text", "chunk two text"},
		}
		req := SocialRequest{
			Platform: "instagram",
			Topic:    "behind the scenes",
		}

		msg := buildSocialUserMessage(gc, req)
		assert.Contains(t, msg, "[CONTENT CONTEXT]")
		assert.Contains(t, msg, "chunk one text")
		assert.Contains(t, msg, "chunk two text")
		assert.Contains(t, msg, "Chunk 1")
		assert.Contains(t, msg, "Chunk 2")
	})

	t.Run("with client brief", func(t *testing.T) {
		gc := &GenerationContext{
			ClientBrief: &ClientBriefData{
				BusinessName: "Acme Corp",
				Industry:     "Technology",
				PrimaryGoals: json.RawMessage(`["increase traffic","boost engagement"]`),
			},
		}
		req := SocialRequest{
			AgencyID: uuid.New(),
			ClientID: uuid.New(),
			Platform: "twitter",
			Topic:    "company update",
		}

		msg := buildSocialUserMessage(gc, req)
		assert.Contains(t, msg, "[CLIENT BRIEF]")
		assert.Contains(t, msg, "Acme Corp")
		assert.Contains(t, msg, "Technology")
		assert.Contains(t, msg, "increase traffic")
	})
}

func TestPlatformTitle(t *testing.T) {
	tests := []struct {
		platform string
		want     string
	}{
		{"twitter", "Twitter"},
		{"linkedin", "LinkedIn"},
		{"facebook", "Facebook"},
		{"instagram", "Instagram"},
		{"unknown", "unknown"},
		{"", ""},
	}

	for _, tc := range tests {
		t.Run(tc.platform, func(t *testing.T) {
			assert.Equal(t, tc.want, platformTitle(tc.platform))
		})
	}
}

func TestAngleName(t *testing.T) {
	tests := []struct {
		angle string
		want  string
	}{
		{"informative", "Informative"},
		{"engaging", "Engaging"},
		{"story_driven", "Story Driven"},
		{"unknown", "unknown"},
		{"", ""},
	}

	for _, tc := range tests {
		t.Run(tc.angle, func(t *testing.T) {
			assert.Equal(t, tc.want, angleName(tc.angle))
		})
	}
}

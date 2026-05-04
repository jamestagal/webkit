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

// ModelSonnet is the model used for copy generation (high quality).
var ModelSonnet = anthropic.ModelClaudeSonnet4Dot5

// CopyRequest describes what content to generate.
type CopyRequest struct {
	ClientID        uuid.UUID
	AgencyID        uuid.UUID
	PageID          *uuid.UUID
	CopyType        string
	TargetKeyword   string
	TargetWordCount int
	Notes           string
	GeneratedBy     uuid.UUID
}

// CopyResult is the output of a generation call.
type CopyResult struct {
	CopyID           uuid.UUID `json:"copy_id"`
	Content          string    `json:"content"`
	Title            string    `json:"title"`
	ActualWordCount  int       `json:"actual_word_count"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	ModelUsed        string    `json:"model_used"`
}

// GenerateCopy assembles context, calls Claude, and persists the result.
func (g *Generator) GenerateCopy(ctx context.Context, req CopyRequest) (*CopyResult, error) {
	// 1. Assemble multi-tier context.
	genCtx, err := g.AssembleContext(ctx, req.ClientID, req.AgencyID, req.PageID, req.TargetKeyword)
	if err != nil {
		return nil, fmt.Errorf("generator: assemble context: %w", err)
	}

	// 2. Build system prompt.
	systemPrompt := buildSystemPrompt(genCtx)

	// 3. Build user message.
	userMsg := buildUserMessage(genCtx, req)

	// 4. Determine max tokens by copy type.
	maxTokens := maxTokensForType(req.CopyType)

	// 5. Call Claude Sonnet.
	client := anthropic.NewClient(g.apiKey)
	done := otel.StartExternalCall(ctx, "anthropic", "generator_copy")
	resp, err := client.CreateMessages(ctx, anthropic.MessagesRequest{
		Model: ModelSonnet,
		Messages: []anthropic.Message{
			{
				Role: anthropic.RoleUser,
				Content: []anthropic.MessageContent{
					anthropic.NewTextMessageContent(userMsg),
				},
			},
		},
		System:    systemPrompt,
		MaxTokens: maxTokens,
	})
	done(err)
	if err != nil {
		return nil, fmt.Errorf("generator: anthropic API: %w", err)
	}

	text := resp.GetFirstContentText()
	wordCount := len(strings.Fields(text))

	// Derive a title from the first line if it looks like a heading.
	title := deriveTitle(text, req.CopyType)

	// 6. Marshal context sources for storage.
	contextSourcesJSON, _ := json.Marshal(genCtx.ContextSources)

	// 7. INSERT into content_copy.
	copyID := uuid.New()
	_, err = g.db.ExecContext(ctx,
		`INSERT INTO content_copy
		 (id, client_id, agency_id, page_id, generated_by, copy_type, title, content,
		  target_keyword, target_word_count, actual_word_count, status,
		  prompt_tokens, completion_tokens, model_used, context_sources, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft',
		         $12, $13, $14, $15, NOW(), NOW())`,
		copyID,
		req.ClientID,
		req.AgencyID,
		uuidPtrToNullable(req.PageID),
		req.GeneratedBy,
		req.CopyType,
		title,
		text,
		req.TargetKeyword,
		req.TargetWordCount,
		wordCount,
		resp.Usage.InputTokens,
		resp.Usage.OutputTokens,
		ModelSonnet,
		contextSourcesJSON,
	)
	if err != nil {
		return nil, fmt.Errorf("generator: insert content_copy: %w", err)
	}

	return &CopyResult{
		CopyID:           copyID,
		Content:          text,
		Title:            title,
		ActualWordCount:  wordCount,
		PromptTokens:     resp.Usage.InputTokens,
		CompletionTokens: resp.Usage.OutputTokens,
		ModelUsed:        string(ModelSonnet),
	}, nil
}

// buildSystemPrompt creates the system prompt with brand profile as cached context.
func buildSystemPrompt(gc *GenerationContext) string {
	var sb strings.Builder
	sb.WriteString("You are an expert content writer and SEO strategist for web agencies. ")
	sb.WriteString("Write compelling, on-brand content that is optimized for search engines. ")
	sb.WriteString("Always write in the brand's established tone and voice.\n\n")

	if len(gc.BrandProfile) > 0 {
		sb.WriteString("[BRAND PROFILE]\n")
		sb.WriteString(string(gc.BrandProfile))
		sb.WriteString("\n\n")
	}

	return sb.String()
}

// buildUserMessage constructs the labeled-section user message.
func buildUserMessage(gc *GenerationContext, req CopyRequest) string {
	var sb strings.Builder

	// Content context from RAG chunks.
	if len(gc.ContentChunks) > 0 {
		sb.WriteString("[CONTENT CONTEXT]\n")
		sb.WriteString("The following are relevant content excerpts from the client's website:\n\n")
		for i, chunk := range gc.ContentChunks {
			sb.WriteString(fmt.Sprintf("--- Chunk %d ---\n%s\n\n", i+1, chunk))
		}
	}

	// SEO context.
	if gc.SEOContext != nil {
		sb.WriteString("[SEO CONTEXT]\n")
		if len(gc.SEOContext.Issues) > 0 {
			sb.WriteString("SEO issues to address:\n")
			for _, issue := range gc.SEOContext.Issues {
				sb.WriteString(fmt.Sprintf("- %s: %s\n", issue.Title, issue.Description))
			}
			sb.WriteString("\n")
		}
		if len(gc.SEOContext.CompetitorInsights) > 0 {
			sb.WriteString("Competitor insights:\n")
			for _, ci := range gc.SEOContext.CompetitorInsights {
				sb.WriteString(fmt.Sprintf("- %s: %s\n", ci.CompetitorDomain, string(ci.ContentThemes)))
			}
			sb.WriteString("\n")
		}
	}

	// Client brief.
	if gc.ClientBrief != nil {
		sb.WriteString("[CLIENT BRIEF]\n")
		sb.WriteString(fmt.Sprintf("Business: %s\n", gc.ClientBrief.BusinessName))
		sb.WriteString(fmt.Sprintf("Industry: %s\n", gc.ClientBrief.Industry))
		if len(gc.ClientBrief.PrimaryGoals) > 0 {
			sb.WriteString(fmt.Sprintf("Goals: %s\n", string(gc.ClientBrief.PrimaryGoals)))
		}
		if len(gc.ClientBrief.PrimaryChallenges) > 0 {
			sb.WriteString(fmt.Sprintf("Challenges: %s\n", string(gc.ClientBrief.PrimaryChallenges)))
		}
		if gc.ClientBrief.ConversionGoal != "" {
			sb.WriteString(fmt.Sprintf("Conversion goal: %s\n", gc.ClientBrief.ConversionGoal))
		}
		sb.WriteString("\n")
	}

	// Instruction based on copy type.
	sb.WriteString("[INSTRUCTION]\n")
	sb.WriteString(instructionForType(req))

	if req.TargetKeyword != "" {
		sb.WriteString(fmt.Sprintf("\nTarget keyword: %s", req.TargetKeyword))
	}
	if req.Notes != "" {
		sb.WriteString(fmt.Sprintf("\nAdditional notes: %s", req.Notes))
	}

	return sb.String()
}

// instructionForType returns a tailored instruction per copy type.
func instructionForType(req CopyRequest) string {
	switch req.CopyType {
	case "page_rewrite":
		return "Rewrite the existing page content, improving SEO and brand voice alignment."
	case "new_page":
		return "Write original page content from scratch for a new page."
	case "blog_post":
		wc := req.TargetWordCount
		if wc <= 0 {
			wc = 1000
		}
		return fmt.Sprintf("Write a blog post of %d words on the given topic.", wc)
	case "product_description":
		return "Write a product description of 150-400 words."
	case "cta":
		return "Write a compelling call-to-action."
	case "section":
		return "Write a specific content section."
	case "site_structure":
		return "Recommend a site page hierarchy as a structured JSON array with page_slug, page_type, and purpose for each page."
	case "h1_suggestion":
		return "Suggest 3 H1 heading options (20-70 characters each)."
	default:
		return "Write content based on the provided context."
	}
}

// maxTokensForType returns the appropriate max token count per copy type.
func maxTokensForType(copyType string) int {
	switch copyType {
	case "cta":
		return 256
	case "h1_suggestion":
		return 512
	case "product_description":
		return 1024
	case "section":
		return 2048
	case "site_structure":
		return 4096
	case "blog_post":
		return 8192
	case "page_rewrite", "new_page":
		return 4096
	default:
		return 4096
	}
}

// deriveTitle extracts a title from the first line of generated content.
func deriveTitle(text, copyType string) string {
	if text == "" {
		return copyType
	}
	lines := strings.SplitN(text, "\n", 2)
	first := strings.TrimSpace(lines[0])
	// Strip leading markdown heading markers.
	first = strings.TrimLeft(first, "# ")
	if len(first) > 120 {
		first = first[:120]
	}
	if first == "" {
		return copyType
	}
	return first
}

// uuidPtrToNullable converts a *uuid.UUID to an interface suitable for sql.
// Returns nil (SQL NULL) if the pointer is nil.
func uuidPtrToNullable(id *uuid.UUID) any {
	if id == nil {
		return nil
	}
	return *id
}

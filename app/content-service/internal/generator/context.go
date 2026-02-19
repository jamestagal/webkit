package generator

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	"content-service/internal/embeddings"

	"github.com/google/uuid"
)

// Generator orchestrates AI content generation using assembled context.
type Generator struct {
	db          *sql.DB
	apiKey      string
	embedClient *embeddings.Client
}

// New creates a Generator with the given dependencies.
func New(db *sql.DB, anthropicKey string, embedClient *embeddings.Client) *Generator {
	return &Generator{
		db:          db,
		apiKey:      anthropicKey,
		embedClient: embedClient,
	}
}

// GenerationContext holds the assembled data tiers used to build prompts.
type GenerationContext struct {
	BrandProfile   json.RawMessage  // Tier 1: brand profile JSON
	ContentChunks  []string         // Tier 2: RAG chunk texts
	SEOContext     *SEOContextData  // Tier 3: audit issues + competitor insights
	ClientBrief    *ClientBriefData // Tier 4: consultation summary
	ContextSources map[string]any   // tracking which sources were used
}

// SEOContextData holds SEO audit issues and competitor insights.
type SEOContextData struct {
	Issues             []SEOIssue         `json:"issues"`
	CompetitorInsights []CompetitorInsight `json:"competitor_insights"`
}

// SEOIssue is a single SEO issue for a page.
type SEOIssue struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// CompetitorInsight holds themes from a competitor analysis.
type CompetitorInsight struct {
	CompetitorDomain string          `json:"competitor_domain"`
	ContentThemes    json.RawMessage `json:"content_themes"`
}

// ClientBriefData holds the most recent consultation summary.
type ClientBriefData struct {
	BusinessName      string          `json:"business_name"`
	Industry          string          `json:"industry"`
	PrimaryGoals      json.RawMessage `json:"primary_goals"`
	PrimaryChallenges json.RawMessage `json:"primary_challenges"`
	ConversionGoal    string          `json:"conversion_goal"`
}

// AssembleContext gathers data from 4 tiers to build a rich generation context.
//
// Tier 1: Brand profile (tone, voice, style)
// Tier 2: RAG content chunks (semantic similarity search)
// Tier 3: SEO context (audit issues + competitor insights)
// Tier 4: Client brief (consultation data)
func (g *Generator) AssembleContext(
	ctx context.Context,
	clientID, agencyID uuid.UUID,
	pageID *uuid.UUID,
	targetKeyword string,
) (*GenerationContext, error) {
	gc := &GenerationContext{
		ContextSources: make(map[string]any),
	}

	// --- Tier 1: Brand profile ---
	var profileJSON sql.NullString
	err := g.db.QueryRowContext(ctx,
		`SELECT profile FROM brand_profiles
		 WHERE client_id = $1 AND agency_id = $2 AND is_active = true
		 LIMIT 1`,
		clientID, agencyID,
	).Scan(&profileJSON)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("generator: fetch brand profile: %w", err)
	}
	if profileJSON.Valid && profileJSON.String != "" {
		gc.BrandProfile = json.RawMessage(profileJSON.String)
		gc.ContextSources["brand_profile"] = true
	}

	// --- Tier 2: RAG content chunks ---
	queryText := targetKeyword
	if pageID != nil {
		var pageTitle sql.NullString
		_ = g.db.QueryRowContext(ctx,
			"SELECT title FROM content_pages WHERE id = $1",
			*pageID,
		).Scan(&pageTitle)
		if pageTitle.Valid && pageTitle.String != "" {
			queryText = targetKeyword + " " + pageTitle.String
		}
	}

	if queryText != "" && g.embedClient != nil {
		queryVec, err := g.embedClient.Embed(ctx, []string{queryText})
		if err != nil {
			slog.Warn("Failed to embed query for RAG context", "error", err)
		} else if len(queryVec) > 0 {
			chunks, err := embeddings.SearchSimilar(ctx, g.db, clientID, queryVec[0], 10)
			if err != nil {
				slog.Warn("Failed to search similar chunks", "error", err)
			} else {
				for _, c := range chunks {
					gc.ContentChunks = append(gc.ContentChunks, c.ChunkText)
				}
				gc.ContextSources["rag_chunks"] = len(gc.ContentChunks)
			}
		}
	}

	// --- Tier 3: SEO context ---
	seoCtx := g.assembleSEOContext(ctx, clientID, pageID)
	if seoCtx != nil {
		gc.SEOContext = seoCtx
		gc.ContextSources["seo_context"] = true
	}

	// --- Tier 4: Client brief ---
	brief := g.assembleClientBrief(ctx, clientID, agencyID)
	if brief != nil {
		gc.ClientBrief = brief
		gc.ContextSources["client_brief"] = true
	}

	return gc, nil
}

// assembleSEOContext fetches the latest completed audit's issues for the page
// and any competitor analysis insights.
func (g *Generator) assembleSEOContext(ctx context.Context, clientID uuid.UUID, pageID *uuid.UUID) *SEOContextData {
	// Find the latest completed audit for this client.
	var auditID uuid.UUID
	err := g.db.QueryRowContext(ctx,
		`SELECT id FROM seo_audits
		 WHERE client_id = $1 AND status = 'complete'
		 ORDER BY completed_at DESC LIMIT 1`,
		clientID,
	).Scan(&auditID)
	if err != nil {
		return nil
	}

	seoData := &SEOContextData{}

	// Get issues for the specific page if provided, otherwise all issues for the audit.
	if pageID != nil {
		rows, err := g.db.QueryContext(ctx,
			`SELECT title, description FROM seo_issues
			 WHERE audit_id = $1 AND page_id = $2
			 ORDER BY created_at DESC LIMIT 20`,
			auditID, *pageID,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var issue SEOIssue
				if err := rows.Scan(&issue.Title, &issue.Description); err == nil {
					seoData.Issues = append(seoData.Issues, issue)
				}
			}
		}
	} else {
		rows, err := g.db.QueryContext(ctx,
			`SELECT title, description FROM seo_issues
			 WHERE audit_id = $1
			 ORDER BY created_at DESC LIMIT 20`,
			auditID,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var issue SEOIssue
				if err := rows.Scan(&issue.Title, &issue.Description); err == nil {
					seoData.Issues = append(seoData.Issues, issue)
				}
			}
		}
	}

	// Get competitor insights.
	compRows, err := g.db.QueryContext(ctx,
		`SELECT competitor_domain, content_themes FROM competitor_analyses
		 WHERE client_id = $1
		 ORDER BY created_at DESC LIMIT 5`,
		clientID,
	)
	if err == nil {
		defer compRows.Close()
		for compRows.Next() {
			var ci CompetitorInsight
			if err := compRows.Scan(&ci.CompetitorDomain, &ci.ContentThemes); err == nil {
				seoData.CompetitorInsights = append(seoData.CompetitorInsights, ci)
			}
		}
	}

	if len(seoData.Issues) == 0 && len(seoData.CompetitorInsights) == 0 {
		return nil
	}

	return seoData
}

// assembleClientBrief fetches the most recent completed consultation.
func (g *Generator) assembleClientBrief(ctx context.Context, clientID, agencyID uuid.UUID) *ClientBriefData {
	var brief ClientBriefData
	var goals, challenges sql.NullString

	err := g.db.QueryRowContext(ctx,
		`SELECT business_name, industry, primary_goals, primary_challenges, conversion_goal
		 FROM consultations
		 WHERE client_id = $1 AND agency_id = $2 AND status = 'completed'
		 ORDER BY created_at DESC LIMIT 1`,
		clientID, agencyID,
	).Scan(&brief.BusinessName, &brief.Industry, &goals, &challenges, &brief.ConversionGoal)
	if err != nil {
		return nil
	}

	if goals.Valid {
		brief.PrimaryGoals = json.RawMessage(goals.String)
	}
	if challenges.Valid {
		brief.PrimaryChallenges = json.RawMessage(challenges.String)
	}

	return &brief
}

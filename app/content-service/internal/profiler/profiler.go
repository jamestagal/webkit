package profiler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"content-service/internal/embeddings"

	"github.com/google/uuid"
)

// SourceType indicates the data source used to generate a brand profile.
type SourceType string

const (
	SourceScrape        SourceType = "scrape"
	SourceQuestionnaire SourceType = "questionnaire"
	SourceHybrid        SourceType = "hybrid"
	SourceManual        SourceType = "manual"
)

// BrandProfile is the JSONB schema stored in brand_profiles.profile.
type BrandProfile struct {
	PersonalityTraits      []string                `json:"personality_traits"`
	ToneGuidelines         ToneGuidelines          `json:"tone_guidelines"`
	Vocabulary             Vocabulary              `json:"vocabulary"`
	SentenceStructure      SentenceStructure       `json:"sentence_structure"`
	MessagingPillars       []MessagingPillar       `json:"messaging_pillars"`
	Constraints            Constraints             `json:"constraints"`
	CompetitivePositioning CompetitivePositioning  `json:"competitive_positioning"`
}

// ToneGuidelines defines tone for different content contexts.
type ToneGuidelines struct {
	Default      string `json:"default"`
	Promotional  string `json:"promotional"`
	Educational  string `json:"educational"`
}

// Vocabulary describes the brand's word choices.
type Vocabulary struct {
	FormalityLevel   string   `json:"formality_level"`
	IndustryJargon   []string `json:"industry_jargon"`
	AvoidedTerms     []string `json:"avoided_terms"`
	SignaturePhrases []string `json:"signature_phrases"`
}

// SentenceStructure describes writing style preferences.
type SentenceStructure struct {
	AvgLength       string `json:"avg_length"`
	ActivePassive   string `json:"active_passive"`
	UsesContractions bool  `json:"uses_contractions"`
}

// MessagingPillar is a core brand messaging theme with evidence.
type MessagingPillar struct {
	Theme    string `json:"theme"`
	Evidence string `json:"evidence"`
}

// Constraints defines brand voice do/don't rules.
type Constraints struct {
	Always []string `json:"always"`
	Never  []string `json:"never"`
}

// CompetitivePositioning describes how the brand differentiates.
type CompetitivePositioning struct {
	Differentiators []string `json:"differentiators"`
	IndustryNorms   []string `json:"industry_norms"`
	GapsToFill      []string `json:"gaps_to_fill"`
}

// PageSnippet is a lightweight representation of a content page for theme extraction.
type PageSnippet struct {
	ID       uuid.UUID
	URL      string
	PageType string
	Title    string
	BodyText string
}

// Profiler orchestrates brand voice profile generation.
type Profiler struct {
	db           *sql.DB
	anthropicKey string
	embedClient  *embeddings.Client
}

// New creates a new Profiler.
func New(db *sql.DB, anthropicKey string, embedClient *embeddings.Client) *Profiler {
	return &Profiler{
		db:           db,
		anthropicKey: anthropicKey,
		embedClient:  embedClient,
	}
}

// DetectSource determines what data sources are available for a client.
func (p *Profiler) DetectSource(ctx context.Context, clientID, agencyID uuid.UUID) (SourceType, error) {
	var pageCount int
	err := p.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM content_pages WHERE client_id = $1 AND source_type = 'client' AND body_text IS NOT NULL AND body_text != ''",
		clientID,
	).Scan(&pageCount)
	if err != nil {
		return "", fmt.Errorf("profiler: count pages: %w", err)
	}

	var hasConsultation bool
	err = p.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM consultations WHERE client_id = $1 AND agency_id = $2 AND status = 'completed')",
		clientID, agencyID,
	).Scan(&hasConsultation)
	if err != nil {
		return "", fmt.Errorf("profiler: check consultation: %w", err)
	}

	hasPages := pageCount > 0

	switch {
	case hasPages && hasConsultation:
		return SourceHybrid, nil
	case hasPages:
		return SourceScrape, nil
	case hasConsultation:
		return SourceQuestionnaire, nil
	default:
		return "", fmt.Errorf("profiler: no source data available for client %s", clientID)
	}
}

// Generate orchestrates brand profile generation end-to-end.
func (p *Profiler) Generate(ctx context.Context, clientID, agencyID uuid.UUID) (*BrandProfile, error) {
	slog.Info("Starting brand profile generation",
		"client_id", clientID,
		"agency_id", agencyID,
	)

	// 1. Detect source type
	sourceType, err := p.DetectSource(ctx, clientID, agencyID)
	if err != nil {
		return nil, fmt.Errorf("profiler: detect source: %w", err)
	}
	slog.Info("Detected source type", "source_type", sourceType, "client_id", clientID)

	// 2. Gather page content (for scrape and hybrid)
	var pages []PageSnippet
	if sourceType == SourceScrape || sourceType == SourceHybrid {
		pages, err = p.gatherPages(ctx, clientID)
		if err != nil {
			return nil, fmt.Errorf("profiler: gather pages: %w", err)
		}
		slog.Info("Gathered pages", "count", len(pages), "client_id", clientID)
	}

	// 3. Gather questionnaire data (for questionnaire and hybrid)
	var questionnaireCtx *QuestionnaireContext
	if sourceType == SourceQuestionnaire || sourceType == SourceHybrid {
		questionnaireCtx, err = p.GatherQuestionnaireContext(ctx, clientID, agencyID)
		if err != nil {
			slog.Warn("Failed to gather questionnaire context, continuing without",
				"client_id", clientID,
				"error", err,
			)
			// Non-fatal: continue without questionnaire data if we have pages
			if sourceType == SourceQuestionnaire {
				return nil, fmt.Errorf("profiler: gather questionnaire: %w", err)
			}
		}
	}

	// 4. Extract themes from page content
	var themes []ContentTheme
	if len(pages) > 0 {
		themes, err = p.ExtractThemes(ctx, pages)
		if err != nil {
			slog.Warn("Theme extraction failed, continuing without themes",
				"client_id", clientID,
				"error", err,
			)
			// Non-fatal: continue without themes
		}
		slog.Info("Extracted themes", "count", len(themes), "client_id", clientID)
	}

	// 5. Generate voice profile via LLM
	input := VoiceInput{
		Pages:        pages,
		Themes:       themes,
		Questionnaire: questionnaireCtx,
		SourceType:   sourceType,
	}

	profile, err := p.GenerateVoiceProfile(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("profiler: generate voice profile: %w", err)
	}

	// 6. Serialize profile to JSON before entering transaction
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return nil, fmt.Errorf("profiler: marshal profile: %w", err)
	}

	// 7. Collect source page IDs as PostgreSQL UUID array literal
	pageUUIDs := make([]uuid.UUID, 0, len(pages))
	for _, pg := range pages {
		pageUUIDs = append(pageUUIDs, pg.ID)
	}
	sourcePageIDsPG := formatPGUUIDArray(pageUUIDs)

	// 8. Look up questionnaire/consultation IDs for the record
	var consultationID, questionnaireID *uuid.UUID
	if questionnaireCtx != nil {
		if questionnaireCtx.ConsultationID != uuid.Nil {
			cid := questionnaireCtx.ConsultationID
			consultationID = &cid
		}
		if questionnaireCtx.FormSubmissionID != uuid.Nil {
			qid := questionnaireCtx.FormSubmissionID
			questionnaireID = &qid
		}
	}

	// 9. Version management + insert in a transaction to prevent race conditions
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("profiler: begin transaction: %w", err)
	}
	defer tx.Rollback()

	var nextVersion int
	err = tx.QueryRowContext(ctx,
		"SELECT COALESCE(MAX(version), 0) + 1 FROM brand_profiles WHERE client_id = $1",
		clientID,
	).Scan(&nextVersion)
	if err != nil {
		return nil, fmt.Errorf("profiler: get next version: %w", err)
	}

	// Deactivate all previous active profiles
	_, err = tx.ExecContext(ctx,
		"UPDATE brand_profiles SET is_active = false, updated_at = NOW() WHERE client_id = $1 AND is_active = true",
		clientID,
	)
	if err != nil {
		return nil, fmt.Errorf("profiler: deactivate previous profiles: %w", err)
	}

	// 10. INSERT brand_profiles
	profileID := uuid.New()
	now := time.Now()
	_, err = tx.ExecContext(ctx,
		`INSERT INTO brand_profiles (id, client_id, agency_id, version, is_active, profile, source_type, source_page_ids, source_page_count, questionnaire_id, consultation_id, generated_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		profileID, clientID, agencyID, nextVersion, profileJSON, string(sourceType),
		sourcePageIDsPG, len(pages), questionnaireID, consultationID, now, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("profiler: insert brand profile: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("profiler: commit transaction: %w", err)
	}

	slog.Info("Brand profile generated",
		"profile_id", profileID,
		"client_id", clientID,
		"version", nextVersion,
		"source_type", sourceType,
		"page_count", len(pages),
	)

	return profile, nil
}

// gatherPages retrieves the top 10-15 client pages by word count for profile generation.
func (p *Profiler) gatherPages(ctx context.Context, clientID uuid.UUID) ([]PageSnippet, error) {
	rows, err := p.db.QueryContext(ctx,
		`SELECT id, url, page_type, COALESCE(title, ''), COALESCE(body_text, '')
		 FROM content_pages
		 WHERE client_id = $1
		   AND source_type = 'client'
		   AND body_text IS NOT NULL
		   AND body_text != ''
		 ORDER BY word_count DESC
		 LIMIT 15`,
		clientID,
	)
	if err != nil {
		return nil, fmt.Errorf("query pages: %w", err)
	}
	defer rows.Close()

	var pages []PageSnippet
	for rows.Next() {
		var pg PageSnippet
		if err := rows.Scan(&pg.ID, &pg.URL, &pg.PageType, &pg.Title, &pg.BodyText); err != nil {
			return nil, fmt.Errorf("scan page: %w", err)
		}
		pages = append(pages, pg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pages: %w", err)
	}

	return pages, nil
}

// formatPGUUIDArray formats a slice of UUIDs as a PostgreSQL array literal: {uuid1,uuid2,...}
func formatPGUUIDArray(ids []uuid.UUID) string {
	strs := make([]string, len(ids))
	for i, id := range ids {
		strs[i] = id.String()
	}
	return "{" + strings.Join(strs, ",") + "}"
}

package seo

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"app/pkg/dataforseo"

	"github.com/google/uuid"
)

// RunCompetitorAnalysis discovers competitor domains and performs keyword gap
// analysis for each, inserting competitor_analyses rows.
func (e *AuditEngine) RunCompetitorAnalysis(ctx context.Context, auditID, clientID uuid.UUID, domain string, locationCode int, language string) error {
	if e.dfs == nil {
		slog.Info("Skipping competitor analysis — DataForSEO client not configured", "audit_id", auditID)
		return nil
	}

	// Get top 5 competitor domains (we'll use the top 3).
	competitors, err := e.dfs.GetCompetitorDomains(ctx, domain, locationCode, language, 5)
	if err != nil {
		return fmt.Errorf("get competitor domains: %w", err)
	}

	// Use at most 3 competitors.
	limit := 3
	if len(competitors) < limit {
		limit = len(competitors)
	}

	for i := 0; i < limit; i++ {
		comp := competitors[i]

		if err := e.analyzeCompetitor(ctx, auditID, clientID, domain, comp, locationCode, language); err != nil {
			slog.Error("Failed to analyze competitor",
				"audit_id", auditID,
				"competitor", comp.Domain,
				"error", err,
			)
			// Continue with remaining competitors.
			continue
		}
	}

	slog.Info("Competitor analysis complete",
		"audit_id", auditID,
		"competitors_analyzed", limit,
	)

	return nil
}

// analyzeCompetitor performs keyword gap analysis for a single competitor
// and inserts the result into competitor_analyses.
func (e *AuditEngine) analyzeCompetitor(ctx context.Context, auditID, clientID uuid.UUID, domain string, comp dataforseo.CompetitorDomain, locationCode int, language string) error {
	// Get keyword gaps between our domain and the competitor.
	gaps, err := e.dfs.GetKeywordGaps(ctx, domain, comp.Domain, locationCode, language, 50)
	if err != nil {
		slog.Warn("Failed to get keyword gaps",
			"domain", domain,
			"competitor", comp.Domain,
			"error", err,
		)
		gaps = nil
	}

	// Extract metrics from the competitor's full_domain_metrics.
	var (
		domainRank           float64
		totalRankingKeywords int
		estimatedTraffic     float64
		commonKeywords       int
		uniqueKeywords       int
	)

	// Backlink data is not available from the competitor domains endpoint.
	// These would require separate per-competitor backlink API calls.
	// Stored as 0 — can be enriched in a future enhancement.
	totalBacklinks := int64(0)
	referringDomains := 0

	domainRank = comp.AvgPosition
	commonKeywords = comp.Intersections

	// Extract organic metrics if available.
	if metrics, ok := comp.FullDomainMetrics["organic"]; ok && metrics != nil {
		totalRankingKeywords = metrics.Count
		estimatedTraffic = metrics.ETV
	}

	// Count unique keywords from gaps (where competitor ranks but we don't).
	for _, gap := range gaps {
		if gap.FirstDomainSERPElement == nil && gap.SecondDomainSERPElement != nil {
			uniqueKeywords++
		}
	}

	// Marshal the comparison data.
	comparison := buildComparisonJSON(domain, comp, gaps)
	comparisonJSON, err := json.Marshal(comparison)
	if err != nil {
		return fmt.Errorf("marshal comparison: %w", err)
	}

	_, err = e.db.ExecContext(ctx,
		`INSERT INTO competitor_analyses (
			id, client_id, audit_id, competitor_domain,
			domain_rank, total_backlinks, referring_domains,
			total_ranking_keywords, estimated_traffic,
			common_keywords, unique_keywords, comparison, fetched_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
		uuid.New(),
		clientID,
		auditID,
		comp.Domain,
		domainRank,
		totalBacklinks,
		referringDomains,
		totalRankingKeywords,
		estimatedTraffic,
		commonKeywords,
		uniqueKeywords,
		comparisonJSON,
	)
	if err != nil {
		return fmt.Errorf("insert competitor analysis for %s: %w", comp.Domain, err)
	}

	return nil
}

// competitorComparison is the structure stored in the comparison JSONB column.
type competitorComparison struct {
	OurDomain        string                `json:"our_domain"`
	CompetitorDomain string                `json:"competitor_domain"`
	AvgPosition      float64               `json:"avg_position"`
	Intersections    int                   `json:"intersections"`
	KeywordGaps      []keywordGapEntry     `json:"keyword_gaps,omitempty"`
}

// keywordGapEntry is a simplified keyword gap for JSONB storage.
type keywordGapEntry struct {
	Keyword         string `json:"keyword"`
	OurPosition     int    `json:"our_position,omitempty"`
	TheirPosition   int    `json:"their_position,omitempty"`
	SearchVolume    int    `json:"search_volume,omitempty"`
	Intent          string `json:"intent,omitempty"`
}

// buildComparisonJSON constructs the comparison JSONB for a competitor.
func buildComparisonJSON(domain string, comp dataforseo.CompetitorDomain, gaps []dataforseo.KeywordGap) competitorComparison {
	result := competitorComparison{
		OurDomain:        domain,
		CompetitorDomain: comp.Domain,
		AvgPosition:      comp.AvgPosition,
		Intersections:    comp.Intersections,
	}

	for _, gap := range gaps {
		entry := keywordGapEntry{}
		if gap.KeywordData != nil {
			entry.Keyword = gap.KeywordData.Keyword
			if gap.KeywordData.KeywordInfo.SearchVolume != nil {
				entry.SearchVolume = *gap.KeywordData.KeywordInfo.SearchVolume
			}
			if gap.KeywordData.SearchIntentInfo != nil {
				entry.Intent = gap.KeywordData.SearchIntentInfo.MainIntent
			}
		}
		if gap.FirstDomainSERPElement != nil {
			entry.OurPosition = gap.FirstDomainSERPElement.RankGroup
		}
		if gap.SecondDomainSERPElement != nil {
			entry.TheirPosition = gap.SecondDomainSERPElement.RankGroup
		}
		result.KeywordGaps = append(result.KeywordGaps, entry)
	}

	return result
}

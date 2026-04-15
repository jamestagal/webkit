package seo

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
)

// rankingKeywordEntry is a simplified keyword entry for JSONB storage.
type rankingKeywordEntry struct {
	Keyword      string  `json:"keyword"`
	Position     int     `json:"position"`
	SearchVolume int     `json:"search_volume"`
	ETV          float64 `json:"etv"`
	URL          string  `json:"url"`
	Intent       string  `json:"intent,omitempty"`
}

// RunKeywordAnalysis fetches domain ranking keywords from DataForSEO Labs
// and inserts a keyword_profiles row for the audit.
func (e *AuditEngine) RunKeywordAnalysis(ctx context.Context, auditID, clientID uuid.UUID, domain string, locationCode int, language string) error {
	if e.dfs == nil {
		slog.Info("Skipping keyword analysis — DataForSEO client not configured", "audit_id", auditID)
		return nil
	}

	keywords, totalCount, err := e.dfs.GetDomainRankingKeywords(ctx, domain, locationCode, language, 100, 0)
	if err != nil {
		return fmt.Errorf("get domain ranking keywords: %w", err)
	}

	// If DataForSEO has no keyword data for this domain, skip inserting a profile.
	// This lets the scoring system recognize the data is unavailable (not zero).
	if totalCount == 0 && len(keywords) == 0 {
		slog.Info("Keyword analysis complete — no data available for domain",
			"audit_id", auditID,
			"domain", domain,
		)
		return nil
	}

	// Count distribution by position buckets and sum traffic.
	var (
		top3Count  int
		top10Count int
		top50Count int
		totalETV   float64
	)

	entries := make([]rankingKeywordEntry, 0, len(keywords))

	for _, kw := range keywords {
		if kw.RankedSERPElement == nil {
			continue
		}

		rank := kw.RankedSERPElement.SERPItem.RankGroup
		etv := kw.RankedSERPElement.SERPItem.ETV
		totalETV += etv

		if rank <= 3 {
			top3Count++
		}
		if rank <= 10 {
			top10Count++
		}
		if rank <= 50 {
			top50Count++
		}

		// Build the keyword entry for JSONB.
		entry := rankingKeywordEntry{
			Keyword:  kw.Keyword,
			Position: rank,
			ETV:      etv,
			URL:      kw.RankedSERPElement.SERPItem.URL,
		}
		if kw.KeywordInfo.SearchVolume != nil {
			entry.SearchVolume = *kw.KeywordInfo.SearchVolume
		}
		if kw.SearchIntentInfo != nil {
			entry.Intent = kw.SearchIntentInfo.MainIntent
		}
		entries = append(entries, entry)
	}

	// Marshal ranking_keywords as JSONB.
	rankingJSON, err := json.Marshal(entries)
	if err != nil {
		return fmt.Errorf("marshal ranking keywords: %w", err)
	}

	_, err = e.db.ExecContext(ctx,
		`INSERT INTO keyword_profiles (
			id, client_id, audit_id, ranking_keywords,
			total_ranking_keywords, keywords_top_3, keywords_top_10, keywords_top_50,
			estimated_traffic, fetched_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
		uuid.New(),
		clientID,
		auditID,
		rankingJSON,
		totalCount,
		top3Count,
		top10Count,
		top50Count,
		totalETV,
	)
	if err != nil {
		return fmt.Errorf("insert keyword profile: %w", err)
	}

	slog.Info("Keyword analysis complete",
		"audit_id", auditID,
		"total_keywords", totalCount,
		"top_3", top3Count,
		"top_10", top10Count,
		"top_50", top50Count,
		"estimated_traffic", totalETV,
	)

	return nil
}

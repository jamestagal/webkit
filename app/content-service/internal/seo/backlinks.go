package seo

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"app/pkg/dataforseo"

	"github.com/google/uuid"
)

// referringDomainEntry is a simplified entry for JSONB storage.
type referringDomainEntry struct {
	Domain    string `json:"domain"`
	Rank      int    `json:"rank"`
	Backlinks int64  `json:"backlinks"`
	SpamScore int    `json:"spam_score"`
}

// anchorEntry is a simplified entry for JSONB storage.
type anchorEntry struct {
	Anchor    string `json:"anchor"`
	Backlinks int64  `json:"backlinks"`
	Domains   int    `json:"referring_domains"`
}

// RunBacklinkAnalysis fetches backlink data from DataForSEO and inserts
// a backlink_profiles row for the audit.
func (e *AuditEngine) RunBacklinkAnalysis(ctx context.Context, auditID, clientID uuid.UUID, domain string) error {
	if e.dfs == nil {
		slog.Info("Skipping backlink analysis — DataForSEO client not configured", "audit_id", auditID)
		return nil
	}

	// Get backlinks summary.
	summary, err := e.dfs.GetBacklinksSummary(ctx, domain)
	if err != nil {
		return fmt.Errorf("get backlinks summary: %w", err)
	}

	// Get top 50 referring domains.
	refDomains, err := e.dfs.GetReferringDomains(ctx, domain, 50, 0)
	if err != nil {
		slog.Warn("Failed to get referring domains", "domain", domain, "error", err)
		refDomains = nil
	}

	// Get top 50 anchors.
	anchors, err := e.dfs.GetAnchors(ctx, domain, 50, 0)
	if err != nil {
		slog.Warn("Failed to get anchors", "domain", domain, "error", err)
		anchors = nil
	}

	// Build JSONB for top_referring_domains.
	topDomains := buildReferringDomainsJSON(refDomains)
	topDomainsJSON, err := json.Marshal(topDomains)
	if err != nil {
		return fmt.Errorf("marshal referring domains: %w", err)
	}

	// Build JSONB for anchor_text_distribution.
	anchorDist := buildAnchorsJSON(anchors)
	anchorDistJSON, err := json.Marshal(anchorDist)
	if err != nil {
		return fmt.Errorf("marshal anchors: %w", err)
	}

	// Build link_type_distribution from summary.
	linkTypeDist := buildLinkTypeJSON(summary)
	linkTypeJSON, err := json.Marshal(linkTypeDist)
	if err != nil {
		return fmt.Errorf("marshal link types: %w", err)
	}

	// Calculate dofollow vs nofollow.
	totalBacklinks := summary.Backlinks
	nofollowDomains := summary.ReferringDomainsNofollow
	dofollowDomains := summary.ReferringDomains - nofollowDomains

	// Calculate spam score (normalize from 0-100).
	var spamScore float64
	if summary.Info != nil {
		spamScore = float64(summary.Info.SpamScore)
	}

	_, err = e.db.ExecContext(ctx,
		`INSERT INTO backlink_profiles (
			id, client_id, audit_id, total_backlinks, referring_domains,
			dofollow_links, nofollow_links, domain_rank, spam_score,
			top_referring_domains, anchor_text_distribution, link_type_distribution,
			fetched_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
		uuid.New(),
		clientID,
		auditID,
		totalBacklinks,
		summary.ReferringDomains,
		dofollowDomains,
		nofollowDomains,
		float64(summary.Rank),
		spamScore,
		topDomainsJSON,
		anchorDistJSON,
		linkTypeJSON,
	)
	if err != nil {
		return fmt.Errorf("insert backlink profile: %w", err)
	}

	slog.Info("Backlink analysis complete",
		"audit_id", auditID,
		"total_backlinks", totalBacklinks,
		"referring_domains", summary.ReferringDomains,
	)

	return nil
}

// buildReferringDomainsJSON transforms DataForSEO referring domains into JSONB entries.
func buildReferringDomainsJSON(domains []dataforseo.ReferringDomain) []referringDomainEntry {
	entries := make([]referringDomainEntry, 0, len(domains))
	for _, d := range domains {
		entries = append(entries, referringDomainEntry{
			Domain:    d.Domain,
			Rank:      d.Rank,
			Backlinks: d.Backlinks,
			SpamScore: d.BacklinksSpamScore,
		})
	}
	return entries
}

// buildAnchorsJSON transforms DataForSEO anchors into JSONB entries.
func buildAnchorsJSON(anchors []dataforseo.AnchorText) []anchorEntry {
	entries := make([]anchorEntry, 0, len(anchors))
	for _, a := range anchors {
		entries = append(entries, anchorEntry{
			Anchor:    a.Anchor,
			Backlinks: a.Backlinks,
			Domains:   a.ReferringDomains,
		})
	}
	return entries
}

// buildLinkTypeJSON builds the link type distribution from the backlinks summary.
func buildLinkTypeJSON(summary *dataforseo.BacklinksSummary) map[string]int {
	if summary.ReferringLinksTypes == nil {
		return map[string]int{}
	}
	return summary.ReferringLinksTypes
}

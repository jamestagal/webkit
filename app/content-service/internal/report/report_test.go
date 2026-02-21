package report

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func intPtr(v int) *int { return &v }

func makeFullAuditData() auditData {
	return auditData{
		BusinessName:   "Acme Corp",
		WebsiteURL:     "https://acme.com",
		AuditDate:      time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC),
		TotalPages:     42,
		OverallScore:   intPtr(72),
		TechnicalScore: intPtr(85),
		ContentScore:   intPtr(60),
		BacklinkScore:  intPtr(45),
		KeywordScore:   intPtr(78),
		CriticalIssues: 3,
		WarningIssues:  7,
		PassedChecks:   25,
		Opportunities:  12,
		Issues: []issueData{
			{Title: "Missing meta descriptions", Category: "content", Severity: "critical", Description: "15 pages lack meta descriptions"},
			{Title: "Slow page load", Category: "technical", Severity: "warning", Description: "Average load time is 4.2s"},
		},
		Backlinks: &backlinkData{
			TotalBacklinks:   1500,
			ReferringDomains: 120,
			DofollowLinks:    1200,
			NofollowLinks:    300,
			DomainRank:       35.5,
			SpamScore:        8.2,
		},
		Keywords: &keywordData{
			TotalRankingKeywords: 450,
			KeywordsTop3:         12,
			KeywordsTop10:        45,
			KeywordsTop50:        180,
			TotalKeywordGaps:     35,
			EstimatedTraffic:     2500.0,
		},
		Competitors: []competitorData{
			{Domain: "competitor1.com", DomainRank: 55.0, TotalBacklinks: 5000, ReferringDomains: 350, RankingKeywords: 800, EstimatedTraffic: 12000},
			{Domain: "competitor2.com", DomainRank: 42.0, TotalBacklinks: 2500, ReferringDomains: 180, RankingKeywords: 400, EstimatedTraffic: 5000},
		},
	}
}

// ---------------------------------------------------------------------------
// RenderHTML
// ---------------------------------------------------------------------------

func TestRenderHTML_HasDoctype(t *testing.T) {
	d := makeFullAuditData()
	output := RenderHTML(d)
	assert.True(t, strings.HasPrefix(output, "<!DOCTYPE html>"), "should start with DOCTYPE")
}

func TestRenderHTML_ContainsScores(t *testing.T) {
	d := makeFullAuditData()
	output := RenderHTML(d)

	// Overall score value.
	assert.Contains(t, output, fmt.Sprintf("%d", *d.OverallScore))
	// Category scores are rendered via renderScoreBar with "/100" format.
	assert.Contains(t, output, fmt.Sprintf("%d/100", *d.TechnicalScore))
	assert.Contains(t, output, fmt.Sprintf("%d/100", *d.ContentScore))
	assert.Contains(t, output, fmt.Sprintf("%d/100", *d.BacklinkScore))
	assert.Contains(t, output, fmt.Sprintf("%d/100", *d.KeywordScore))
}

func TestRenderHTML_ContainsIssues(t *testing.T) {
	d := makeFullAuditData()
	output := RenderHTML(d)

	for _, issue := range d.Issues {
		assert.Contains(t, output, issue.Title)
		assert.Contains(t, output, issue.Description)
		assert.Contains(t, output, issue.Category)
	}
}

func TestRenderHTML_HandlesNilScores(t *testing.T) {
	d := auditData{
		BusinessName:   "Test Biz",
		WebsiteURL:     "https://test.com",
		AuditDate:      time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		TotalPages:     10,
		OverallScore:   nil,
		TechnicalScore: nil,
		ContentScore:   nil,
		BacklinkScore:  nil,
		KeywordScore:   nil,
	}

	// Should not panic.
	output := RenderHTML(d)
	assert.Contains(t, output, "<!DOCTYPE html>")
	// Nil overall score renders as "--".
	assert.Contains(t, output, "--")
	// Nil category scores render as "N/A" (from renderScoreBar).
	assert.Contains(t, output, "N/A")
}

func TestRenderHTML_ContainsCompetitors(t *testing.T) {
	d := makeFullAuditData()
	output := RenderHTML(d)

	assert.Contains(t, output, "Competitor Comparison")
	for _, c := range d.Competitors {
		assert.Contains(t, output, c.Domain)
	}
}

func TestRenderHTML_ContainsRecommendations(t *testing.T) {
	d := makeFullAuditData()
	output := RenderHTML(d)

	assert.Contains(t, output, "Recommendations")
	// Critical issues appear under "Priority Actions".
	assert.Contains(t, output, "Priority Actions")
	assert.Contains(t, output, "Missing meta descriptions")
	// Warning issues appear under "Improvement Opportunities".
	assert.Contains(t, output, "Improvement Opportunities")
	assert.Contains(t, output, "Slow page load")
}

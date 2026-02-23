package report

import (
	"fmt"
	"html"
	"strings"
	"time"
)

// auditData holds all data needed to render the audit PDF template.
type auditData struct {
	// Client info
	BusinessName string
	WebsiteURL   string

	// Audit metadata
	AuditDate  time.Time
	TotalPages int

	// Scores (0-100, nil if unavailable)
	OverallScore   *int
	TechnicalScore *int
	ContentScore   *int
	BacklinkScore  *int
	KeywordScore   *int

	// Issue counts
	CriticalIssues int
	WarningIssues  int
	PassedChecks   int
	Opportunities  int

	// Top issues (up to 20)
	Issues []issueData

	// Backlink profile (nil if unavailable)
	Backlinks *backlinkData

	// Keyword profile (nil if unavailable)
	Keywords *keywordData

	// Competitors (nil/empty if unavailable)
	Competitors []competitorData

	// Performance data from Google PageSpeed Insights (nil if unavailable)
	Performance *performanceData
}

type issueData struct {
	Title       string
	Category    string
	Severity    string
	Description string
}

type backlinkData struct {
	TotalBacklinks   int64
	ReferringDomains int
	DofollowLinks    int
	NofollowLinks    int
	DomainRank       float64
	SpamScore        float64
}

type keywordData struct {
	TotalRankingKeywords int
	KeywordsTop3         int
	KeywordsTop10        int
	KeywordsTop50        int
	TotalKeywordGaps     int
	EstimatedTraffic     float64
}

type competitorData struct {
	Domain           string
	DomainRank       float64
	TotalBacklinks   int64
	ReferringDomains int
	RankingKeywords  int
	EstimatedTraffic float64
}

type performanceData struct {
	PerformanceScore int
	Accessibility    int
	BestPractices    int
	SEOScore         int
	LoadTime         string
	Metrics          []webVitalMetric
	Recommendations  []string
}

type webVitalMetric struct {
	Name     string // "LCP", "CLS", etc.
	Value    string // "1.2s", "0.01"
	Category string // "good", "needs-improvement", "poor"
}

// scoreColor returns a CSS color based on traffic-light scoring.
func scoreColor(score int) string {
	if score >= 70 {
		return "#22c55e" // green
	}
	if score >= 40 {
		return "#f59e0b" // amber
	}
	return "#ef4444" // red
}

// scoreBgColor returns a lighter background variant for score bars.
func scoreBgColor(score int) string {
	if score >= 70 {
		return "#dcfce7"
	}
	if score >= 40 {
		return "#fef3c7"
	}
	return "#fee2e2"
}

// severityColor returns a badge color for issue severity.
func severityColor(severity string) string {
	switch severity {
	case "critical":
		return "#ef4444"
	case "warning":
		return "#f59e0b"
	default:
		return "#6b7280"
	}
}

// severityBgColor returns a badge background for issue severity.
func severityBgColor(severity string) string {
	switch severity {
	case "critical":
		return "#fee2e2"
	case "warning":
		return "#fef3c7"
	default:
		return "#f3f4f6"
	}
}

// renderScoreBar renders a single category score bar.
func renderScoreBar(label string, score *int) string {
	if score == nil {
		return fmt.Sprintf(`
		<div style="margin-bottom:12px;">
			<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
				<span style="font-weight:600;color:#374151;">%s</span>
				<span style="font-weight:600;color:#9ca3af;">N/A</span>
			</div>
			<div style="background:#f3f4f6;border-radius:8px;height:12px;overflow:hidden;">
				<div style="width:0%%;height:100%%;border-radius:8px;"></div>
			</div>
		</div>`, html.EscapeString(label))
	}
	s := *score
	color := scoreColor(s)
	return fmt.Sprintf(`
		<div style="margin-bottom:12px;">
			<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
				<span style="font-weight:600;color:#374151;">%s</span>
				<span style="font-weight:700;color:%s;">%d/100</span>
			</div>
			<div style="background:%s;border-radius:8px;height:12px;overflow:hidden;">
				<div style="width:%d%%;height:100%%;background:%s;border-radius:8px;"></div>
			</div>
		</div>`, html.EscapeString(label), color, s, scoreBgColor(s), s, color)
}

// RenderHTML produces the full HTML document for the audit PDF.
func RenderHTML(d auditData) string {
	var b strings.Builder

	// Overall score display
	overallScoreStr := "--"
	overallColor := "#9ca3af"
	if d.OverallScore != nil {
		overallScoreStr = fmt.Sprintf("%d", *d.OverallScore)
		overallColor = scoreColor(*d.OverallScore)
	}

	// Start HTML document
	b.WriteString(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
	@page {
		size: A4;
		margin: 20mm 15mm;
	}
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
		color: #1f2937;
		background: #ffffff;
		font-size: 13px;
		line-height: 1.5;
	}
	.page-break { page-break-before: always; }
	h1 { font-size: 28px; font-weight: 700; color: #2563eb; margin-bottom: 4px; }
	h2 { font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 16px; border-bottom: 2px solid #dbeafe; padding-bottom: 8px; }
	h3 { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 8px; }
	table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
	th { background: #f8fafc; color: #374151; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
	td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
	tr:nth-child(even) td { background: #f9fafb; }
	.section { margin-bottom: 32px; page-break-inside: avoid; }
</style>
</head>
<body>
`)

	// --- Cover + Overall score (combined to save vertical space) ---
	b.WriteString(fmt.Sprintf(`
<div style="text-align:center;padding:24px 0 16px;">
	<h1>SEO Audit Report</h1>
	<p style="font-size:18px;color:#6b7280;margin-top:4px;">%s</p>
	<p style="font-size:14px;color:#9ca3af;">%s &middot; %s</p>
	<div style="margin-top:20px;">
		<div style="display:inline-block;width:110px;height:110px;border-radius:50%%;border:5px solid %s;line-height:100px;text-align:center;">
			<span style="font-size:42px;font-weight:800;color:%s;">%s</span>
		</div>
		<p style="margin-top:6px;font-size:13px;font-weight:600;color:#6b7280;">Overall Score</p>
	</div>
</div>
`,
		html.EscapeString(d.BusinessName),
		html.EscapeString(d.WebsiteURL),
		d.AuditDate.Format("2 January 2006"),
		overallColor, overallColor, overallScoreStr,
	))

	// --- Score breakdown ---
	b.WriteString(`<div class="section">`)
	b.WriteString(`<h2>Score Breakdown</h2>`)
	b.WriteString(renderScoreBar("Technical", d.TechnicalScore))
	b.WriteString(renderScoreBar("Content", d.ContentScore))
	b.WriteString(renderScoreBar("Backlinks", d.BacklinkScore))
	b.WriteString(renderScoreBar("Keywords", d.KeywordScore))
	b.WriteString(`</div>`)

	// --- Website Performance (Google PageSpeed Insights) ---
	if d.Performance != nil {
		perf := d.Performance
		b.WriteString(`<div style="margin-bottom:32px;">`)
		b.WriteString(`<h2>Website Performance</h2>`)
		b.WriteString(`<p style="font-size:12px;color:#6b7280;margin-bottom:16px;">Powered by Google PageSpeed Insights (Mobile)</p>`)

		// 4 Lighthouse score cards
		b.WriteString(`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">`)
		lighthouseScores := []struct {
			Label string
			Score int
		}{
			{"Performance", perf.PerformanceScore},
			{"Accessibility", perf.Accessibility},
			{"Best Practices", perf.BestPractices},
			{"SEO", perf.SEOScore},
		}
		for _, ls := range lighthouseScores {
			color := scoreColor(ls.Score)
			bgColor := scoreBgColor(ls.Score)
			b.WriteString(fmt.Sprintf(`
			<div style="flex:1;min-width:90px;background:%s;border-radius:8px;padding:12px 8px;text-align:center;border:2px solid %s;">
				<div style="font-size:28px;font-weight:800;color:%s;">%d</div>
				<div style="font-size:10px;color:#374151;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">%s</div>
			</div>`, bgColor, color, color, ls.Score, ls.Label))
		}
		b.WriteString(`</div>`)

		// Core Web Vitals
		if len(perf.Metrics) > 0 {
			b.WriteString(`<h3>Core Web Vitals</h3>`)
			b.WriteString(`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">`)
			for _, m := range perf.Metrics {
				badgeColor := "#22c55e"
				badgeBg := "#dcfce7"
				badgeLabel := "Good"
				if m.Category == "needs-improvement" {
					badgeColor = "#f59e0b"
					badgeBg = "#fef3c7"
					badgeLabel = "Needs Work"
				} else if m.Category == "poor" {
					badgeColor = "#ef4444"
					badgeBg = "#fee2e2"
					badgeLabel = "Poor"
				}
				b.WriteString(fmt.Sprintf(`
				<div style="flex:1;min-width:80px;background:#f9fafb;border-radius:8px;padding:10px;text-align:center;border:1px solid #e5e7eb;">
					<div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">%s</div>
					<div style="font-size:20px;font-weight:700;color:#1f2937;margin:4px 0;">%s</div>
					<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;color:%s;background:%s;">%s</span>
				</div>`,
					html.EscapeString(m.Name),
					html.EscapeString(m.Value),
					badgeColor, badgeBg, badgeLabel))
			}
			b.WriteString(`</div>`)
		}

		// PageSpeed Recommendations
		if len(perf.Recommendations) > 0 {
			b.WriteString(`<h3 style="margin-top:12px;">PageSpeed Recommendations</h3>`)
			b.WriteString(`<ol style="margin-left:20px;">`)
			for _, rec := range perf.Recommendations {
				b.WriteString(fmt.Sprintf(`<li style="margin-bottom:4px;font-size:12px;color:#4b5563;">%s</li>`, html.EscapeString(rec)))
			}
			b.WriteString(`</ol>`)
		}

		b.WriteString(`</div>`)
	}

	// --- Quick stats ---
	b.WriteString(`
<div class="section">
	<h2>Quick Stats</h2>
	<div style="display:flex;gap:12px;flex-wrap:wrap;">
`)
	quickStats := []struct {
		Label string
		Value string
		Color string
	}{
		{"Total Pages", fmt.Sprintf("%d", d.TotalPages), "#2563eb"},
		{"Critical Issues", fmt.Sprintf("%d", d.CriticalIssues), "#ef4444"},
		{"Warnings", fmt.Sprintf("%d", d.WarningIssues), "#f59e0b"},
		{"Passed Checks", fmt.Sprintf("%d", d.PassedChecks), "#22c55e"},
		{"Opportunities", fmt.Sprintf("%d", d.Opportunities), "#8b5cf6"},
	}
	for _, s := range quickStats {
		b.WriteString(fmt.Sprintf(`
		<div style="flex:1;min-width:100px;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;border:1px solid #e5e7eb;">
			<div style="font-size:28px;font-weight:800;color:%s;">%s</div>
			<div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;">%s</div>
		</div>`, s.Color, s.Value, s.Label))
	}
	b.WriteString(`
	</div>
</div>
`)

	// --- Top Issues ---
	if len(d.Issues) > 0 {
		b.WriteString(`<div class="page-break"></div>`)
		b.WriteString(`<div class="section">`)
		b.WriteString(`<h2>Top Issues</h2>`)
		b.WriteString(`<table>
			<thead><tr>
				<th style="width:30%;">Issue</th>
				<th style="width:15%;">Category</th>
				<th style="width:12%;">Severity</th>
				<th style="width:43%;">Description</th>
			</tr></thead><tbody>`)
		for _, issue := range d.Issues {
			b.WriteString(fmt.Sprintf(`<tr>
				<td style="font-weight:600;">%s</td>
				<td>%s</td>
				<td><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:%s;background:%s;text-transform:uppercase;">%s</span></td>
				<td style="font-size:12px;color:#4b5563;">%s</td>
			</tr>`,
				html.EscapeString(issue.Title),
				html.EscapeString(issue.Category),
				severityColor(issue.Severity),
				severityBgColor(issue.Severity),
				html.EscapeString(issue.Severity),
				html.EscapeString(issue.Description),
			))
		}
		b.WriteString(`</tbody></table></div>`)
	}

	// --- Backlink Overview ---
	if d.Backlinks != nil {
		bl := d.Backlinks
		b.WriteString(`<div class="section">`)
		b.WriteString(`<h2>Backlink Overview</h2>`)
		b.WriteString(`<div style="display:flex;gap:12px;flex-wrap:wrap;">`)

		blStats := []struct {
			Label string
			Value string
		}{
			{"Total Backlinks", fmt.Sprintf("%d", bl.TotalBacklinks)},
			{"Referring Domains", fmt.Sprintf("%d", bl.ReferringDomains)},
			{"Dofollow", fmt.Sprintf("%d", bl.DofollowLinks)},
			{"Nofollow", fmt.Sprintf("%d", bl.NofollowLinks)},
			{"Domain Rank", fmt.Sprintf("%.1f", bl.DomainRank)},
			{"Spam Score", fmt.Sprintf("%.1f", bl.SpamScore)},
		}
		for _, s := range blStats {
			b.WriteString(fmt.Sprintf(`
			<div style="flex:1;min-width:100px;background:#f0f9ff;border-radius:8px;padding:14px;text-align:center;border:1px solid #bae6fd;">
				<div style="font-size:22px;font-weight:700;color:#0369a1;">%s</div>
				<div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;">%s</div>
			</div>`, s.Value, s.Label))
		}
		b.WriteString(`</div></div>`)
	}

	// --- Keyword Analysis ---
	if d.Keywords != nil {
		kw := d.Keywords
		b.WriteString(`<div class="section">`)
		b.WriteString(`<h2>Keyword Analysis</h2>`)
		b.WriteString(`<div style="display:flex;gap:12px;flex-wrap:wrap;">`)

		kwStats := []struct {
			Label string
			Value string
		}{
			{"Ranking Keywords", fmt.Sprintf("%d", kw.TotalRankingKeywords)},
			{"Top 3", fmt.Sprintf("%d", kw.KeywordsTop3)},
			{"Top 10", fmt.Sprintf("%d", kw.KeywordsTop10)},
			{"Top 50", fmt.Sprintf("%d", kw.KeywordsTop50)},
			{"Est. Traffic", fmt.Sprintf("%.0f", kw.EstimatedTraffic)},
			{"Keyword Gaps", fmt.Sprintf("%d", kw.TotalKeywordGaps)},
		}
		for _, s := range kwStats {
			b.WriteString(fmt.Sprintf(`
			<div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:14px;text-align:center;border:1px solid #bbf7d0;">
				<div style="font-size:22px;font-weight:700;color:#15803d;">%s</div>
				<div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-top:4px;">%s</div>
			</div>`, s.Value, s.Label))
		}
		b.WriteString(`</div></div>`)
	}

	// --- Competitor Comparison ---
	if len(d.Competitors) > 0 {
		b.WriteString(`<div class="page-break"></div>`)
		b.WriteString(`<div class="section">`)
		b.WriteString(`<h2>Competitor Comparison</h2>`)
		b.WriteString(`<table>
			<thead><tr>
				<th>Domain</th>
				<th>Rank</th>
				<th>Backlinks</th>
				<th>Ref. Domains</th>
				<th>Keywords</th>
				<th>Est. Traffic</th>
			</tr></thead><tbody>`)

		// Show client's own data first if we have it.
		if d.Backlinks != nil || d.Keywords != nil {
			blTotal := int64(0)
			blDomains := 0
			blRank := 0.0
			kwTotal := 0
			kwTraffic := 0.0
			if d.Backlinks != nil {
				blTotal = d.Backlinks.TotalBacklinks
				blDomains = d.Backlinks.ReferringDomains
				blRank = d.Backlinks.DomainRank
			}
			if d.Keywords != nil {
				kwTotal = d.Keywords.TotalRankingKeywords
				kwTraffic = d.Keywords.EstimatedTraffic
			}
			b.WriteString(fmt.Sprintf(`<tr style="background:#eff6ff;">
				<td style="font-weight:700;color:#2563eb;">%s (You)</td>
				<td>%.1f</td>
				<td>%d</td>
				<td>%d</td>
				<td>%d</td>
				<td>%.0f</td>
			</tr>`,
				html.EscapeString(d.WebsiteURL), blRank, blTotal, blDomains, kwTotal, kwTraffic))
		}

		for _, c := range d.Competitors {
			b.WriteString(fmt.Sprintf(`<tr>
				<td style="font-weight:600;">%s</td>
				<td>%.1f</td>
				<td>%d</td>
				<td>%d</td>
				<td>%d</td>
				<td>%.0f</td>
			</tr>`,
				html.EscapeString(c.Domain), c.DomainRank, c.TotalBacklinks,
				c.ReferringDomains, c.RankingKeywords, c.EstimatedTraffic))
		}
		b.WriteString(`</tbody></table></div>`)
	}

	// --- Recommendations ---
	criticalIssues := make([]issueData, 0)
	warningIssues := make([]issueData, 0)
	for _, issue := range d.Issues {
		switch issue.Severity {
		case "critical":
			criticalIssues = append(criticalIssues, issue)
		case "warning":
			warningIssues = append(warningIssues, issue)
		}
	}

	if len(criticalIssues) > 0 || len(warningIssues) > 0 {
		b.WriteString(`<div class="section">`)
		b.WriteString(`<h2>Recommendations</h2>`)

		if len(criticalIssues) > 0 {
			b.WriteString(`<h3 style="color:#ef4444;margin-bottom:12px;">Priority Actions (Critical)</h3>`)
			b.WriteString(`<ol style="margin-left:20px;margin-bottom:20px;">`)
			for _, issue := range criticalIssues {
				b.WriteString(fmt.Sprintf(`<li style="margin-bottom:8px;"><strong>%s</strong> <span style="color:#6b7280;">(%s)</span><br><span style="font-size:12px;color:#4b5563;">%s</span></li>`,
					html.EscapeString(issue.Title),
					html.EscapeString(issue.Category),
					html.EscapeString(issue.Description),
				))
			}
			b.WriteString(`</ol>`)
		}

		if len(warningIssues) > 0 {
			b.WriteString(`<h3 style="color:#f59e0b;margin-bottom:12px;">Improvement Opportunities (Warnings)</h3>`)
			b.WriteString(`<ol style="margin-left:20px;margin-bottom:20px;">`)
			for _, issue := range warningIssues {
				b.WriteString(fmt.Sprintf(`<li style="margin-bottom:8px;"><strong>%s</strong> <span style="color:#6b7280;">(%s)</span><br><span style="font-size:12px;color:#4b5563;">%s</span></li>`,
					html.EscapeString(issue.Title),
					html.EscapeString(issue.Category),
					html.EscapeString(issue.Description),
				))
			}
			b.WriteString(`</ol>`)
		}

		b.WriteString(`</div>`)
	}

	// --- Footer ---
	b.WriteString(fmt.Sprintf(`
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px;">
	<p>Generated by Webkit &middot; %s</p>
</div>
`, time.Now().Format("2 January 2006 15:04 MST")))

	b.WriteString(`</body></html>`)
	return b.String()
}

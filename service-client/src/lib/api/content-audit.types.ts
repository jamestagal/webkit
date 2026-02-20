/**
 * SEO Audit Types
 * Matches Go content-service audit handler JSON responses.
 */

export type AuditResponse = {
	id: string;
	agency_id: string;
	client_id: string;
	crawl_job_id: string;
	status: string;
	overall_score: number | null;
	technical_score: number | null;
	content_score: number | null;
	backlink_score: number | null;
	keyword_score: number | null;
	total_pages: number;
	critical_issues: number;
	warning_issues: number;
	passed_checks: number;
	opportunities: number;
	started_at?: string | null;
	completed_at?: string | null;
	created_at: string;
	updated_at: string;
};

export type IssueResponse = {
	id: string;
	audit_id: string;
	page_id?: string | null;
	client_id: string;
	category: string;
	severity: string;
	check_name: string;
	title: string;
	description: string;
	current_value?: string | null;
	recommended_value?: string | null;
	impact?: string | null;
	ai_fix_available: boolean;
	created_at: string;
};

export type PaginatedIssuesResponse = {
	items: IssueResponse[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
};

export type BacklinkProfileResponse = {
	id: string;
	client_id: string;
	audit_id: string;
	total_backlinks: number;
	referring_domains: number;
	dofollow_links: number;
	nofollow_links: number;
	domain_rank: number;
	spam_score: number;
	top_referring_domains: unknown[];
	anchor_text_distribution: unknown[];
	link_type_distribution: Record<string, unknown>;
	fetched_at: string;
	created_at: string;
};

export type KeywordProfileResponse = {
	id: string;
	client_id: string;
	audit_id: string;
	ranking_keywords: unknown[];
	total_ranking_keywords: number;
	keywords_top_3: number;
	keywords_top_10: number;
	keywords_top_50: number;
	total_keyword_gaps: number;
	estimated_traffic: number;
	fetched_at: string;
	created_at: string;
};

export type CompetitorAnalysisResponse = {
	id: string;
	client_id: string;
	audit_id: string;
	competitor_domain: string;
	domain_rank: number;
	total_backlinks: number;
	referring_domains: number;
	total_ranking_keywords: number;
	estimated_traffic: number;
	common_keywords: number;
	unique_keywords: number;
	comparison: Record<string, unknown>;
	fetched_at: string;
	created_at: string;
};

/** Issue categories for filtering */
export const ISSUE_CATEGORIES = [
	"technical",
	"content",
	"meta",
	"structure",
	"performance",
	"mobile",
	"accessibility",
	"backlinks",
	"keywords",
	"schema",
	"internal_links",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** Issue severities for filtering */
export const ISSUE_SEVERITIES = ["critical", "warning", "info", "opportunity"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

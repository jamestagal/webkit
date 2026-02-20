/**
 * Copy Generation & Management Types
 * Matches Go content-service copy/generate handler JSON responses.
 */

export type CopyResponse = {
	id: string;
	client_id: string;
	agency_id: string;
	page_id?: string | null;
	generated_by: string;
	copy_type: string;
	title: string;
	content: string;
	target_keyword?: string | null;
	target_word_count?: number | null;
	actual_word_count: number;
	seo_score?: number | null;
	readability_score?: number | null;
	status: string;
	prompt_tokens: number;
	completion_tokens: number;
	model_used?: string | null;
	created_at: string;
	updated_at: string;
};

export type CopyResult = {
	copy_id: string;
	content: string;
	title: string;
	actual_word_count: number;
	prompt_tokens: number;
	completion_tokens: number;
	model_used: string;
};

export type MetaResult = {
	meta_title: string;
	meta_description: string;
	title_copy_id: string;
	desc_copy_id: string;
	prompt_tokens: number;
	completion_tokens: number;
	model_used: string;
};

/** Valid copy type values */
export const COPY_TYPES = [
	"page_rewrite",
	"new_page",
	"meta_title",
	"meta_description",
	"h1_suggestion",
	"section",
	"blog_post",
	"product_description",
	"cta",
	"site_structure",
] as const;
export type CopyType = (typeof COPY_TYPES)[number];

/** Copy status values */
export const COPY_STATUSES = ["draft", "final"] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

/**
 * Content Intelligence Types
 *
 * Types matching the Go content-service API response shapes.
 * Field names use snake_case to match Go JSON tags.
 */

/** Valid page type values */
export const PAGE_TYPES = [
	"homepage",
	"about",
	"service",
	"product",
	"blog_post",
	"case_study",
	"testimonial",
	"contact",
	"team",
	"faq",
	"landing",
	"category",
	"portfolio",
	"news",
	"other",
	"unknown",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

/** Crawl job response from content-service */
export type CrawlJob = {
	id: string;
	agency_id: string;
	client_id: string;
	status: string;
	source_url: string;
	crawl_target: string;
	crawl_type: string;
	pages_discovered: number;
	pages_processed: number;
	pages_changed: number;
	max_depth: number;
	error_message?: string | null;
	started_at?: string | null;
	completed_at?: string | null;
	created_at: string;
	updated_at: string;
};

/** Content page response from content-service */
export type ContentPage = {
	id: string;
	client_id: string;
	crawl_job_id?: string | null;
	url: string;
	canonical_url?: string | null;
	source_type: string;
	page_type: string;
	classification_confidence: number;
	classification_method?: string | null;
	title?: string | null;
	meta_description?: string | null;
	word_count: number;
	reading_time_minutes: number;
	http_status?: number | null;
	content_hash?: string | null;
	has_canonical: boolean;
	has_robots_meta: boolean;
	internal_links_count: number;
	external_links_count: number;
	image_count: number;
	images_missing_alt: number;
	first_scraped_at: string;
	last_scraped_at: string;
	content_changed_at?: string | null;
	created_at: string;
	updated_at: string;
};

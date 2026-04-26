/**
 * Content Overview Types
 * Matches Go content-service overview endpoint response.
 */

export type ContentOverview = {
	crawl: {
		total_pages: number;
		last_crawled_at: string | null;
		status: string;
		source_url?: string;
	};
	seo: {
		critical: number;
		warnings: number;
		notices: number;
		score: number;
	};
	copy: {
		total: number;
		drafts: number;
		finals: number;
		by_type: Record<string, number>;
	};
	brand: {
		has_profile: boolean;
		source_type?: string;
		last_updated?: string;
	};
	questionnaire: {
		completed: boolean;
	};
	activity: ActivityItem[];
};

export type ActivityItem = {
	type: string;
	title: string;
	created_at: string;
	metadata: Record<string, unknown>;
};

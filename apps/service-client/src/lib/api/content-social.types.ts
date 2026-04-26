/**
 * Social Media Generation & Management Types
 * Matches Go content-service social/generate handler JSON responses.
 */

export type SocialVariation = {
	copy_id: string;
	angle: string;
	post: string;
	hashtags: string[];
	character_count: number;
};

export type SocialGenerateResult = {
	platform: string;
	variations: SocialVariation[];
	prompt_tokens: number;
	completion_tokens: number;
	model_used: string;
};

/** CopyResponse extended with generation_config for social posts */
export type SocialCopyResponse = {
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
	generation_config: string;
	created_at: string;
	updated_at: string;
};

export const SOCIAL_PLATFORMS = ["twitter", "linkedin", "facebook", "instagram"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const POST_GOALS = ["engagement", "traffic", "awareness", "promotion"] as const;
export type PostGoal = (typeof POST_GOALS)[number];

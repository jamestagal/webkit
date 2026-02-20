/**
 * Brand Profile Types
 * Matches Go content-service brand handler JSON responses.
 */

/** Brand profile JSONB structure */
export type BrandProfile = {
	personality_traits: string[];
	tone_guidelines: {
		default: string;
		promotional: string;
		educational: string;
	};
	vocabulary: {
		formality_level: string;
		industry_jargon: string[];
		avoided_terms: string[];
		signature_phrases: string[];
	};
	sentence_structure: {
		avg_length: string;
		active_passive: string;
		uses_contractions: boolean;
	};
	messaging_pillars: Array<{
		theme: string;
		evidence: string;
	}>;
	constraints: {
		always: string[];
		never: string[];
	};
	competitive_positioning: {
		differentiators: string[];
		industry_norms: string[];
		gaps_to_fill: string[];
	};
};

/** Brand profile response from content-service */
export type BrandProfileResponse = {
	id: string;
	client_id: string;
	agency_id: string;
	version: number;
	is_active: boolean;
	profile: BrandProfile;
	source_type: string;
	source_page_count: number;
	generated_at?: string | null;
	created_at: string;
	updated_at: string;
};

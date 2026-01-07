/**
 * Questionnaire Types
 *
 * Type definitions for questionnaire operations.
 * Separated from remote functions for proper module exports.
 */

import type { agencies, agencyProfiles, contracts, QuestionnaireResponse } from '$lib/server/schema';

// =============================================================================
// Types
// =============================================================================

export type QuestionnaireResponses = {
	// Section 1: Personal Information
	first_name?: string;
	last_name?: string;
	email?: string;

	// Section 2: Company Details
	company_name?: string;
	registered_address?: string;

	// Section 3: Information to be Displayed
	displayed_business_name?: string;
	displayed_address?: string;
	displayed_phone?: string;
	displayed_email?: string;
	social_media_accounts?: string;
	opening_hours?: string;

	// Section 4: Domain & Technical
	has_domain?: 'yes' | 'no';
	domain_name?: string;
	has_google_business?: 'yes' | 'no';

	// Section 5: About Your Business
	business_story?: string;
	business_emails?: string;
	areas_served?: string;
	target_customers?: string;
	top_services?: string;
	other_services?: string;
	differentiators?: string;
	statistics_awards?: string;
	additional_business_details?: string;

	// Section 6: Website Content
	pages_wanted?: string;
	customer_actions?: string;
	key_information?: string;
	calls_to_action?: string;
	regularly_updated_content?: string;
	additional_content_details?: string;

	// Section 7: Website Design
	competitor_websites?: string;
	reference_websites?: string;
	aesthetic_description?: string;
	branding_guidelines?: string;
	additional_design_details?: string;

	// Section 8: Final Details
	timeline?: string;
	google_analytics?: 'yes' | 'no';
	referral_source?: string;
	other_services_interest?: string[];
	marketing_permissions?: string[];
};

export type QuestionnaireAccessResult = {
	allowed: boolean;
	reason?: 'contract_not_found' | 'contract_not_signed' | 'payment_required' | 'already_completed';
	contract?: typeof contracts.$inferSelect;
	agency?: typeof agencies.$inferSelect;
	agencyProfile?: typeof agencyProfiles.$inferSelect;
	questionnaire?: QuestionnaireResponse;
};

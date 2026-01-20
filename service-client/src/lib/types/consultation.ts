/**
 * Consultation Form v2 Types
 *
 * Clean TypeScript interfaces for the streamlined 4-step consultation form.
 * Uses flat structure instead of nested JSONB.
 *
 * Steps:
 * 1. Contact & Business
 * 2. Situation & Challenges
 * 3. Goals & Budget
 * 4. Preferences & Notes
 */

// =============================================================================
// Enums and Constants
// =============================================================================

export type ConsultationStatus = "draft" | "completed" | "converted";
export type UrgencyLevel = "low" | "medium" | "high" | "critical";
export type WebsiteStatus = "none" | "refresh" | "rebuild";
export type Timeline = "asap" | "1-3-months" | "3-6-months" | "flexible";

// =============================================================================
// Social Media Structure
// =============================================================================

export interface SocialMedia {
	linkedin?: string;
	facebook?: string;
	instagram?: string;
}

// =============================================================================
// Step 1: Contact & Business
// =============================================================================

export interface ContactBusiness {
	business_name?: string;
	contact_person?: string;
	email: string;
	phone?: string;
	website?: string;
	social_media: SocialMedia;
	industry: string;
	business_type: string;
}

// =============================================================================
// Step 2: Situation & Challenges
// =============================================================================

export interface Situation {
	website_status: WebsiteStatus;
	primary_challenges: string[];
	urgency_level: UrgencyLevel;
}

// =============================================================================
// Step 3: Goals & Budget
// =============================================================================

export interface GoalsBudget {
	primary_goals: string[];
	conversion_goal?: string;
	budget_range: string;
	timeline?: Timeline;
}

// =============================================================================
// Step 4: Preferences & Notes
// =============================================================================

export interface PreferencesNotes {
	design_styles?: string[];
	admired_websites?: string;
	consultation_notes?: string;
}

// =============================================================================
// Complete Consultation Data (for form state)
// =============================================================================

export interface ConsultationData {
	contact_business: ContactBusiness;
	situation: Situation;
	goals_budget: GoalsBudget;
	preferences_notes: PreferencesNotes;
}

// =============================================================================
// API Response Type (flat structure from database)
// =============================================================================

export interface Consultation {
	id: string;
	agency_id: string;

	// Step 1: Contact & Business (flattened)
	business_name?: string;
	contact_person?: string;
	email: string;
	phone?: string;
	website?: string;
	social_linkedin?: string;
	social_facebook?: string;
	social_instagram?: string;
	industry: string;
	business_type: string;

	// Step 2: Situation & Challenges
	website_status: WebsiteStatus;
	primary_challenges: string[];
	urgency_level: UrgencyLevel;

	// Step 3: Goals & Budget
	primary_goals: string[];
	conversion_goal?: string;
	budget_range: string;
	timeline?: Timeline;

	// Step 4: Preferences & Notes
	design_styles?: string[];
	admired_websites?: string;
	consultation_notes?: string;

	// Metadata
	status: ConsultationStatus;
	created_at: string;
	updated_at: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert API response (flat) to structured form data
 */
export function toConsultationData(c: Consultation): ConsultationData {
	return {
		contact_business: {
			business_name: c.business_name,
			contact_person: c.contact_person,
			email: c.email,
			phone: c.phone,
			website: c.website,
			social_media: {
				linkedin: c.social_linkedin,
				facebook: c.social_facebook,
				instagram: c.social_instagram,
			},
			industry: c.industry,
			business_type: c.business_type,
		},
		situation: {
			website_status: c.website_status,
			primary_challenges: c.primary_challenges,
			urgency_level: c.urgency_level,
		},
		goals_budget: {
			primary_goals: c.primary_goals,
			conversion_goal: c.conversion_goal,
			budget_range: c.budget_range,
			timeline: c.timeline,
		},
		preferences_notes: {
			design_styles: c.design_styles,
			admired_websites: c.admired_websites,
			consultation_notes: c.consultation_notes,
		},
	};
}

/**
 * Convert structured form data to flat API request
 */
export function toFlatConsultation(
	data: ConsultationData,
): Omit<Consultation, "id" | "agency_id" | "status" | "created_at" | "updated_at"> {
	return {
		business_name: data.contact_business.business_name,
		contact_person: data.contact_business.contact_person,
		email: data.contact_business.email,
		phone: data.contact_business.phone,
		website: data.contact_business.website,
		social_linkedin: data.contact_business.social_media.linkedin,
		social_facebook: data.contact_business.social_media.facebook,
		social_instagram: data.contact_business.social_media.instagram,
		industry: data.contact_business.industry,
		business_type: data.contact_business.business_type,

		website_status: data.situation.website_status,
		primary_challenges: data.situation.primary_challenges,
		urgency_level: data.situation.urgency_level,

		primary_goals: data.goals_budget.primary_goals,
		conversion_goal: data.goals_budget.conversion_goal,
		budget_range: data.goals_budget.budget_range,
		timeline: data.goals_budget.timeline,

		design_styles: data.preferences_notes.design_styles,
		admired_websites: data.preferences_notes.admired_websites,
		consultation_notes: data.preferences_notes.consultation_notes,
	};
}

/**
 * Create empty form data for new consultation
 */
export function createEmptyConsultationData(): ConsultationData {
	return {
		contact_business: {
			business_name: "",
			contact_person: "",
			email: "",
			phone: "",
			website: "",
			social_media: {},
			industry: "",
			business_type: "",
		},
		situation: {
			website_status: "none",
			primary_challenges: [],
			urgency_level: "low",
		},
		goals_budget: {
			primary_goals: [],
			conversion_goal: "",
			budget_range: "",
			timeline: undefined,
		},
		preferences_notes: {
			design_styles: [],
			admired_websites: "",
			consultation_notes: "",
		},
	};
}

// =============================================================================
// Form State Types
// =============================================================================

export type ConsultationFormSection =
	| "contact_business"
	| "situation"
	| "goals_budget"
	| "preferences_notes";

export interface ConsultationFormState {
	currentStep: number;
	completedSteps: number[];
	data: ConsultationData;
	consultationId?: string;
	isDirty: boolean;
	isSaving: boolean;
	lastSaved?: Date;
	errors: Record<string, string>;
}

// =============================================================================
// List/Summary Types
// =============================================================================

export interface ConsultationSummary {
	id: string;
	agency_id: string;
	business_name?: string;
	contact_person?: string;
	email: string;
	industry: string;
	urgency_level: UrgencyLevel;
	status: ConsultationStatus;
	created_at: string;
	updated_at: string;
}

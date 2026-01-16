/**
 * Valibot Schemas for Consultation Form v2
 *
 * Streamlined 4-step consultation form validation.
 * Used by remote functions for form validation.
 */

import * as v from 'valibot';

// =============================================================================
// Common Schemas
// =============================================================================

// Base consultation ID schema (used for updates)
export const ConsultationIdSchema = v.pipe(v.string(), v.uuid());

// Social media schema
export const SocialMediaSchema = v.object({
	linkedin: v.optional(v.string()),
	facebook: v.optional(v.string()),
	instagram: v.optional(v.string())
});

// =============================================================================
// Step 1: Contact & Business Schema
// =============================================================================

export const ContactBusinessSchema = v.object({
	business_name: v.optional(v.pipe(v.string(), v.maxLength(255))),
	contact_person: v.optional(v.pipe(v.string(), v.maxLength(255))),
	email: v.pipe(v.string(), v.email('Valid email required')),
	phone: v.optional(v.pipe(v.string(), v.maxLength(50))),
	website: v.optional(
		v.pipe(
			v.string(),
			v.transform((val) => {
				// Auto-add https if missing
				if (val && !val.match(/^https?:\/\//)) {
					return 'https://' + val;
				}
				return val;
			})
		)
	),
	social_media: v.optional(SocialMediaSchema),
	industry: v.pipe(v.string(), v.minLength(1, 'Industry is required')),
	business_type: v.pipe(v.string(), v.minLength(1, 'Business type is required'))
});

export type ContactBusinessInput = v.InferInput<typeof ContactBusinessSchema>;
export type ContactBusinessOutput = v.InferOutput<typeof ContactBusinessSchema>;

// =============================================================================
// Step 2: Situation & Challenges Schema
// =============================================================================

export const SituationSchema = v.object({
	website_status: v.picklist(['none', 'refresh', 'rebuild'], 'Website status is required'),
	primary_challenges: v.pipe(
		v.array(v.string()),
		v.minLength(1, 'Select at least one challenge')
	),
	urgency_level: v.picklist(
		['low', 'medium', 'high', 'critical'],
		'Urgency level is required'
	)
});

export type SituationInput = v.InferInput<typeof SituationSchema>;
export type SituationOutput = v.InferOutput<typeof SituationSchema>;

// =============================================================================
// Step 3: Goals & Budget Schema
// =============================================================================

export const GoalsBudgetSchema = v.object({
	primary_goals: v.pipe(v.array(v.string()), v.minLength(1, 'Select at least one goal')),
	conversion_goal: v.optional(v.string()),
	budget_range: v.pipe(v.string(), v.minLength(1, 'Budget range is required')),
	// Allow empty string (from select default) or valid timeline values
	timeline: v.optional(
		v.union([
			v.literal(''),
			v.picklist(['asap', '1-3-months', '3-6-months', 'flexible'])
		])
	)
});

export type GoalsBudgetInput = v.InferInput<typeof GoalsBudgetSchema>;
export type GoalsBudgetOutput = v.InferOutput<typeof GoalsBudgetSchema>;

// =============================================================================
// Step 4: Preferences & Notes Schema
// =============================================================================

export const PreferencesNotesSchema = v.object({
	design_styles: v.optional(v.array(v.string())),
	admired_websites: v.optional(v.pipe(v.string(), v.maxLength(2000))),
	consultation_notes: v.optional(v.pipe(v.string(), v.maxLength(5000)))
});

export type PreferencesNotesInput = v.InferInput<typeof PreferencesNotesSchema>;
export type PreferencesNotesOutput = v.InferOutput<typeof PreferencesNotesSchema>;

// =============================================================================
// Complete Consultation Schema (all steps combined)
// =============================================================================

export const ConsultationDataSchema = v.object({
	contact_business: ContactBusinessSchema,
	situation: SituationSchema,
	goals_budget: GoalsBudgetSchema,
	preferences_notes: PreferencesNotesSchema
});

export type ConsultationDataInput = v.InferInput<typeof ConsultationDataSchema>;
export type ConsultationDataOutput = v.InferOutput<typeof ConsultationDataSchema>;

// =============================================================================
// Remote Function Schemas (with consultationId for updates)
// =============================================================================

// Create consultation (Step 1 - no ID yet)
export const CreateConsultationSchema = v.object({
	agencyId: v.pipe(v.string(), v.uuid()),
	...ContactBusinessSchema.entries
});

export type CreateConsultationInput = v.InferInput<typeof CreateConsultationSchema>;

// Update Step 1
export const UpdateContactBusinessSchema = v.object({
	consultationId: ConsultationIdSchema,
	...ContactBusinessSchema.entries
});

export type UpdateContactBusinessInput = v.InferInput<typeof UpdateContactBusinessSchema>;

// Update Step 2
export const UpdateSituationSchema = v.object({
	consultationId: ConsultationIdSchema,
	...SituationSchema.entries
});

export type UpdateSituationInput = v.InferInput<typeof UpdateSituationSchema>;

// Update Step 3
export const UpdateGoalsBudgetSchema = v.object({
	consultationId: ConsultationIdSchema,
	...GoalsBudgetSchema.entries
});

export type UpdateGoalsBudgetInput = v.InferInput<typeof UpdateGoalsBudgetSchema>;

// Update Step 4
export const UpdatePreferencesNotesSchema = v.object({
	consultationId: ConsultationIdSchema,
	...PreferencesNotesSchema.entries
});

export type UpdatePreferencesNotesInput = v.InferInput<typeof UpdatePreferencesNotesSchema>;

// Complete Consultation
export const CompleteConsultationSchema = v.object({
	consultationId: ConsultationIdSchema
});

export type CompleteConsultationInput = v.InferInput<typeof CompleteConsultationSchema>;

// =============================================================================
// Backward Compatibility Exports (for existing code)
// These will be removed after migration
// =============================================================================

// Legacy v1 schemas - deprecated
/** @deprecated Use ContactBusinessSchema instead */
export const ContactInfoSchema = v.object({
	consultationId: ConsultationIdSchema,
	business_name: v.optional(v.pipe(v.string(), v.maxLength(255))),
	contact_person: v.optional(v.pipe(v.string(), v.maxLength(255))),
	email: v.optional(v.pipe(v.string(), v.email())),
	phone: v.optional(v.pipe(v.string(), v.maxLength(50))),
	website: v.optional(v.string()),
	social_media: v.optional(v.record(v.string(), v.string()))
});

/** @deprecated Use SituationSchema instead */
export const PainPointsSchema = v.object({
	consultationId: ConsultationIdSchema,
	primary_challenges: v.optional(v.array(v.string())),
	technical_issues: v.optional(v.array(v.string())),
	urgency_level: v.optional(v.picklist(['low', 'medium', 'high', 'critical'])),
	impact_assessment: v.optional(v.string()),
	current_solution_gaps: v.optional(v.array(v.string()))
});

/** @deprecated Use GoalsBudgetSchema instead */
export const GoalsObjectivesSchema = v.object({
	consultationId: ConsultationIdSchema,
	primary_goals: v.optional(v.array(v.string())),
	secondary_goals: v.optional(v.array(v.string())),
	success_metrics: v.optional(v.array(v.string())),
	kpis: v.optional(v.array(v.string())),
	timeline: v.optional(
		v.object({
			desired_start: v.optional(v.string()),
			target_completion: v.optional(v.string()),
			milestones: v.optional(v.array(v.string()))
		})
	),
	budget_range: v.optional(v.string()),
	budget_constraints: v.optional(v.array(v.string()))
});

/** @deprecated Use ContactBusinessSchema instead */
export const BusinessContextSchema = v.object({
	consultationId: ConsultationIdSchema,
	industry: v.optional(v.string()),
	business_type: v.optional(v.string()),
	team_size: v.optional(v.number()),
	current_platform: v.optional(v.string()),
	digital_presence: v.optional(v.array(v.string())),
	marketing_channels: v.optional(v.array(v.string()))
});

/** @deprecated */
export const CreateConsultationWithContactInfoSchema = v.object({
	business_name: v.optional(v.string()),
	contact_person: v.optional(v.string()),
	email: v.optional(v.pipe(v.string(), v.email())),
	phone: v.optional(v.string()),
	website: v.optional(v.string()),
	social_media: v.optional(v.record(v.string(), v.string()))
});

/** @deprecated */
export const AutoSaveDraftSchema = v.object({
	consultationId: ConsultationIdSchema,
	contact_info: v.optional(v.record(v.string(), v.any())),
	business_context: v.optional(v.record(v.string(), v.any())),
	pain_points: v.optional(v.record(v.string(), v.any())),
	goals_objectives: v.optional(v.record(v.string(), v.any())),
	draft_notes: v.optional(v.string())
});

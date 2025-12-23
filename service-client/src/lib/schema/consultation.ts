/**
 * Valibot Schemas for Consultation Forms
 *
 * Used by remote functions for form validation.
 * Follows the remote functions guide requirement to use Valibot, not Zod.
 */

import * as v from 'valibot';

// Base consultation ID schema (used across all forms)
export const ConsultationIdSchema = v.pipe(v.string(), v.uuid());

// Contact Information Schema
export const ContactInfoSchema = v.object({
	consultationId: ConsultationIdSchema,
	business_name: v.optional(v.pipe(v.string(), v.maxLength(255))),
	contact_person: v.optional(v.pipe(v.string(), v.maxLength(255))),
	email: v.optional(v.pipe(v.string(), v.email())),
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
			}),
			v.url()
		)
	),
	social_media: v.optional(v.record(v.string(), v.string()))
});

export type ContactInfoInput = v.InferInput<typeof ContactInfoSchema>;
export type ContactInfoOutput = v.InferOutput<typeof ContactInfoSchema>;

// Business Context Schema
export const BusinessContextSchema = v.object({
	consultationId: ConsultationIdSchema,
	industry: v.optional(v.pipe(v.string(), v.maxLength(100))),
	business_type: v.optional(v.pipe(v.string(), v.maxLength(100))),
	team_size: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100000))),
	current_platform: v.optional(v.pipe(v.string(), v.maxLength(255))),
	digital_presence: v.optional(v.array(v.string())),
	marketing_channels: v.optional(v.array(v.string()))
});

export type BusinessContextInput = v.InferInput<typeof BusinessContextSchema>;
export type BusinessContextOutput = v.InferOutput<typeof BusinessContextSchema>;

// Pain Points Schema
export const PainPointsSchema = v.object({
	consultationId: ConsultationIdSchema,
	primary_challenges: v.optional(v.array(v.pipe(v.string(), v.maxLength(500)))),
	technical_issues: v.optional(v.array(v.pipe(v.string(), v.maxLength(500)))),
	urgency_level: v.optional(v.picklist(['low', 'medium', 'high', 'critical'])),
	impact_assessment: v.optional(v.pipe(v.string(), v.maxLength(2000))),
	current_solution_gaps: v.optional(v.array(v.pipe(v.string(), v.maxLength(500))))
});

export type PainPointsInput = v.InferInput<typeof PainPointsSchema>;
export type PainPointsOutput = v.InferOutput<typeof PainPointsSchema>;

// Timeline Schema (nested within Goals & Objectives)
export const TimelineSchema = v.object({
	desired_start: v.optional(v.string()),
	target_completion: v.optional(v.string()),
	milestones: v.optional(v.array(v.string()))
});

// Goals & Objectives Schema
export const GoalsObjectivesSchema = v.object({
	consultationId: ConsultationIdSchema,
	primary_goals: v.optional(v.array(v.pipe(v.string(), v.maxLength(500)))),
	secondary_goals: v.optional(v.array(v.pipe(v.string(), v.maxLength(500)))),
	success_metrics: v.optional(v.array(v.pipe(v.string(), v.maxLength(500)))),
	kpis: v.optional(v.array(v.pipe(v.string(), v.maxLength(500)))),
	timeline: v.optional(TimelineSchema),
	budget_range: v.optional(v.pipe(v.string(), v.maxLength(100))),
	budget_constraints: v.optional(v.array(v.pipe(v.string(), v.maxLength(500))))
});

export type GoalsObjectivesInput = v.InferInput<typeof GoalsObjectivesSchema>;
export type GoalsObjectivesOutput = v.InferOutput<typeof GoalsObjectivesSchema>;

// Complete Consultation Schema (for form completion)
export const CompleteConsultationSchema = v.object({
	consultationId: ConsultationIdSchema
});

// Draft Auto-save Schema
export const AutoSaveDraftSchema = v.object({
	consultationId: ConsultationIdSchema,
	contact_info: v.optional(v.record(v.string(), v.any())),
	business_context: v.optional(v.record(v.string(), v.any())),
	pain_points: v.optional(v.record(v.string(), v.any())),
	goals_objectives: v.optional(v.record(v.string(), v.any())),
	draft_notes: v.optional(v.string())
});

export type AutoSaveDraftInput = v.InferInput<typeof AutoSaveDraftSchema>;

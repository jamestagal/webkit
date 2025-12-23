import { z } from "zod";

// Enums matching backend
export const ConsultationStatus = z.enum(["draft", "completed", "archived"]);
export type ConsultationStatus = z.infer<typeof ConsultationStatus>;

export const UrgencyLevel = z.enum(["low", "medium", "high", "critical"]);
export type UrgencyLevel = z.infer<typeof UrgencyLevel>;

// Contact Information Schema
export const ContactInfoSchema = z.object({
	business_name: z.string().optional(),
	contact_person: z.string().optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
	website: z.string().url().optional(),
	social_media: z.record(z.string(), z.any()).optional(),
});
export type ContactInfo = z.infer<typeof ContactInfoSchema>;

// Business Context Schema
export const BusinessContextSchema = z.object({
	industry: z.string().optional(),
	business_type: z.string().optional(),
	team_size: z.number().int().positive().optional(),
	current_platform: z.string().optional(),
	digital_presence: z.array(z.string()).optional(),
	marketing_channels: z.array(z.string()).optional(),
});
export type BusinessContext = z.infer<typeof BusinessContextSchema>;

// Timeline Schema
export const TimelineSchema = z.object({
	desired_start: z.string().optional(),
	target_completion: z.string().optional(),
	milestones: z.array(z.string()).optional(),
});
export type Timeline = z.infer<typeof TimelineSchema>;

// Pain Points Schema
export const PainPointsSchema = z.object({
	primary_challenges: z.array(z.string()).optional(),
	technical_issues: z.array(z.string()).optional(),
	urgency_level: UrgencyLevel.optional(),
	impact_assessment: z.string().optional(),
	current_solution_gaps: z.array(z.string()).optional(),
});
export type PainPoints = z.infer<typeof PainPointsSchema>;

// Goals and Objectives Schema
export const GoalsObjectivesSchema = z.object({
	primary_goals: z.array(z.string()).optional(),
	secondary_goals: z.array(z.string()).optional(),
	success_metrics: z.array(z.string()).optional(),
	kpis: z.array(z.string()).optional(),
	timeline: TimelineSchema.optional(),
	budget_range: z.string().optional(),
	budget_constraints: z.array(z.string()).optional(),
});
export type GoalsObjectives = z.infer<typeof GoalsObjectivesSchema>;

// Main Consultation Schema
export const ConsultationSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	contact_info: z.any(), // JSONB raw data
	business_context: z.any(), // JSONB raw data
	pain_points: z.any(), // JSONB raw data
	goals_objectives: z.any(), // JSONB raw data
	status: ConsultationStatus,
	completion_percentage: z.number().int().min(0).max(100).optional(),
	created_at: z.string().datetime(),
	updated_at: z.string().datetime(),
	completed_at: z.string().datetime().optional(),
	// Parsed fields for frontend consumption
	parsed_contact_info: ContactInfoSchema.optional(),
	parsed_business_context: BusinessContextSchema.optional(),
	parsed_pain_points: PainPointsSchema.optional(),
	parsed_goals_objectives: GoalsObjectivesSchema.optional(),
});
export type Consultation = z.infer<typeof ConsultationSchema>;

// Consultation Summary Schema (for list views)
export const ConsultationSummarySchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	business_name: z.string().optional(),
	contact_person: z.string().optional(),
	email: z.string().email().optional(),
	industry: z.string().optional(),
	status: ConsultationStatus,
	completion_percentage: z.number().int().min(0).max(100),
	created_at: z.string().datetime(),
	updated_at: z.string().datetime(),
	completed_at: z.string().datetime().optional(),
});
export type ConsultationSummary = z.infer<typeof ConsultationSummarySchema>;

// Draft Schema
export const ConsultationDraftSchema = z.object({
	id: z.string().uuid(),
	consultation_id: z.string().uuid(),
	user_id: z.string().uuid(),
	contact_info: z.any().optional(),
	business_context: z.any().optional(),
	pain_points: z.any().optional(),
	goals_objectives: z.any().optional(),
	created_at: z.string().datetime(),
	updated_at: z.string().datetime(),
	// Parsed fields
	parsed_contact_info: ContactInfoSchema.optional(),
	parsed_business_context: BusinessContextSchema.optional(),
	parsed_pain_points: PainPointsSchema.optional(),
	parsed_goals_objectives: GoalsObjectivesSchema.optional(),
});
export type ConsultationDraft = z.infer<typeof ConsultationDraftSchema>;

// Version Schema
export const ConsultationVersionSchema = z.object({
	id: z.string().uuid(),
	consultation_id: z.string().uuid(),
	user_id: z.string().uuid(),
	version_number: z.number().int().positive(),
	contact_info: z.any().optional(),
	business_context: z.any().optional(),
	pain_points: z.any().optional(),
	goals_objectives: z.any().optional(),
	status: ConsultationStatus,
	completion_percentage: z.number().int().min(0).max(100),
	change_summary: z.string().optional(),
	changed_fields: z.array(z.string()).optional(),
	created_at: z.string().datetime(),
	// Parsed fields
	parsed_contact_info: ContactInfoSchema.optional(),
	parsed_business_context: BusinessContextSchema.optional(),
	parsed_pain_points: PainPointsSchema.optional(),
	parsed_goals_objectives: GoalsObjectivesSchema.optional(),
	parsed_changed_fields: z.array(z.string()).optional(),
});
export type ConsultationVersion = z.infer<typeof ConsultationVersionSchema>;

// API Input Schemas
export const CreateConsultationInputSchema = z.object({
	contact_info: ContactInfoSchema.optional(),
	business_context: BusinessContextSchema.optional(),
	pain_points: PainPointsSchema.optional(),
	goals_objectives: GoalsObjectivesSchema.optional(),
});
export type CreateConsultationInput = z.infer<typeof CreateConsultationInputSchema>;

export const UpdateConsultationInputSchema = z.object({
	contact_info: ContactInfoSchema.optional(),
	business_context: BusinessContextSchema.optional(),
	pain_points: PainPointsSchema.optional(),
	goals_objectives: GoalsObjectivesSchema.optional(),
	status: ConsultationStatus.optional(),
});
export type UpdateConsultationInput = z.infer<typeof UpdateConsultationInputSchema>;

// API Response Schemas
export const ListConsultationsResponseSchema = z.object({
	consultations: z.array(ConsultationSummarySchema),
	total: z.number().int().min(0),
	page: z.number().int().min(1),
	limit: z.number().int().min(1),
	has_more: z.boolean(),
});
export type ListConsultationsResponse = z.infer<typeof ListConsultationsResponseSchema>;

export const VersionHistoryResponseSchema = z.object({
	versions: z.array(ConsultationVersionSchema),
	total: z.number().int().min(0),
	page: z.number().int().min(1),
	limit: z.number().int().min(1),
	has_more: z.boolean(),
});
export type VersionHistoryResponse = z.infer<typeof VersionHistoryResponseSchema>;

// API Error Schema
export const APIErrorSchema = z.object({
	message: z.string(),
	code: z.number().optional(),
	details: z.any().optional(),
});
export type APIError = z.infer<typeof APIErrorSchema>;

// Safe API Response wrapper
export const SafeResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.discriminatedUnion("success", [
		z.object({
			success: z.literal(true),
			data: dataSchema,
			message: z.string(),
		}),
		z.object({
			success: z.literal(false),
			message: z.string(),
			code: z.number().optional(),
		}),
	]);

export type SafeResponse<T> =
	| { success: true; data: T; message: string }
	| { success: false; message: string; code?: number };

// List Parameters Schema
export const ListConsultationsParamsSchema = z.object({
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(20),
	status: ConsultationStatus.optional(),
	search: z.string().optional(),
});
export type ListConsultationsParams = z.infer<typeof ListConsultationsParamsSchema>;

// Form Section Types for multi-step form
export type ConsultationFormSection =
	| "contact_info"
	| "business_context"
	| "pain_points"
	| "goals_objectives";

export interface ConsultationFormState {
	currentStep: number;
	completedSteps: number[];
	data: Partial<CreateConsultationInput>;
	isDirty: boolean;
	isAutoSaving: boolean;
	lastSaved?: Date;
	errors: Record<string, string[]>;
}

// Utility type for draft save payloads
export interface DraftSavePayload {
	section?: ConsultationFormSection;
	data: Record<string, any>;
	auto_save?: boolean;
}

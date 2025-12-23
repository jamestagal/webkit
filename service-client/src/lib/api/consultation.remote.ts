/**
 * Consultation Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm.
 * Follows the remote functions guide:
 * - Uses query() for read operations
 * - Uses form() for mutations
 * - Uses Valibot for validation (NOT Zod)
 * - Uses getRequestEvent() for auth context
 */

import { query, form } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { consultations, consultationDrafts, consultationVersions } from '$lib/server/schema';
import { getUserId } from '$lib/server/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
	ContactInfoSchema,
	BusinessContextSchema,
	PainPointsSchema,
	GoalsObjectivesSchema,
	CompleteConsultationSchema,
	AutoSaveDraftSchema
} from '$lib/schema/consultation';
import type {
	ContactInfo,
	BusinessContext,
	PainPoints,
	GoalsObjectives
} from '$lib/server/schema';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate completion percentage based on filled form sections.
 * Each section contributes 25% to the total.
 */
function calculateCompletionPercentage(data: {
	contactInfo: unknown;
	businessContext: unknown;
	painPoints: unknown;
	goalsObjectives: unknown;
}): number {
	let percentage = 0;

	const hasContent = (obj: unknown): boolean => {
		if (!obj || typeof obj !== 'object') return false;
		return Object.values(obj as Record<string, unknown>).some((v) => {
			if (Array.isArray(v)) return v.length > 0;
			if (typeof v === 'string') return v.trim().length > 0;
			if (typeof v === 'number') return true;
			if (typeof v === 'object' && v !== null) return hasContent(v);
			return Boolean(v);
		});
	};

	if (hasContent(data.contactInfo)) percentage += 25;
	if (hasContent(data.businessContext)) percentage += 25;
	if (hasContent(data.painPoints)) percentage += 25;
	if (hasContent(data.goalsObjectives)) percentage += 25;

	return percentage;
}

/**
 * Extract form data fields, excluding the consultationId.
 */
function extractFormData<T extends { consultationId: string }>(
	data: T
): Omit<T, 'consultationId'> {
	const { consultationId, ...rest } = data;
	return rest;
}

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get or create a consultation for the current user.
 * Returns the most recent draft consultation, or creates a new one.
 */
export const getOrCreateConsultation = query(async () => {
	const userId = getUserId();

	// Try to find existing draft consultation
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.userId, userId), eq(consultations.status, 'draft')))
		.orderBy(desc(consultations.updatedAt))
		.limit(1);

	if (existing) {
		return existing;
	}

	// Create new consultation
	const [created] = await db
		.insert(consultations)
		.values({
			userId,
			status: 'draft',
			completionPercentage: 0
		})
		.returning();

	return created;
});

/**
 * Get a specific consultation by ID.
 * Verifies ownership before returning.
 */
export const getConsultation = query(
	v.pipe(v.string(), v.uuid()),
	async (id: string) => {
		const userId = getUserId();

		const [consultation] = await db
			.select()
			.from(consultations)
			.where(and(eq(consultations.id, id), eq(consultations.userId, userId)))
			.limit(1);

		if (!consultation) {
			throw new Error('Consultation not found');
		}

		return consultation;
	}
);

/**
 * Get the draft for a specific consultation.
 * Returns null if no draft exists.
 */
export const getDraft = query(
	v.pipe(v.string(), v.uuid()),
	async (consultationId: string) => {
		const userId = getUserId();

		const [draft] = await db
			.select()
			.from(consultationDrafts)
			.where(
				and(
					eq(consultationDrafts.consultationId, consultationId),
					eq(consultationDrafts.userId, userId)
				)
			)
			.limit(1);

		return draft || null;
	}
);

/**
 * Get all consultations for the current user.
 */
export const getUserConsultations = query(async () => {
	const userId = getUserId();

	return await db
		.select()
		.from(consultations)
		.where(eq(consultations.userId, userId))
		.orderBy(desc(consultations.updatedAt));
});

// =============================================================================
// Form Functions (Mutations)
// =============================================================================

/**
 * Save contact information for a consultation.
 */
export const saveContactInfo = form(ContactInfoSchema, async (data) => {
	const userId = getUserId();
	const formData = extractFormData(data);

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.userId, userId)))
		.limit(1);

	if (!existing) {
		throw new Error('Consultation not found');
	}

	// Build contact info object
	const contactInfo: ContactInfo = {
		business_name: formData.business_name,
		contact_person: formData.contact_person,
		email: formData.email,
		phone: formData.phone,
		website: formData.website,
		social_media: formData.social_media
	};

	// Calculate new completion percentage
	const completionPercentage = calculateCompletionPercentage({
		contactInfo,
		businessContext: existing.businessContext,
		painPoints: existing.painPoints,
		goalsObjectives: existing.goalsObjectives
	});

	// Update the consultation
	await db
		.update(consultations)
		.set({
			contactInfo,
			completionPercentage,
			updatedAt: new Date()
		})
		.where(eq(consultations.id, data.consultationId));

	// Refresh the consultation query
	getConsultation(data.consultationId).refresh();
});

/**
 * Save business context for a consultation.
 */
export const saveBusinessContext = form(BusinessContextSchema, async (data) => {
	const userId = getUserId();
	const formData = extractFormData(data);

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.userId, userId)))
		.limit(1);

	if (!existing) {
		throw new Error('Consultation not found');
	}

	// Build business context object
	const businessContext: BusinessContext = {
		industry: formData.industry,
		business_type: formData.business_type,
		team_size: formData.team_size,
		current_platform: formData.current_platform,
		digital_presence: formData.digital_presence,
		marketing_channels: formData.marketing_channels
	};

	// Calculate new completion percentage
	const completionPercentage = calculateCompletionPercentage({
		contactInfo: existing.contactInfo,
		businessContext,
		painPoints: existing.painPoints,
		goalsObjectives: existing.goalsObjectives
	});

	// Update the consultation
	await db
		.update(consultations)
		.set({
			businessContext,
			completionPercentage,
			updatedAt: new Date()
		})
		.where(eq(consultations.id, data.consultationId));

	// Refresh the consultation query
	getConsultation(data.consultationId).refresh();
});

/**
 * Save pain points for a consultation.
 */
export const savePainPoints = form(PainPointsSchema, async (data) => {
	const userId = getUserId();
	const formData = extractFormData(data);

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.userId, userId)))
		.limit(1);

	if (!existing) {
		throw new Error('Consultation not found');
	}

	// Build pain points object
	const painPoints: PainPoints = {
		primary_challenges: formData.primary_challenges,
		technical_issues: formData.technical_issues,
		urgency_level: formData.urgency_level,
		impact_assessment: formData.impact_assessment,
		current_solution_gaps: formData.current_solution_gaps
	};

	// Calculate new completion percentage
	const completionPercentage = calculateCompletionPercentage({
		contactInfo: existing.contactInfo,
		businessContext: existing.businessContext,
		painPoints,
		goalsObjectives: existing.goalsObjectives
	});

	// Update the consultation
	await db
		.update(consultations)
		.set({
			painPoints,
			completionPercentage,
			updatedAt: new Date()
		})
		.where(eq(consultations.id, data.consultationId));

	// Refresh the consultation query
	getConsultation(data.consultationId).refresh();
});

/**
 * Save goals and objectives for a consultation.
 */
export const saveGoalsObjectives = form(GoalsObjectivesSchema, async (data) => {
	const userId = getUserId();
	const formData = extractFormData(data);

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.userId, userId)))
		.limit(1);

	if (!existing) {
		throw new Error('Consultation not found');
	}

	// Build goals objectives object
	const goalsObjectives: GoalsObjectives = {
		primary_goals: formData.primary_goals,
		secondary_goals: formData.secondary_goals,
		success_metrics: formData.success_metrics,
		kpis: formData.kpis,
		timeline: formData.timeline,
		budget_range: formData.budget_range,
		budget_constraints: formData.budget_constraints
	};

	// Calculate new completion percentage
	const completionPercentage = calculateCompletionPercentage({
		contactInfo: existing.contactInfo,
		businessContext: existing.businessContext,
		painPoints: existing.painPoints,
		goalsObjectives
	});

	// Update the consultation
	await db
		.update(consultations)
		.set({
			goalsObjectives,
			completionPercentage,
			updatedAt: new Date()
		})
		.where(eq(consultations.id, data.consultationId));

	// Refresh the consultation query
	getConsultation(data.consultationId).refresh();
});

/**
 * Complete a consultation.
 * Creates a version snapshot and marks as completed.
 */
export const completeConsultation = form(CompleteConsultationSchema, async (data) => {
	const userId = getUserId();

	// Get the consultation
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.userId, userId)))
		.limit(1);

	if (!existing) {
		throw new Error('Consultation not found');
	}

	// Get the next version number
	const [maxVersion] = await db
		.select({ max: sql<number>`COALESCE(MAX(version_number), 0)` })
		.from(consultationVersions)
		.where(eq(consultationVersions.consultationId, data.consultationId));

	const nextVersion = (maxVersion?.max || 0) + 1;

	// Create version snapshot
	await db.insert(consultationVersions).values({
		consultationId: data.consultationId,
		userId,
		versionNumber: nextVersion,
		contactInfo: existing.contactInfo,
		businessContext: existing.businessContext,
		painPoints: existing.painPoints,
		goalsObjectives: existing.goalsObjectives,
		status: 'completed',
		completionPercentage: 100,
		changeSummary: 'Consultation completed',
		changedFields: ['status', 'completedAt']
	});

	// Update consultation status
	await db
		.update(consultations)
		.set({
			status: 'completed',
			completionPercentage: 100,
			completedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(consultations.id, data.consultationId));

	// Delete any draft
	await db
		.delete(consultationDrafts)
		.where(eq(consultationDrafts.consultationId, data.consultationId));

	// Redirect to success page
	redirect(303, '/consultation/success');
});

/**
 * Auto-save draft data.
 * Uses UPSERT pattern to create or update draft.
 */
export const autoSaveDraft = form(AutoSaveDraftSchema, async (data) => {
	const userId = getUserId();

	// Verify consultation ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.userId, userId)))
		.limit(1);

	if (!existing) {
		throw new Error('Consultation not found');
	}

	// Check if draft exists
	const [existingDraft] = await db
		.select()
		.from(consultationDrafts)
		.where(eq(consultationDrafts.consultationId, data.consultationId))
		.limit(1);

	if (existingDraft) {
		// Update existing draft
		await db
			.update(consultationDrafts)
			.set({
				contactInfo: data.contact_info || existingDraft.contactInfo,
				businessContext: data.business_context || existingDraft.businessContext,
				painPoints: data.pain_points || existingDraft.painPoints,
				goalsObjectives: data.goals_objectives || existingDraft.goalsObjectives,
				draftNotes: data.draft_notes,
				autoSaved: true,
				updatedAt: new Date()
			})
			.where(eq(consultationDrafts.id, existingDraft.id));
	} else {
		// Create new draft
		await db.insert(consultationDrafts).values({
			consultationId: data.consultationId,
			userId,
			contactInfo: data.contact_info || {},
			businessContext: data.business_context || {},
			painPoints: data.pain_points || {},
			goalsObjectives: data.goals_objectives || {},
			draftNotes: data.draft_notes,
			autoSaved: true
		});
	}

	// Refresh draft query
	getDraft(data.consultationId).refresh();
});

// =============================================================================
// Type Exports
// =============================================================================

export type Consultation = Awaited<ReturnType<typeof getOrCreateConsultation>>;
export type ConsultationDraft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;

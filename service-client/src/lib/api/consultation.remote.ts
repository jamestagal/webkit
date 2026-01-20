/**
 * Consultation Remote Functions v2
 *
 * Streamlined 4-step consultation form with flat column structure.
 * Uses SvelteKit remote functions with Drizzle ORM.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { consultations, users, agencyMemberships } from "$lib/server/schema";
import type { PerformanceData } from "$lib/server/schema";
import { getAgencyId, getUserId } from "$lib/server/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import {
	CreateConsultationSchema,
	UpdateContactBusinessSchema,
	UpdateSituationSchema,
	UpdateGoalsBudgetSchema,
	UpdatePreferencesNotesSchema,
	CompleteConsultationSchema,
} from "$lib/schema/consultation";
import { runPageSpeedAudit as runAudit } from "$lib/server/services/pagespeed.service";

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get existing draft consultation for the current agency.
 * Returns null if no draft exists.
 */
export const getExistingDraftConsultation = query(async () => {
	const agencyId = await getAgencyId();

	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.agencyId, agencyId), eq(consultations.status, "draft")))
		.orderBy(desc(consultations.updatedAt))
		.limit(1);

	return existing || null;
});

/**
 * Get a specific consultation by ID.
 * Verifies agency ownership before returning.
 */
export const getConsultation = query(v.pipe(v.string(), v.uuid()), async (id: string) => {
	const agencyId = await getAgencyId();

	const [consultation] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, id), eq(consultations.agencyId, agencyId)))
		.limit(1);

	if (!consultation) {
		throw new Error("Consultation not found");
	}

	return consultation;
});

/**
 * Get all consultations for the current agency with creator info.
 */
export const getAgencyConsultations = query(async () => {
	const agencyId = await getAgencyId();

	return await db
		.select({
			id: consultations.id,
			agencyId: consultations.agencyId,
			businessName: consultations.businessName,
			contactPerson: consultations.contactPerson,
			email: consultations.email,
			phone: consultations.phone,
			website: consultations.website,
			socialLinkedin: consultations.socialLinkedin,
			socialFacebook: consultations.socialFacebook,
			socialInstagram: consultations.socialInstagram,
			industry: consultations.industry,
			businessType: consultations.businessType,
			websiteStatus: consultations.websiteStatus,
			primaryChallenges: consultations.primaryChallenges,
			urgencyLevel: consultations.urgencyLevel,
			primaryGoals: consultations.primaryGoals,
			conversionGoal: consultations.conversionGoal,
			budgetRange: consultations.budgetRange,
			timeline: consultations.timeline,
			designStyles: consultations.designStyles,
			admiredWebsites: consultations.admiredWebsites,
			consultationNotes: consultations.consultationNotes,
			status: consultations.status,
			createdBy: consultations.createdBy,
			createdAt: consultations.createdAt,
			updatedAt: consultations.updatedAt,
			// Join to get creator name
			creatorName: sql<
				string | null
			>`COALESCE(${agencyMemberships.displayName}, ${users.email})`.as("creator_name"),
		})
		.from(consultations)
		.leftJoin(users, eq(consultations.createdBy, users.id))
		.leftJoin(
			agencyMemberships,
			and(
				eq(consultations.createdBy, agencyMemberships.userId),
				eq(consultations.agencyId, agencyMemberships.agencyId),
			),
		)
		.where(eq(consultations.agencyId, agencyId))
		.orderBy(desc(consultations.updatedAt));
});

/**
 * Get completed consultations for the current agency.
 */
export const getCompletedConsultations = query(async () => {
	const agencyId = await getAgencyId();

	return await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.agencyId, agencyId), eq(consultations.status, "completed")))
		.orderBy(desc(consultations.updatedAt));
});

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Create a new consultation with Step 1 data (Contact & Business).
 * Used for lazy creation when user completes the first step.
 */
export const createConsultation = command(CreateConsultationSchema, async (data) => {
	const agencyId = await getAgencyId();
	const userId = getUserId();

	// Ensure agencyId matches
	if (data.agencyId !== agencyId) {
		throw new Error("Agency ID mismatch");
	}

	const [created] = await db
		.insert(consultations)
		.values({
			agencyId,
			createdBy: userId,
			businessName: data.business_name || null,
			contactPerson: data.contact_person || null,
			email: data.email,
			phone: data.phone || null,
			website: data.website || null,
			socialLinkedin: data.social_media?.linkedin || null,
			socialFacebook: data.social_media?.facebook || null,
			socialInstagram: data.social_media?.instagram || null,
			industry: data.industry,
			businessType: data.business_type,
			// Defaults for subsequent steps
			websiteStatus: "none",
			primaryChallenges: [],
			urgencyLevel: "low",
			primaryGoals: [],
			budgetRange: "tbd",
			status: "draft",
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create consultation");
	}

	return { consultationId: created.id };
});

/**
 * Update Step 1: Contact & Business
 */
export const updateContactBusiness = command(UpdateContactBusinessSchema, async (data) => {
	const agencyId = await getAgencyId();

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Consultation not found");
	}

	await db
		.update(consultations)
		.set({
			businessName: data.business_name || null,
			contactPerson: data.contact_person || null,
			email: data.email,
			phone: data.phone || null,
			website: data.website || null,
			socialLinkedin: data.social_media?.linkedin || null,
			socialFacebook: data.social_media?.facebook || null,
			socialInstagram: data.social_media?.instagram || null,
			industry: data.industry,
			businessType: data.business_type,
			updatedAt: new Date(),
		})
		.where(eq(consultations.id, data.consultationId));

	// Refresh the query cache
	getConsultation(data.consultationId).refresh();
});

/**
 * Update Step 2: Situation & Challenges
 */
export const updateSituation = command(UpdateSituationSchema, async (data) => {
	const agencyId = await getAgencyId();

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Consultation not found");
	}

	await db
		.update(consultations)
		.set({
			websiteStatus: data.website_status,
			primaryChallenges: data.primary_challenges,
			urgencyLevel: data.urgency_level,
			updatedAt: new Date(),
		})
		.where(eq(consultations.id, data.consultationId));

	getConsultation(data.consultationId).refresh();
});

/**
 * Update Step 3: Goals & Budget
 */
export const updateGoalsBudget = command(UpdateGoalsBudgetSchema, async (data) => {
	const agencyId = await getAgencyId();

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Consultation not found");
	}

	await db
		.update(consultations)
		.set({
			primaryGoals: data.primary_goals,
			conversionGoal: data.conversion_goal || null,
			budgetRange: data.budget_range,
			timeline: data.timeline || null,
			updatedAt: new Date(),
		})
		.where(eq(consultations.id, data.consultationId));

	getConsultation(data.consultationId).refresh();
});

/**
 * Update Step 4: Preferences & Notes
 */
export const updatePreferencesNotes = command(UpdatePreferencesNotesSchema, async (data) => {
	const agencyId = await getAgencyId();

	// Verify ownership
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Consultation not found");
	}

	await db
		.update(consultations)
		.set({
			designStyles: data.design_styles || null,
			admiredWebsites: data.admired_websites || null,
			consultationNotes: data.consultation_notes || null,
			updatedAt: new Date(),
		})
		.where(eq(consultations.id, data.consultationId));

	getConsultation(data.consultationId).refresh();
});

/**
 * Complete a consultation.
 * Marks status as 'completed'.
 */
export const completeConsultation = command(CompleteConsultationSchema, async (data) => {
	const agencyId = await getAgencyId();

	// Get the consultation
	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Consultation not found");
	}

	// Mark as completed
	await db
		.update(consultations)
		.set({
			status: "completed",
			updatedAt: new Date(),
		})
		.where(eq(consultations.id, data.consultationId));

	// Refresh caches
	getConsultation(data.consultationId).refresh();
	getExistingDraftConsultation().refresh();
	getAgencyConsultations().refresh();

	return { success: true, consultationId: data.consultationId };
});

/**
 * Delete a consultation.
 */
export const deleteConsultation = command(
	v.object({ consultationId: v.pipe(v.string(), v.uuid()) }),
	async (data) => {
		const agencyId = await getAgencyId();

		// Verify ownership
		const [existing] = await db
			.select()
			.from(consultations)
			.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error("Consultation not found");
		}

		await db.delete(consultations).where(eq(consultations.id, data.consultationId));

		// Refresh caches
		getAgencyConsultations().refresh();
		getExistingDraftConsultation().refresh();

		return { success: true };
	},
);

// =============================================================================
// PageSpeed Audit Functions
// =============================================================================

/**
 * Run a PageSpeed audit for a consultation's website.
 * Stores results in the consultation's performanceData field.
 */
export const runPageSpeedAudit = command(
	v.object({ consultationId: v.pipe(v.string(), v.uuid()) }),
	async (data): Promise<PerformanceData> => {
		const agencyId = await getAgencyId();

		// Get the consultation
		const [consultation] = await db
			.select()
			.from(consultations)
			.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
			.limit(1);

		if (!consultation) {
			throw new Error("Consultation not found");
		}

		if (!consultation.website) {
			throw new Error("No website URL found on this consultation");
		}

		// Run the PageSpeed audit
		const performanceData = await runAudit(consultation.website);

		// Store results on the consultation
		await db
			.update(consultations)
			.set({
				performanceData,
				updatedAt: new Date(),
			})
			.where(eq(consultations.id, data.consultationId));

		// Refresh cache
		getConsultation(data.consultationId).refresh();

		return performanceData;
	},
);

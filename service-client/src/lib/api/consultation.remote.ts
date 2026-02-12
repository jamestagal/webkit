/**
 * Consultation Remote Functions v2
 *
 * Streamlined 4-step consultation form with flat column structure.
 * Uses SvelteKit remote functions with Drizzle ORM.
 */

import { query, command } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { consultations, users, agencyMemberships } from "$lib/server/schema";
import { getOrCreateClient } from "$lib/api/clients.remote";
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
			clientId: consultations.clientId,
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

	// Get or create unified client record
	const result = await getOrCreateClient({
		businessName: data.business_name || data.contact_person || "Unknown",
		email: data.email,
		contactName: data.contact_person || null,
	});

	const [created] = await db
		.insert(consultations)
		.values({
			agencyId,
			userId,
			clientId: result.client?.id || null, // Link to unified client
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

// =============================================================================
// Dynamic Form Functions (Phase 8)
// =============================================================================

/**
 * Schema for creating a consultation from dynamic form data.
 * Accepts any mapped fields + formId + customData.
 */
const DynamicCreateSchema = v.object({
	formId: v.optional(v.pipe(v.string(), v.uuid())),
	customData: v.optional(v.any()),
	status: v.optional(v.picklist(["draft", "completed"])),
	// Mapped fields (all optional since form may not include all)
	businessName: v.optional(v.nullable(v.string())),
	contactPerson: v.optional(v.nullable(v.string())),
	email: v.optional(v.string()),
	phone: v.optional(v.nullable(v.string())),
	website: v.optional(v.nullable(v.string())),
	socialLinkedin: v.optional(v.nullable(v.string())),
	socialFacebook: v.optional(v.nullable(v.string())),
	socialInstagram: v.optional(v.nullable(v.string())),
	industry: v.optional(v.nullable(v.string())),
	businessType: v.optional(v.nullable(v.string())),
	websiteStatus: v.optional(v.nullable(v.string())),
	primaryChallenges: v.optional(v.array(v.string())),
	urgencyLevel: v.optional(v.nullable(v.string())),
	primaryGoals: v.optional(v.array(v.string())),
	conversionGoal: v.optional(v.nullable(v.string())),
	budgetRange: v.optional(v.nullable(v.string())),
	timeline: v.optional(v.nullable(v.string())),
	designStyles: v.optional(v.nullable(v.array(v.string()))),
	admiredWebsites: v.optional(v.nullable(v.string())),
	consultationNotes: v.optional(v.nullable(v.string())),
});

/**
 * Create a consultation from dynamic form data.
 * Used by DynamicForm on first step save (lazy creation).
 */
export const createDynamicConsultation = command(DynamicCreateSchema, async (data) => {
	const agencyId = await getAgencyId();
	const userId = getUserId();

	// Get or create unified client if email provided
	let clientId: string | null = null;
	if (data.email) {
		const result = await getOrCreateClient({
			businessName: data.businessName || data.contactPerson || "Unknown",
			email: data.email,
			contactName: data.contactPerson || null,
		});
		clientId = result.client?.id || null;
	}

	const [created] = await db
		.insert(consultations)
		.values({
			agencyId,
			userId,
			clientId,
			createdBy: userId,
			formId: data.formId ?? undefined,
			customData: data.customData || {},
			businessName: data.businessName || null,
			contactPerson: data.contactPerson || null,
			email: data.email || "",
			phone: data.phone || null,
			website: data.website || null,
			socialLinkedin: data.socialLinkedin || null,
			socialFacebook: data.socialFacebook || null,
			socialInstagram: data.socialInstagram || null,
			industry: data.industry || "other",
			businessType: data.businessType || "other",
			websiteStatus: data.websiteStatus || "none",
			primaryChallenges: data.primaryChallenges || [],
			urgencyLevel: data.urgencyLevel || "low",
			primaryGoals: data.primaryGoals || [],
			conversionGoal: data.conversionGoal || null,
			budgetRange: data.budgetRange || "tbd",
			timeline: data.timeline || null,
			designStyles: data.designStyles || null,
			admiredWebsites: data.admiredWebsites ? [data.admiredWebsites] : [],
			consultationNotes: data.consultationNotes || null,
			status: data.status || "draft",
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create consultation");
	}

	return { consultationId: created.id };
});

/**
 * Schema for updating a consultation with dynamic form data.
 */
const DynamicUpdateSchema = v.object({
	consultationId: v.pipe(v.string(), v.uuid()),
	customData: v.optional(v.any()),
	status: v.optional(v.picklist(["draft", "completed"])),
	// All mapped fields optional
	businessName: v.optional(v.nullable(v.string())),
	contactPerson: v.optional(v.nullable(v.string())),
	email: v.optional(v.string()),
	phone: v.optional(v.nullable(v.string())),
	website: v.optional(v.nullable(v.string())),
	socialLinkedin: v.optional(v.nullable(v.string())),
	socialFacebook: v.optional(v.nullable(v.string())),
	socialInstagram: v.optional(v.nullable(v.string())),
	industry: v.optional(v.nullable(v.string())),
	businessType: v.optional(v.nullable(v.string())),
	websiteStatus: v.optional(v.nullable(v.string())),
	primaryChallenges: v.optional(v.array(v.string())),
	urgencyLevel: v.optional(v.nullable(v.string())),
	primaryGoals: v.optional(v.array(v.string())),
	conversionGoal: v.optional(v.nullable(v.string())),
	budgetRange: v.optional(v.nullable(v.string())),
	timeline: v.optional(v.nullable(v.string())),
	designStyles: v.optional(v.nullable(v.array(v.string()))),
	admiredWebsites: v.optional(v.nullable(v.union([v.string(), v.array(v.string())]))),
	consultationNotes: v.optional(v.nullable(v.string())),
});

/**
 * Update a consultation with dynamic form data.
 * Merges customData with existing, updates only provided mapped fields.
 */
export const updateDynamicConsultation = command(DynamicUpdateSchema, async (data) => {
	const agencyId = await getAgencyId();

	const [existing] = await db
		.select()
		.from(consultations)
		.where(and(eq(consultations.id, data.consultationId), eq(consultations.agencyId, agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Consultation not found");
	}

	const consultationId = data.consultationId;
	const customData = data.customData as Record<string, unknown> | undefined;

	// Build update object from provided fields only
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	const skipKeys = new Set(["consultationId", "customData"]);
	for (const [key, value] of Object.entries(data)) {
		if (skipKeys.has(key)) continue;
		if (value !== undefined) {
			// Normalize admiredWebsites: DB expects string[] but form may send a string
			if (key === "admiredWebsites" && typeof value === "string") {
				updates[key] = value ? [value] : [];
			} else {
				updates[key] = value;
			}
		}
	}

	// Merge customData if provided
	if (customData && Object.keys(customData).length > 0) {
		updates["customData"] = {
			...((existing.customData as Record<string, unknown>) || {}),
			...customData,
		};
	}

	await db.update(consultations).set(updates).where(eq(consultations.id, consultationId));

	// Update client record if email changed
	if (data.email && data.email !== existing.email) {
		await getOrCreateClient({
			businessName: (data.businessName ?? existing.businessName) || "Unknown",
			email: data.email,
			contactName: (data.contactPerson ?? existing.contactPerson) || null,
		});
	}

	// NOTE: Do NOT call getConsultation().refresh() here.
	// It invalidates the query cache, causing SvelteKit to remount the edit page
	// and resetting currentStepIndex back to 0 (breaking multi-step form navigation).
});

// =============================================================================
// Legacy Step Functions (deprecated - use createDynamicConsultation/updateDynamicConsultation)
// =============================================================================

/**
 * @deprecated Use updateDynamicConsultation with dynamic fields instead
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
 * @deprecated Use updateDynamicConsultation with dynamic fields instead
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
 * @deprecated Use updateDynamicConsultation with dynamic fields instead
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
 * @deprecated Use updateDynamicConsultation with dynamic fields instead
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
			admiredWebsites: data.admired_websites ? [data.admired_websites] : [],
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

		// Refresh caches so server load functions return fresh data
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
		let performanceData: PerformanceData;
		try {
			performanceData = await runAudit(consultation.website);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Failed to run PageSpeed audit";
			throw error(502, msg);
		}

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

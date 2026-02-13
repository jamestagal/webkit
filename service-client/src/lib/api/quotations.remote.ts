/**
 * Quotations Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for quotation operations.
 * Handles quotation creation (standalone or from templates),
 * scope section management, sending, and status tracking.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	quotations,
	quotationScopeSections,
	quotationTemplates,
	quotationTemplateSections,
	quotationTemplateTerms,
	quotationScopeTemplates,
	quotationTermsTemplates,
	agencies,
	agencyProfiles,
	users,
	agencyMemberships,
} from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { getOrCreateClient } from "$lib/api/clients.remote";
import { getNextDocumentNumber } from "$lib/server/document-numbers";
import { logActivity } from "$lib/server/db-helpers";
import {
	hasPermission,
	canAccessResource,
	canModifyResource,
	canDeleteResource,
} from "$lib/server/permissions";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { TermsBlock } from "./quotations.types";

// =============================================================================
// Validation Schemas
// =============================================================================

const ScopeSectionSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1)),
	workItems: v.array(v.string()),
	sectionPrice: v.string(),
	scopeTemplateId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
	sortOrder: v.number(),
});

const TermsBlockSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1)),
	content: v.string(),
	sortOrder: v.number(),
});

const CreateQuotationSchema = v.object({
	templateId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
	quotationName: v.optional(v.string()),
	clientBusinessName: v.pipe(v.string(), v.minLength(1)),
	clientContactName: v.optional(v.string()),
	clientEmail: v.pipe(v.string(), v.email()),
	clientPhone: v.optional(v.string()),
	clientAddress: v.optional(v.string()),
	siteAddress: v.optional(v.string()),
	siteReference: v.optional(v.string()),
	preparedDate: v.optional(v.string()),
	expiryDate: v.optional(v.string()),
	sections: v.array(ScopeSectionSchema),
	termsBlocks: v.optional(v.array(TermsBlockSchema)),
	optionsNotes: v.optional(v.string()),
	notes: v.optional(v.string()),
	discountAmount: v.optional(v.string()),
	discountDescription: v.optional(v.string()),
});

const UpdateQuotationSchema = v.object({
	quotationId: v.pipe(v.string(), v.uuid()),
	quotationName: v.optional(v.string()),
	clientBusinessName: v.optional(v.string()),
	clientContactName: v.optional(v.string()),
	clientEmail: v.optional(v.pipe(v.string(), v.email())),
	clientPhone: v.optional(v.string()),
	clientAddress: v.optional(v.string()),
	siteAddress: v.optional(v.string()),
	siteReference: v.optional(v.string()),
	preparedDate: v.optional(v.string()),
	expiryDate: v.optional(v.string()),
	sections: v.optional(v.array(ScopeSectionSchema)),
	termsBlocks: v.optional(v.array(TermsBlockSchema)),
	optionsNotes: v.optional(v.string()),
	notes: v.optional(v.string()),
	discountAmount: v.optional(v.string()),
	discountDescription: v.optional(v.string()),
});

const QuotationFilterStatusSchema = v.picklist([
	"draft",
	"sent",
	"viewed",
	"accepted",
	"declined",
	"expired",
]);

const QuotationFiltersSchema = v.optional(
	v.object({
		status: v.optional(QuotationFilterStatusSchema),
		search: v.optional(v.string()),
	}),
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique public slug for the quotation.
 */
async function generateUniqueSlug(): Promise<string> {
	let slug = nanoid(12);
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const existing = await db
			.select({ id: quotations.id })
			.from(quotations)
			.where(eq(quotations.slug, slug))
			.limit(1);

		if (existing.length === 0) {
			return slug;
		}

		slug = nanoid(12);
		attempts++;
	}

	// Fallback: use timestamp-based slug
	return `quo-${Date.now()}-${nanoid(6)}`;
}

/**
 * Calculate quotation totals from scope sections.
 */
function calculateQuotationTotals(
	sections: Array<{ sectionPrice: string }>,
	gstRegistered: boolean,
	gstRate: number,
	discountAmount: number = 0,
): { subtotal: number; gstAmount: number; total: number } {
	const subtotal = sections.reduce(
		(sum, section) => sum + parseFloat(section.sectionPrice || "0"),
		0,
	);

	const gstAmount = gstRegistered ? (subtotal - discountAmount) * (gstRate / 100) : 0;
	const total = subtotal - discountAmount + gstAmount;

	return {
		subtotal: Math.round(subtotal * 100) / 100,
		gstAmount: Math.round(gstAmount * 100) / 100,
		total: Math.round(total * 100) / 100,
	};
}

/**
 * Calculate per-section GST and total.
 */
function calculateSectionTotals(
	sectionPrice: string,
	gstRegistered: boolean,
	gstRate: number,
): { sectionGst: string; sectionTotal: string } {
	const price = parseFloat(sectionPrice || "0");
	const gst = gstRegistered ? price * (gstRate / 100) : 0;
	return {
		sectionGst: gst.toFixed(2),
		sectionTotal: (price + gst).toFixed(2),
	};
}

/**
 * Check if a quotation has expired (sent/viewed past expiryDate).
 * Returns the quotation with effective status.
 */
function getEffectiveStatus(quotation: { status: string; expiryDate: Date }): string {
	if (["sent", "viewed"].includes(quotation.status)) {
		const now = new Date();
		const expiry = new Date(quotation.expiryDate);
		expiry.setHours(23, 59, 59, 999);
		if (now > expiry) {
			return "expired";
		}
	}
	return quotation.status;
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get all quotations for the agency with optional filters.
 */
export const getQuotations = query(QuotationFiltersSchema, async (filters) => {
	const context = await getAgencyContext();

	const conditions = [eq(quotations.agencyId, context.agencyId)];

	if (filters?.status) {
		// "expired" is virtual — filter sent/viewed then check date
		if (filters.status !== "expired") {
			conditions.push(eq(quotations.status, filters.status));
		}
	}

	const results = await db
		.select({
			id: quotations.id,
			agencyId: quotations.agencyId,
			clientId: quotations.clientId,
			templateId: quotations.templateId,
			quotationNumber: quotations.quotationNumber,
			slug: quotations.slug,
			quotationName: quotations.quotationName,
			status: quotations.status,
			clientBusinessName: quotations.clientBusinessName,
			clientContactName: quotations.clientContactName,
			clientEmail: quotations.clientEmail,
			siteAddress: quotations.siteAddress,
			siteReference: quotations.siteReference,
			preparedDate: quotations.preparedDate,
			expiryDate: quotations.expiryDate,
			subtotal: quotations.subtotal,
			total: quotations.total,
			viewCount: quotations.viewCount,
			sentAt: quotations.sentAt,
			acceptedAt: quotations.acceptedAt,
			createdBy: quotations.createdBy,
			createdAt: quotations.createdAt,
			updatedAt: quotations.updatedAt,
			creatorName: sql<
				string | null
			>`COALESCE(${agencyMemberships.displayName}, ${users.email})`.as("creator_name"),
		})
		.from(quotations)
		.leftJoin(users, eq(quotations.createdBy, users.id))
		.leftJoin(
			agencyMemberships,
			and(
				eq(quotations.createdBy, agencyMemberships.userId),
				eq(quotations.agencyId, agencyMemberships.agencyId),
			),
		)
		.where(and(...conditions))
		.orderBy(desc(quotations.createdAt));

	// Apply effective status (expired = sent/viewed past expiry)
	const withEffectiveStatus = results.map((q) => ({
		...q,
		effectiveStatus: getEffectiveStatus(q),
	}));

	// Filter by expired if requested
	let filtered = withEffectiveStatus;
	if (filters?.status === "expired") {
		filtered = withEffectiveStatus.filter((q) => q.effectiveStatus === "expired");
	}

	// Search filter
	if (filters?.search) {
		const searchLower = filters.search.toLowerCase();
		filtered = filtered.filter(
			(q) =>
				q.quotationNumber.toLowerCase().includes(searchLower) ||
				q.clientBusinessName.toLowerCase().includes(searchLower) ||
				q.clientEmail.toLowerCase().includes(searchLower) ||
				q.quotationName.toLowerCase().includes(searchLower),
		);
	}

	return filtered;
});

/**
 * Get a single quotation by ID with scope sections.
 */
export const getQuotation = query(v.pipe(v.string(), v.uuid()), async (quotationId) => {
	const context = await getAgencyContext();

	const [quotation] = await db
		.select()
		.from(quotations)
		.where(and(eq(quotations.id, quotationId), eq(quotations.agencyId, context.agencyId)))
		.limit(1);

	if (!quotation) {
		throw new Error("Quotation not found");
	}

	if (!canAccessResource(context.role, quotation.createdBy || "", context.userId, "quotation")) {
		throw new Error("Permission denied");
	}

	// Get scope sections ordered by sortOrder
	const sections = await db
		.select()
		.from(quotationScopeSections)
		.where(eq(quotationScopeSections.quotationId, quotationId))
		.orderBy(asc(quotationScopeSections.sortOrder));

	// Get creator name
	let creatorName: string | null = null;
	if (quotation.createdBy) {
		const [creator] = await db
			.select({
				name: sql<
					string | null
				>`COALESCE(${agencyMemberships.displayName}, ${users.email})`,
			})
			.from(users)
			.leftJoin(
				agencyMemberships,
				and(
					eq(users.id, agencyMemberships.userId),
					eq(agencyMemberships.agencyId, context.agencyId),
				),
			)
			.where(eq(users.id, quotation.createdBy))
			.limit(1);
		creatorName = creator?.name || null;
	}

	return {
		quotation: {
			...quotation,
			effectiveStatus: getEffectiveStatus(quotation),
		},
		sections,
		creatorName,
	};
});

/**
 * Get quotation statistics for dashboard.
 */
export const getQuotationStats = query(async () => {
	const context = await getAgencyContext();

	const allQuotations = await db
		.select({
			status: quotations.status,
			total: quotations.total,
			expiryDate: quotations.expiryDate,
		})
		.from(quotations)
		.where(eq(quotations.agencyId, context.agencyId));

	const stats = {
		draftCount: 0,
		draftTotal: 0,
		awaitingCount: 0,
		awaitingTotal: 0,
		acceptedCount: 0,
		acceptedTotal: 0,
		expiredCount: 0,
		expiredTotal: 0,
	};

	for (const q of allQuotations) {
		const amount = parseFloat(q.total);
		const effective = getEffectiveStatus(q);

		switch (effective) {
			case "draft":
				stats.draftCount++;
				stats.draftTotal += amount;
				break;
			case "sent":
			case "viewed":
				stats.awaitingCount++;
				stats.awaitingTotal += amount;
				break;
			case "accepted":
				stats.acceptedCount++;
				stats.acceptedTotal += amount;
				break;
			case "expired":
				stats.expiredCount++;
				stats.expiredTotal += amount;
				break;
			case "declined":
				// Not shown in main stats
				break;
		}
	}

	return stats;
});

/**
 * Get quotation by public slug (for public view — no auth required).
 */
export const getQuotationBySlug = query(v.pipe(v.string(), v.minLength(1)), async (slug) => {
	const [quotation] = await db
		.select()
		.from(quotations)
		.where(eq(quotations.slug, slug))
		.limit(1);

	if (!quotation) {
		return null;
	}

	// Get scope sections
	const sections = await db
		.select()
		.from(quotationScopeSections)
		.where(eq(quotationScopeSections.quotationId, quotation.id))
		.orderBy(asc(quotationScopeSections.sortOrder));

	// Get agency info for display
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, quotation.agencyId))
		.limit(1);

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, quotation.agencyId))
		.limit(1);

	return {
		quotation: {
			...quotation,
			effectiveStatus: getEffectiveStatus(quotation),
		},
		sections,
		agency,
		profile,
	};
});

// =============================================================================
// Command Functions
// =============================================================================

/**
 * Create a new quotation.
 */
export const createQuotation = command(CreateQuotationSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation:create")) {
		throw new Error("Permission denied");
	}

	// Get agency profile for GST settings and default validity
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Generate quotation number atomically
	const quotationNumber = await getNextDocumentNumber(context.agencyId, "quotation");

	// Generate slug
	const slug = await generateUniqueSlug();

	// Get or create unified client
	const clientResult = await getOrCreateClient({
		businessName: data.clientBusinessName,
		email: data.clientEmail,
		contactName: data.clientContactName || null,
	});

	// Calculate dates
	const preparedDate = data.preparedDate ? new Date(data.preparedDate) : new Date();
	const defaultValidityDays = profile?.defaultQuotationValidityDays ?? 60;
	const expiryDate = data.expiryDate
		? new Date(data.expiryDate)
		: new Date(preparedDate.getTime() + defaultValidityDays * 24 * 60 * 60 * 1000);

	// Calculate totals
	const gstRegistered = profile?.gstRegistered ?? true;
	const gstRate = parseFloat(profile?.gstRate || "10.00");
	const discountAmount = parseFloat(data.discountAmount || "0");
	const { subtotal, gstAmount, total } = calculateQuotationTotals(
		data.sections,
		gstRegistered,
		gstRate,
		discountAmount,
	);

	// Create quotation
	const [quotation] = await db
		.insert(quotations)
		.values({
			agencyId: context.agencyId,
			clientId: clientResult.client?.id || null,
			templateId: data.templateId || null,
			quotationNumber,
			slug,
			quotationName: data.quotationName || "",
			status: "draft",
			clientBusinessName: data.clientBusinessName,
			clientContactName: data.clientContactName || "",
			clientEmail: data.clientEmail,
			clientPhone: data.clientPhone || "",
			clientAddress: data.clientAddress || "",
			siteAddress: data.siteAddress || "",
			siteReference: data.siteReference || "",
			preparedDate,
			expiryDate,
			subtotal: subtotal.toFixed(2),
			discountAmount: discountAmount.toFixed(2),
			discountDescription: data.discountDescription || "",
			gstAmount: gstAmount.toFixed(2),
			total: total.toFixed(2),
			gstRegistered,
			gstRate: gstRate.toFixed(2),
			termsBlocks: (data.termsBlocks || []) as unknown as TermsBlock[],
			optionsNotes: data.optionsNotes || "",
			notes: data.notes || "",
			createdBy: context.userId,
		})
		.returning();

	if (!quotation) {
		throw new Error("Failed to create quotation");
	}

	// Create scope sections
	for (const section of data.sections) {
		const { sectionGst, sectionTotal } = calculateSectionTotals(
			section.sectionPrice,
			gstRegistered,
			gstRate,
		);

		await db.insert(quotationScopeSections).values({
			quotationId: quotation.id,
			title: section.title,
			workItems: section.workItems,
			sectionPrice: section.sectionPrice,
			sectionGst,
			sectionTotal,
			sortOrder: section.sortOrder,
			scopeTemplateId: section.scopeTemplateId || null,
		});
	}

	await logActivity("quotation.created", "quotation", quotation.id, {
		newValues: { quotationNumber },
	});

	return quotation;
});

/**
 * Update an existing quotation (draft or sent).
 */
export const updateQuotation = command(UpdateQuotationSchema, async (data) => {
	const context = await getAgencyContext();

	const [quotation] = await db
		.select()
		.from(quotations)
		.where(and(eq(quotations.id, data.quotationId), eq(quotations.agencyId, context.agencyId)))
		.limit(1);

	if (!quotation) {
		throw new Error("Quotation not found");
	}

	if (!canModifyResource(context.role, quotation.createdBy || "", context.userId, "quotation")) {
		throw new Error("Permission denied");
	}

	// Only allow editing draft quotations
	if (quotation.status !== "draft") {
		throw new Error("Can only edit draft quotations");
	}

	// Get agency profile for GST
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	const gstRegistered = profile?.gstRegistered ?? true;
	const gstRate = parseFloat(profile?.gstRate || "10.00");

	// Update scope sections if provided (delete-and-recreate pattern)
	if (data.sections) {
		await db
			.delete(quotationScopeSections)
			.where(eq(quotationScopeSections.quotationId, quotation.id));

		for (const section of data.sections) {
			const { sectionGst, sectionTotal } = calculateSectionTotals(
				section.sectionPrice,
				gstRegistered,
				gstRate,
			);

			await db.insert(quotationScopeSections).values({
				quotationId: quotation.id,
				title: section.title,
				workItems: section.workItems,
				sectionPrice: section.sectionPrice,
				sectionGst,
				sectionTotal,
				sortOrder: section.sortOrder,
				scopeTemplateId: section.scopeTemplateId || null,
			});
		}

		// Recalculate totals
		const discountAmount = parseFloat(
			data.discountAmount || quotation.discountAmount,
		);
		const { subtotal, gstAmount, total } = calculateQuotationTotals(
			data.sections,
			gstRegistered,
			gstRate,
			discountAmount,
		);

		await db
			.update(quotations)
			.set({
				subtotal: subtotal.toFixed(2),
				gstAmount: gstAmount.toFixed(2),
				total: total.toFixed(2),
				updatedAt: new Date(),
			})
			.where(eq(quotations.id, quotation.id));
	}

	// Build update object for other fields
	const updateData: Record<string, unknown> = { updatedAt: new Date() };

	if (data.quotationName !== undefined) updateData["quotationName"] = data.quotationName;
	if (data.clientBusinessName !== undefined)
		updateData["clientBusinessName"] = data.clientBusinessName;
	if (data.clientContactName !== undefined)
		updateData["clientContactName"] = data.clientContactName;
	if (data.clientEmail !== undefined) updateData["clientEmail"] = data.clientEmail;
	if (data.clientPhone !== undefined) updateData["clientPhone"] = data.clientPhone;
	if (data.clientAddress !== undefined) updateData["clientAddress"] = data.clientAddress;
	if (data.siteAddress !== undefined) updateData["siteAddress"] = data.siteAddress;
	if (data.siteReference !== undefined) updateData["siteReference"] = data.siteReference;
	if (data.preparedDate !== undefined)
		updateData["preparedDate"] = new Date(data.preparedDate);
	if (data.expiryDate !== undefined) updateData["expiryDate"] = new Date(data.expiryDate);
	if (data.termsBlocks !== undefined) updateData["termsBlocks"] = data.termsBlocks;
	if (data.optionsNotes !== undefined) updateData["optionsNotes"] = data.optionsNotes;
	if (data.notes !== undefined) updateData["notes"] = data.notes;
	if (data.discountAmount !== undefined) updateData["discountAmount"] = data.discountAmount;
	if (data.discountDescription !== undefined)
		updateData["discountDescription"] = data.discountDescription;

	const [updated] = await db
		.update(quotations)
		.set(updateData)
		.where(eq(quotations.id, quotation.id))
		.returning();

	await logActivity("quotation.updated", "quotation", quotation.id, {
		oldValues: quotation,
		newValues: updateData,
	});

	return updated;
});

/**
 * Delete a quotation (draft only — hard delete).
 */
export const deleteQuotation = command(v.pipe(v.string(), v.uuid()), async (quotationId) => {
	const context = await getAgencyContext();

	const [quotation] = await db
		.select()
		.from(quotations)
		.where(and(eq(quotations.id, quotationId), eq(quotations.agencyId, context.agencyId)))
		.limit(1);

	if (!quotation) {
		throw new Error("Quotation not found");
	}

	if (
		!canDeleteResource(context.role, quotation.createdBy || "", context.userId, "quotation")
	) {
		throw new Error("Permission denied");
	}

	if (quotation.status !== "draft") {
		throw new Error("Can only delete draft quotations");
	}

	// Delete scope sections first (cascade should handle this, but explicit)
	await db
		.delete(quotationScopeSections)
		.where(eq(quotationScopeSections.quotationId, quotationId));

	// Delete quotation
	await db.delete(quotations).where(eq(quotations.id, quotationId));

	await logActivity("quotation.deleted", "quotation", quotationId, {
		oldValues: { quotationNumber: quotation.quotationNumber },
	});

	return { success: true };
});

/**
 * Duplicate an existing quotation as a new draft.
 */
export const duplicateQuotation = command(
	v.pipe(v.string(), v.uuid()),
	async (quotationId) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, "quotation:create")) {
			throw new Error("Permission denied");
		}

		const [original] = await db
			.select()
			.from(quotations)
			.where(
				and(eq(quotations.id, quotationId), eq(quotations.agencyId, context.agencyId)),
			)
			.limit(1);

		if (!original) {
			throw new Error("Quotation not found");
		}

		// Get agency profile for default validity
		const [profile] = await db
			.select()
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, context.agencyId))
			.limit(1);

		const quotationNumber = await getNextDocumentNumber(context.agencyId, "quotation");
		const slug = await generateUniqueSlug();
		const preparedDate = new Date();
		const defaultValidityDays = profile?.defaultQuotationValidityDays ?? 60;
		const expiryDate = new Date(
			preparedDate.getTime() + defaultValidityDays * 24 * 60 * 60 * 1000,
		);

		// Create duplicated quotation
		const [newQuotation] = await db
			.insert(quotations)
			.values({
				agencyId: context.agencyId,
				clientId: original.clientId,
				templateId: original.templateId,
				quotationNumber,
				slug,
				quotationName: original.quotationName
					? `${original.quotationName} (Copy)`
					: "",
				status: "draft",
				clientBusinessName: original.clientBusinessName,
				clientContactName: original.clientContactName,
				clientEmail: original.clientEmail,
				clientPhone: original.clientPhone,
				clientAddress: original.clientAddress,
				siteAddress: original.siteAddress,
				siteReference: original.siteReference,
				preparedDate,
				expiryDate,
				subtotal: original.subtotal,
				discountAmount: original.discountAmount,
				discountDescription: original.discountDescription,
				gstAmount: original.gstAmount,
				total: original.total,
				gstRegistered: original.gstRegistered,
				gstRate: original.gstRate,
				termsBlocks: original.termsBlocks,
				optionsNotes: original.optionsNotes,
				notes: original.notes,
				createdBy: context.userId,
			})
			.returning();

		if (!newQuotation) {
			throw new Error("Failed to duplicate quotation");
		}

		// Duplicate scope sections
		const originalSections = await db
			.select()
			.from(quotationScopeSections)
			.where(eq(quotationScopeSections.quotationId, quotationId))
			.orderBy(asc(quotationScopeSections.sortOrder));

		for (const section of originalSections) {
			await db.insert(quotationScopeSections).values({
				quotationId: newQuotation.id,
				title: section.title,
				workItems: section.workItems,
				sectionPrice: section.sectionPrice,
				sectionGst: section.sectionGst,
				sectionTotal: section.sectionTotal,
				sortOrder: section.sortOrder,
				scopeTemplateId: section.scopeTemplateId,
			});
		}

		await logActivity("quotation.duplicated", "quotation", newQuotation.id, {
			newValues: { quotationNumber, originalId: quotationId },
		});

		return newQuotation;
	},
);

/**
 * Send a quotation (transition draft → sent).
 * The actual email sending is handled by email.remote.ts.
 */
export const sendQuotation = command(v.pipe(v.string(), v.uuid()), async (quotationId) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "quotation:send")) {
		throw new Error("Permission denied");
	}

	const [quotation] = await db
		.select()
		.from(quotations)
		.where(and(eq(quotations.id, quotationId), eq(quotations.agencyId, context.agencyId)))
		.limit(1);

	if (!quotation) {
		throw new Error("Quotation not found");
	}

	if (!["draft", "sent"].includes(quotation.status)) {
		throw new Error("Quotation must be in draft or sent status to send");
	}

	const now = new Date();

	await db
		.update(quotations)
		.set({
			status: "sent",
			sentAt: quotation.sentAt || now,
			updatedAt: now,
		})
		.where(eq(quotations.id, quotationId));

	await logActivity("quotation.sent", "quotation", quotationId, {
		newValues: { sentAt: now.toISOString() },
	});

	return { success: true, slug: quotation.slug };
});

/**
 * Accept a quotation (public — no auth required).
 */
export const acceptQuotation = command(
	v.object({
		slug: v.pipe(v.string(), v.minLength(1)),
		acceptedByName: v.pipe(v.string(), v.minLength(1)),
		acceptedByTitle: v.optional(v.string()),
	}),
	async (data) => {
		const [quotation] = await db
			.select()
			.from(quotations)
			.where(eq(quotations.slug, data.slug))
			.limit(1);

		if (!quotation) {
			throw new Error("Quotation not found");
		}

		const effective = getEffectiveStatus(quotation);
		if (!["sent", "viewed"].includes(effective)) {
			throw new Error("Quotation is not available for acceptance");
		}

		const now = new Date();

		await db
			.update(quotations)
			.set({
				status: "accepted",
				acceptedByName: data.acceptedByName,
				acceptedByTitle: data.acceptedByTitle || null,
				acceptedAt: now,
				updatedAt: now,
			})
			.where(eq(quotations.id, quotation.id));

		await logActivity("quotation.accepted", "quotation", quotation.id, {
			newValues: {
				acceptedByName: data.acceptedByName,
				acceptedAt: now.toISOString(),
			},
		});

		return { success: true };
	},
);

/**
 * Decline a quotation (public — no auth required).
 */
export const declineQuotation = command(
	v.object({
		slug: v.pipe(v.string(), v.minLength(1)),
		reason: v.optional(v.string()),
	}),
	async (data) => {
		const [quotation] = await db
			.select()
			.from(quotations)
			.where(eq(quotations.slug, data.slug))
			.limit(1);

		if (!quotation) {
			throw new Error("Quotation not found");
		}

		const effective = getEffectiveStatus(quotation);
		if (!["sent", "viewed"].includes(effective)) {
			throw new Error("Quotation is not available for declining");
		}

		const now = new Date();

		await db
			.update(quotations)
			.set({
				status: "declined",
				declinedAt: now,
				declineReason: data.reason || "",
				updatedAt: now,
			})
			.where(eq(quotations.id, quotation.id));

		await logActivity("quotation.declined", "quotation", quotation.id, {
			newValues: {
				declinedAt: now.toISOString(),
				reason: data.reason || "",
			},
		});

		return { success: true };
	},
);

/**
 * Get template data for pre-populating a new quotation.
 * Returns the template with its linked scope sections and terms.
 */
export const getTemplateForQuotation = query(
	v.pipe(v.string(), v.uuid()),
	async (templateId) => {
		const context = await getAgencyContext();

		// Get template
		const [template] = await db
			.select()
			.from(quotationTemplates)
			.where(
				and(
					eq(quotationTemplates.id, templateId),
					eq(quotationTemplates.agencyId, context.agencyId),
					eq(quotationTemplates.isActive, true),
				),
			)
			.limit(1);

		if (!template) {
			throw new Error("Template not found");
		}

		// Get linked scope templates via junction table
		const templateSections = await db
			.select({
				sortOrder: quotationTemplateSections.sortOrder,
				defaultSectionPrice: quotationTemplateSections.defaultSectionPrice,
				scopeTemplate: {
					id: quotationScopeTemplates.id,
					name: quotationScopeTemplates.name,
					description: quotationScopeTemplates.description,
					workItems: quotationScopeTemplates.workItems,
					defaultPrice: quotationScopeTemplates.defaultPrice,
					category: quotationScopeTemplates.category,
				},
			})
			.from(quotationTemplateSections)
			.innerJoin(
				quotationScopeTemplates,
				eq(quotationTemplateSections.scopeTemplateId, quotationScopeTemplates.id),
			)
			.where(eq(quotationTemplateSections.templateId, templateId))
			.orderBy(asc(quotationTemplateSections.sortOrder));

		// Get linked terms templates via junction table
		const templateTerms = await db
			.select({
				sortOrder: quotationTemplateTerms.sortOrder,
				termsTemplate: {
					id: quotationTermsTemplates.id,
					title: quotationTermsTemplates.title,
					content: quotationTermsTemplates.content,
				},
			})
			.from(quotationTemplateTerms)
			.innerJoin(
				quotationTermsTemplates,
				eq(quotationTemplateTerms.termsTemplateId, quotationTermsTemplates.id),
			)
			.where(eq(quotationTemplateTerms.templateId, templateId))
			.orderBy(asc(quotationTemplateTerms.sortOrder));

		return {
			template,
			sections: templateSections.map((s) => ({
				title: s.scopeTemplate.name,
				workItems: (s.scopeTemplate.workItems as string[]) || [],
				sectionPrice: s.defaultSectionPrice || s.scopeTemplate.defaultPrice || "0.00",
				scopeTemplateId: s.scopeTemplate.id,
				sortOrder: s.sortOrder,
			})),
			termsBlocks: templateTerms.map((t) => ({
				title: t.termsTemplate.title,
				content: t.termsTemplate.content,
				sortOrder: t.sortOrder,
			})),
		};
	},
);

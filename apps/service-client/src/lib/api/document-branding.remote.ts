/**
 * Document Branding Remote Functions
 *
 * CRUD operations for per-document branding overrides.
 * Uses Valibot for validation (NOT Zod).
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { agencyDocumentBranding } from "$lib/server/schema";
import { requireAgencyRole, getAgencyContext } from "$lib/server/agency";
import { eq, and } from "drizzle-orm";

// =============================================================================
// Validation Schemas
// =============================================================================

const DocumentTypeSchema = v.picklist([
	"contract",
	"invoice",
	"questionnaire",
	"proposal",
	"email",
	"quotation",
]);

const GetDocumentBrandingSchema = v.object({
	documentType: DocumentTypeSchema,
});

const HexColorSchema = v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"));

const UpdateDocumentBrandingSchema = v.object({
	documentType: DocumentTypeSchema,
	useCustomBranding: v.boolean(),
	logoUrl: v.optional(v.nullable(v.string())),
	primaryColor: v.optional(v.nullable(HexColorSchema)),
	accentColor: v.optional(v.nullable(HexColorSchema)),
	accentGradient: v.optional(v.nullable(v.string())),
	// Proposal-specific override fields (migration 037). Mirrored by DB CHECK
	// constraints; text-color fields may be null (inherit).
	coverBgColor: v.optional(v.nullable(HexColorSchema)),
	coverTextColor: v.optional(v.nullable(HexColorSchema)),
	sectionHeadingColor: v.optional(v.nullable(HexColorSchema)),
	ctaButtonColor: v.optional(v.nullable(HexColorSchema)),
	ctaButtonTextColor: v.optional(v.nullable(HexColorSchema)),
	footerBgColor: v.optional(v.nullable(HexColorSchema)),
});

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get document branding override for a specific document type.
 * Returns null if no override exists (agency defaults should be used).
 */
export const getDocumentBranding = query(GetDocumentBrandingSchema, async (data) => {
	const context = await getAgencyContext();

	const [override] = await db
		.select()
		.from(agencyDocumentBranding)
		.where(
			and(
				eq(agencyDocumentBranding.agencyId, context.agencyId),
				eq(agencyDocumentBranding.documentType, data.documentType),
			),
		)
		.limit(1);

	return override ?? null;
});

/**
 * Get all document branding overrides for the current agency.
 * Returns array of overrides (may be empty if none configured).
 */
export const getAllDocumentBrandings = query(async () => {
	const context = await getAgencyContext();

	const overrides = await db
		.select()
		.from(agencyDocumentBranding)
		.where(eq(agencyDocumentBranding.agencyId, context.agencyId));

	// Return as a map for easier access by document type
	const brandingMap: Record<string, (typeof overrides)[number]> = {};
	for (const override of overrides) {
		brandingMap[override.documentType] = override;
	}

	return brandingMap;
});

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Update or create document branding override.
 * Admin/owner only.
 */
export const updateDocumentBranding = command(UpdateDocumentBrandingSchema, async (data) => {
	await requireAgencyRole(["owner", "admin"]);
	const context = await getAgencyContext();

	// Check if override exists
	const [existing] = await db
		.select({ id: agencyDocumentBranding.id })
		.from(agencyDocumentBranding)
		.where(
			and(
				eq(agencyDocumentBranding.agencyId, context.agencyId),
				eq(agencyDocumentBranding.documentType, data.documentType),
			),
		)
		.limit(1);

	// Build update object - handle null vs undefined properly. Empty strings
	// from the form collapse to null so the DB CHECK constraint isn't tripped.
	const normaliseHex = (value: string | null | undefined): string | null =>
		value === null ? null : value || null;

	const updateData = {
		useCustomBranding: data.useCustomBranding,
		logoUrl: data.logoUrl === null ? null : data.logoUrl || null,
		primaryColor: normaliseHex(data.primaryColor),
		accentColor: normaliseHex(data.accentColor),
		accentGradient: data.accentGradient === null ? null : data.accentGradient || null,
		coverBgColor: normaliseHex(data.coverBgColor),
		coverTextColor: normaliseHex(data.coverTextColor),
		sectionHeadingColor: normaliseHex(data.sectionHeadingColor),
		ctaButtonColor: normaliseHex(data.ctaButtonColor),
		ctaButtonTextColor: normaliseHex(data.ctaButtonTextColor),
		footerBgColor: normaliseHex(data.footerBgColor),
		updatedAt: new Date(),
	};

	let result;
	if (existing) {
		// Update existing
		[result] = await db
			.update(agencyDocumentBranding)
			.set(updateData)
			.where(eq(agencyDocumentBranding.id, existing.id))
			.returning();
	} else {
		// Create new
		[result] = await db
			.insert(agencyDocumentBranding)
			.values({
				agencyId: context.agencyId,
				documentType: data.documentType,
				...updateData,
			})
			.returning();
	}

	return result;
});

/**
 * Delete a document branding override (revert to agency defaults).
 * Admin/owner only.
 */
export const deleteDocumentBranding = command(
	v.object({ documentType: DocumentTypeSchema }),
	async (data) => {
		await requireAgencyRole(["owner", "admin"]);
		const context = await getAgencyContext();

		await db
			.delete(agencyDocumentBranding)
			.where(
				and(
					eq(agencyDocumentBranding.agencyId, context.agencyId),
					eq(agencyDocumentBranding.documentType, data.documentType),
				),
			);

		return { success: true };
	},
);

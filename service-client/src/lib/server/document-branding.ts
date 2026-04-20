/**
 * Document Branding Helpers
 *
 * Provides centralized logic for resolving effective branding per document type.
 * Handles fallback from document-specific overrides to agency defaults.
 */

import { db } from "$lib/server/db";
import { agencies, agencyDocumentBranding, type DocumentType } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";

export type { DocumentType } from "$lib/server/schema";

export interface EffectiveBranding {
	logoUrl: string;
	primaryColor: string;
	secondaryColor: string;
	accentColor: string;
	accentGradient: string;
}

/**
 * Proposal-specific effective branding.
 *
 * Text-color fields are nullable: `null` means "no override, inherit from
 * the document's current text styling" — consumers must omit the inline
 * style attribute when the value is null. Hardcoding a default (e.g. white)
 * would break every existing agency render on a light cover background.
 */
export interface ProposalEffectiveBranding extends EffectiveBranding {
	coverBgColor: string;
	coverTextColor: string | null;
	sectionHeadingColor: string;
	ctaButtonColor: string;
	ctaButtonTextColor: string | null;
	footerBgColor: string;
}

// Default branding values used when agency has no branding set
const DEFAULT_BRANDING: EffectiveBranding = {
	logoUrl: "",
	primaryColor: "#4F46E5", // Indigo-600
	secondaryColor: "#1E40AF", // Blue-800
	accentColor: "#F59E0B", // Amber-500
	accentGradient: "",
};

// Cover-bg / footer-bg fall back to the secondaryColor cascade which itself
// defaults to the existing inline fallback in /p/[slug] (#E3EDF7 light blue).
const PROPOSAL_DEFAULT_COVER_BG = "#E3EDF7";

/**
 * Get the effective branding for a specific document type.
 *
 * Resolution order:
 * 1. If document override exists and useCustomBranding is true, use override values
 * 2. For any null override fields, fall back to agency branding
 * 3. For any missing agency branding, fall back to defaults
 *
 * @param agencyId - The agency UUID
 * @param documentType - The document type ('contract', 'invoice', 'questionnaire', 'proposal', 'email')
 * @returns EffectiveBranding with resolved values
 */
export async function getEffectiveBranding(
	agencyId: string,
	documentType: DocumentType,
): Promise<EffectiveBranding> {
	// Fetch agency base branding
	const [agency] = await db
		.select({
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			secondaryColor: agencies.secondaryColor,
			accentColor: agencies.accentColor,
			accentGradient: agencies.accentGradient,
		})
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	if (!agency) {
		return DEFAULT_BRANDING;
	}

	// Fetch document-specific override (if exists)
	const [override] = await db
		.select()
		.from(agencyDocumentBranding)
		.where(
			and(
				eq(agencyDocumentBranding.agencyId, agencyId),
				eq(agencyDocumentBranding.documentType, documentType),
			),
		)
		.limit(1);

	// Base branding from agency (with defaults)
	const baseBranding: EffectiveBranding = {
		logoUrl: agency.logoUrl || DEFAULT_BRANDING.logoUrl,
		primaryColor: agency.primaryColor || DEFAULT_BRANDING.primaryColor,
		secondaryColor: agency.secondaryColor || DEFAULT_BRANDING.secondaryColor,
		accentColor: agency.accentColor || DEFAULT_BRANDING.accentColor,
		accentGradient: agency.accentGradient || DEFAULT_BRANDING.accentGradient,
	};

	// If no override or override is disabled, return agency defaults
	if (!override || !override.useCustomBranding) {
		return baseBranding;
	}

	// Merge: override takes precedence if field is non-null
	return {
		logoUrl: override.logoUrl ?? baseBranding.logoUrl,
		primaryColor: override.primaryColor ?? baseBranding.primaryColor,
		secondaryColor: baseBranding.secondaryColor, // No override for secondary
		accentColor: override.accentColor ?? baseBranding.accentColor,
		accentGradient: override.accentGradient ?? baseBranding.accentGradient,
	};
}

/**
 * Get the effective branding for the proposal document type, including
 * proposal-specific override fields (cover, section headings, CTA, footer).
 *
 * Cascade per field:
 *   coverBgColor         → override → agency.secondaryColor → '#E3EDF7'
 *   coverTextColor       → override → null (inherit — component omits inline style)
 *   sectionHeadingColor  → override → agency.primaryColor   → '#4F46E5'
 *   ctaButtonColor       → override → agency.primaryColor   → '#4F46E5'
 *   ctaButtonTextColor   → override → null (inherit — component omits inline style)
 *   footerBgColor        → override → agency.secondaryColor → '#E3EDF7'
 */
export async function getEffectiveProposalBranding(
	agencyId: string,
): Promise<ProposalEffectiveBranding> {
	const base = await getEffectiveBranding(agencyId, "proposal");

	const [override] = await db
		.select()
		.from(agencyDocumentBranding)
		.where(
			and(
				eq(agencyDocumentBranding.agencyId, agencyId),
				eq(agencyDocumentBranding.documentType, "proposal"),
			),
		)
		.limit(1);

	const useOverride = override?.useCustomBranding ?? false;

	// Agency-level cascade targets for cover/footer bg (secondaryColor) default
	// to the #E3EDF7 fallback that /p/[slug] has always used inline, NOT the
	// generic EffectiveBranding.secondaryColor default of #1E40AF.
	const [agency] = await db
		.select({ secondaryColor: agencies.secondaryColor, primaryColor: agencies.primaryColor })
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	const agencyCoverBg = agency?.secondaryColor || PROPOSAL_DEFAULT_COVER_BG;
	const agencyHeading = agency?.primaryColor || DEFAULT_BRANDING.primaryColor;

	return {
		...base,
		coverBgColor: (useOverride && override?.coverBgColor) || agencyCoverBg,
		coverTextColor: useOverride ? (override?.coverTextColor ?? null) : null,
		sectionHeadingColor: (useOverride && override?.sectionHeadingColor) || agencyHeading,
		ctaButtonColor: (useOverride && override?.ctaButtonColor) || agencyHeading,
		ctaButtonTextColor: useOverride ? (override?.ctaButtonTextColor ?? null) : null,
		footerBgColor: (useOverride && override?.footerBgColor) || agencyCoverBg,
	};
}

/**
 * Get document branding override for a specific document type.
 * Returns null if no override exists.
 */
export async function getDocumentBrandingOverride(agencyId: string, documentType: DocumentType) {
	const [override] = await db
		.select()
		.from(agencyDocumentBranding)
		.where(
			and(
				eq(agencyDocumentBranding.agencyId, agencyId),
				eq(agencyDocumentBranding.documentType, documentType),
			),
		)
		.limit(1);

	return override ?? null;
}

/**
 * Get all document branding overrides for an agency.
 * Returns a map of documentType -> override settings.
 */
export async function getAllDocumentBrandingOverrides(agencyId: string) {
	const overrides = await db
		.select()
		.from(agencyDocumentBranding)
		.where(eq(agencyDocumentBranding.agencyId, agencyId));

	return overrides;
}

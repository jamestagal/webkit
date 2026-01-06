/**
 * Agency Profile Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for agency profile operations.
 * Handles business registration, address, banking, tax, and document defaults.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { agencyProfiles, agencies } from '$lib/server/schema';
import { requireAgencyRole } from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import { eq } from 'drizzle-orm';

// =============================================================================
// Validation Schemas
// =============================================================================

const UpdateProfileSchema = v.object({
	// Business Registration
	abn: v.optional(v.pipe(v.string(), v.maxLength(20))),
	acn: v.optional(v.pipe(v.string(), v.maxLength(20))),
	legalEntityName: v.optional(v.pipe(v.string(), v.maxLength(255))),
	tradingName: v.optional(v.pipe(v.string(), v.maxLength(255))),

	// Address
	addressLine1: v.optional(v.pipe(v.string(), v.maxLength(255))),
	addressLine2: v.optional(v.pipe(v.string(), v.maxLength(255))),
	city: v.optional(v.pipe(v.string(), v.maxLength(100))),
	state: v.optional(v.pipe(v.string(), v.maxLength(50))),
	postcode: v.optional(v.pipe(v.string(), v.maxLength(20))),
	country: v.optional(v.pipe(v.string(), v.maxLength(100))),

	// Banking
	bankName: v.optional(v.pipe(v.string(), v.maxLength(100))),
	bsb: v.optional(v.pipe(v.string(), v.regex(/^(\d{3}-?\d{3})?$/, 'BSB must be 6 digits (e.g., 123-456)'))),
	accountNumber: v.optional(v.pipe(v.string(), v.maxLength(30))),
	accountName: v.optional(v.pipe(v.string(), v.maxLength(255))),

	// Tax & GST
	gstRegistered: v.optional(v.boolean()),
	taxFileNumber: v.optional(v.pipe(v.string(), v.maxLength(20))),
	gstRate: v.optional(v.pipe(v.string(), v.regex(/^\d+(\.\d{1,2})?$/, 'GST rate must be a decimal number'))),

	// Social & Branding
	tagline: v.optional(v.string()),
	socialLinkedin: v.optional(v.string()),
	socialFacebook: v.optional(v.string()),
	socialInstagram: v.optional(v.string()),
	socialTwitter: v.optional(v.string()),
	brandFont: v.optional(v.pipe(v.string(), v.maxLength(100))),

	// Document Defaults
	defaultPaymentTerms: v.optional(v.picklist(['DUE_ON_RECEIPT', 'NET_7', 'NET_14', 'NET_30'])),
	invoicePrefix: v.optional(v.pipe(v.string(), v.maxLength(20))),
	invoiceFooter: v.optional(v.string()),
	contractPrefix: v.optional(v.pipe(v.string(), v.maxLength(20))),
	contractFooter: v.optional(v.string()),
	proposalPrefix: v.optional(v.pipe(v.string(), v.maxLength(20)))
});

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get the agency profile for the current agency.
 * Returns null for profile if one doesn't exist - use ensureAgencyProfile() to create.
 */
export const getAgencyProfile = query(async () => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Try to get existing profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Also get agency info for merged data
	const [agency] = await db
		.select({
			name: agencies.name,
			email: agencies.email,
			phone: agencies.phone,
			website: agencies.website,
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			secondaryColor: agencies.secondaryColor,
			accentColor: agencies.accentColor
		})
		.from(agencies)
		.where(eq(agencies.id, context.agencyId))
		.limit(1);

	return {
		profile: profile ?? null,
		agency
	};
});

/**
 * Get just the profile data (for forms that don't need agency data).
 * Returns null if no profile exists.
 */
export const getAgencyProfileOnly = query(async () => {
	const context = await requireAgencyRole(['owner', 'admin']);

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	return profile ?? null;
});

/**
 * Ensure an agency profile exists (creates if missing).
 * Call this before editing profile data.
 */
export const ensureAgencyProfile = command(v.object({}), async () => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Check if profile exists
	const [existing] = await db
		.select({ id: agencyProfiles.id })
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	if (existing) {
		return existing;
	}

	// Create new profile
	const [profile] = await db
		.insert(agencyProfiles)
		.values({ agencyId: context.agencyId })
		.returning();

	await logActivity('profile.created', 'agency_profile', profile?.id, {});

	return profile;
});

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Update the agency profile (admin/owner only).
 * Creates a profile if one doesn't exist.
 */
export const updateAgencyProfile = command(UpdateProfileSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Check if profile exists
	const [existing] = await db
		.select({ id: agencyProfiles.id })
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Build update object with only provided fields
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	// Business Registration
	if (data.abn !== undefined) updates['abn'] = data.abn;
	if (data.acn !== undefined) updates['acn'] = data.acn;
	if (data.legalEntityName !== undefined) updates['legalEntityName'] = data.legalEntityName;
	if (data.tradingName !== undefined) updates['tradingName'] = data.tradingName;

	// Address
	if (data.addressLine1 !== undefined) updates['addressLine1'] = data.addressLine1;
	if (data.addressLine2 !== undefined) updates['addressLine2'] = data.addressLine2;
	if (data.city !== undefined) updates['city'] = data.city;
	if (data.state !== undefined) updates['state'] = data.state;
	if (data.postcode !== undefined) updates['postcode'] = data.postcode;
	if (data.country !== undefined) updates['country'] = data.country;

	// Banking
	if (data.bankName !== undefined) updates['bankName'] = data.bankName;
	if (data.bsb !== undefined) updates['bsb'] = data.bsb;
	if (data.accountNumber !== undefined) updates['accountNumber'] = data.accountNumber;
	if (data.accountName !== undefined) updates['accountName'] = data.accountName;

	// Tax & GST
	if (data.gstRegistered !== undefined) updates['gstRegistered'] = data.gstRegistered;
	if (data.taxFileNumber !== undefined) updates['taxFileNumber'] = data.taxFileNumber;
	if (data.gstRate !== undefined) updates['gstRate'] = data.gstRate;

	// Social & Branding
	if (data.tagline !== undefined) updates['tagline'] = data.tagline;
	if (data.socialLinkedin !== undefined) updates['socialLinkedin'] = data.socialLinkedin;
	if (data.socialFacebook !== undefined) updates['socialFacebook'] = data.socialFacebook;
	if (data.socialInstagram !== undefined) updates['socialInstagram'] = data.socialInstagram;
	if (data.socialTwitter !== undefined) updates['socialTwitter'] = data.socialTwitter;
	if (data.brandFont !== undefined) updates['brandFont'] = data.brandFont;

	// Document Defaults
	if (data.defaultPaymentTerms !== undefined)
		updates['defaultPaymentTerms'] = data.defaultPaymentTerms;
	if (data.invoicePrefix !== undefined) updates['invoicePrefix'] = data.invoicePrefix;
	if (data.invoiceFooter !== undefined) updates['invoiceFooter'] = data.invoiceFooter;
	if (data.contractPrefix !== undefined) updates['contractPrefix'] = data.contractPrefix;
	if (data.contractFooter !== undefined) updates['contractFooter'] = data.contractFooter;
	if (data.proposalPrefix !== undefined) updates['proposalPrefix'] = data.proposalPrefix;

	let profile;
	if (existing) {
		// Update existing profile
		[profile] = await db
			.update(agencyProfiles)
			.set(updates)
			.where(eq(agencyProfiles.agencyId, context.agencyId))
			.returning();
	} else {
		// Create new profile with provided data
		[profile] = await db
			.insert(agencyProfiles)
			.values({
				agencyId: context.agencyId,
				...updates
			})
			.returning();
	}

	// Log activity
	await logActivity('profile.updated', 'agency_profile', profile?.id, {
		newValues: updates
	});

	return profile;
});

/**
 * Increment and return the next document number.
 * Used for generating proposal/contract/invoice numbers.
 */
export const getNextDocumentNumber = command(
	v.object({
		type: v.picklist(['proposal', 'contract', 'invoice'])
	}),
	async (data) => {
		const context = await requireAgencyRole(['owner', 'admin', 'member']);

		// Get current profile
		let [profile] = await db
			.select()
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, context.agencyId))
			.limit(1);

		// Auto-create if not exists
		if (!profile) {
			[profile] = await db
				.insert(agencyProfiles)
				.values({ agencyId: context.agencyId })
				.returning();
		}

		// Determine which number to increment
		let prefix: string;
		let nextNumber: number;
		const updates: Record<string, unknown> = { updatedAt: new Date() };

		switch (data.type) {
			case 'proposal':
				prefix = profile!.proposalPrefix;
				nextNumber = profile!.nextProposalNumber;
				updates['nextProposalNumber'] = nextNumber + 1;
				break;
			case 'contract':
				prefix = profile!.contractPrefix;
				nextNumber = profile!.nextContractNumber;
				updates['nextContractNumber'] = nextNumber + 1;
				break;
			case 'invoice':
				prefix = profile!.invoicePrefix;
				nextNumber = profile!.nextInvoiceNumber;
				updates['nextInvoiceNumber'] = nextNumber + 1;
				break;
		}

		// Update the counter
		await db
			.update(agencyProfiles)
			.set(updates)
			.where(eq(agencyProfiles.agencyId, context.agencyId));

		// Format: PREFIX-YYYY-NNNN (e.g., PROP-2025-0001)
		const year = new Date().getFullYear();
		const formattedNumber = `${prefix}-${year}-${nextNumber.toString().padStart(4, '0')}`;

		return {
			number: formattedNumber,
			prefix,
			sequence: nextNumber
		};
	}
);


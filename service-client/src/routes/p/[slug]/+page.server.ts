/**
 * Public Proposal View - Server Load
 *
 * Loads proposal by public slug without authentication.
 * Records view count.
 */

import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { proposals, agencies, agencyProfiles, agencyPackages, agencyAddons } from '$lib/server/schema';
import { eq, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	// Fetch proposal by slug
	const [proposal] = await db
		.select()
		.from(proposals)
		.where(eq(proposals.slug, slug))
		.limit(1);

	if (!proposal) {
		throw error(404, 'Proposal not found');
	}

	// Check if expired
	const isExpired = proposal.validUntil && new Date(proposal.validUntil) < new Date();

	// Record view (fire-and-forget, don't await)
	const updates: Record<string, unknown> = {
		viewCount: sql`${proposals.viewCount} + 1`,
		lastViewedAt: new Date()
	};

	// If status is 'sent', change to 'viewed'
	if (proposal.status === 'sent') {
		updates['status'] = 'viewed';
	}

	db.update(proposals)
		.set(updates)
		.where(eq(proposals.id, proposal.id))
		.then(() => {})
		.catch(() => {});

	// Fetch agency
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, proposal.agencyId))
		.limit(1);

	// Fetch agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, proposal.agencyId))
		.limit(1);

	// Fetch selected package if any
	let selectedPackage = null;
	if (proposal.selectedPackageId) {
		const [pkg] = await db
			.select()
			.from(agencyPackages)
			.where(eq(agencyPackages.id, proposal.selectedPackageId))
			.limit(1);
		selectedPackage = pkg || null;
	}

	// Fetch selected addons
	const addonIds = (proposal.selectedAddons as string[]) || [];
	let selectedAddons: (typeof agencyAddons.$inferSelect)[] = [];
	if (addonIds.length > 0) {
		selectedAddons = await db
			.select()
			.from(agencyAddons)
			.where(sql`${agencyAddons.id} = ANY(${addonIds})`);
	}

	return {
		proposal: {
			...proposal,
			status: isExpired ? 'expired' : proposal.status
		},
		agency,
		profile,
		selectedPackage,
		selectedAddons
	};
};

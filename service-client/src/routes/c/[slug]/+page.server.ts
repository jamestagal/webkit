/**
 * Public Contract View - Server Load
 *
 * Loads contract by public slug without authentication.
 * Records view count and updates status if needed.
 */

import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { contracts, agencies, agencyProfiles, contractSchedules } from '$lib/server/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	// Fetch contract by slug
	const [contract] = await db
		.select()
		.from(contracts)
		.where(eq(contracts.slug, slug))
		.limit(1);

	if (!contract) {
		throw error(404, 'Contract not found');
	}

	// Check if expired
	const isExpired =
		contract.validUntil &&
		new Date(contract.validUntil) < new Date() &&
		!['signed', 'completed'].includes(contract.status);

	// Record view (fire-and-forget, don't await)
	const updates: Record<string, unknown> = {
		viewCount: sql`${contracts.viewCount} + 1`,
		lastViewedAt: new Date()
	};

	// If status is 'sent', change to 'viewed'
	if (contract.status === 'sent') {
		updates['status'] = 'viewed';
	}

	db.update(contracts)
		.set(updates)
		.where(eq(contracts.id, contract.id))
		.then(() => {})
		.catch(() => {});

	// Fetch agency
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, contract.agencyId))
		.limit(1);

	// Fetch agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, contract.agencyId))
		.limit(1);

	// Fetch included schedule sections
	const includedScheduleIds = (contract.includedScheduleIds as string[]) || [];
	let includedSchedules: Array<{
		id: string;
		name: string;
		content: string;
		displayOrder: number;
	}> = [];

	if (includedScheduleIds.length > 0) {
		includedSchedules = await db
			.select({
				id: contractSchedules.id,
				name: contractSchedules.name,
				content: contractSchedules.content,
				displayOrder: contractSchedules.displayOrder
			})
			.from(contractSchedules)
			.where(inArray(contractSchedules.id, includedScheduleIds))
			.orderBy(contractSchedules.displayOrder);
	}

	return {
		contract: {
			...contract,
			status: isExpired ? 'expired' : contract.status
		},
		agency,
		profile,
		includedSchedules
	};
};

export const actions: Actions = {
	sign: async ({ params, request, getClientAddress }) => {
		const { slug } = params;
		const formData = await request.formData();

		const signatoryName = formData.get('signatoryName')?.toString() || '';
		const signatoryTitle = formData.get('signatoryTitle')?.toString() || '';
		const agreedToTerms = formData.get('agreedToTerms') === 'true';

		// Validation
		if (!signatoryName) {
			return fail(400, { error: 'Signatory name is required' });
		}

		if (!agreedToTerms) {
			return fail(400, { error: 'You must agree to the terms and conditions' });
		}

		// Fetch contract
		const [contract] = await db
			.select()
			.from(contracts)
			.where(eq(contracts.slug, slug))
			.limit(1);

		if (!contract) {
			return fail(404, { error: 'Contract not found' });
		}

		// Verify contract can be signed
		if (!['sent', 'viewed'].includes(contract.status)) {
			return fail(400, { error: 'Contract cannot be signed in current state' });
		}

		// Check if expired
		if (contract.validUntil && new Date(contract.validUntil) < new Date()) {
			return fail(400, { error: 'Contract has expired' });
		}

		// Get client info
		let clientIp = '';
		try {
			clientIp = getClientAddress();
		} catch {
			// IP not available
		}

		// Record signature
		await db
			.update(contracts)
			.set({
				status: 'signed',
				clientSignatoryName: signatoryName,
				clientSignatoryTitle: signatoryTitle || null,
				clientSignedAt: new Date(),
				clientSignatureIp: clientIp,
				updatedAt: new Date()
			})
			.where(eq(contracts.id, contract.id));

		// TODO: Send confirmation email to client
		// TODO: Send notification to agency

		return { success: true };
	}
};

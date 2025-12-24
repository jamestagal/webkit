/**
 * Agencies List Page Server Load
 *
 * Lists all agencies the user belongs to.
 * Redirects to the user's default agency if they only have one.
 */

import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agencies, agencyMemberships, users } from '$lib/server/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw redirect(302, '/login');
	}

	// Get all agencies the user belongs to
	const userAgencies = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			status: agencies.status,
			role: agencyMemberships.role
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(
			and(
				eq(agencyMemberships.userId, userId),
				eq(agencyMemberships.status, 'active'),
				eq(agencies.status, 'active')
			)
		)
		.orderBy(asc(agencies.name));

	// Get user's default agency
	const [user] = await db
		.select({ defaultAgencyId: users.defaultAgencyId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	// Check if user was redirected due to access revocation
	const reason = url.searchParams.get('reason');

	// If user has no agencies, they need to create one
	if (userAgencies.length === 0) {
		return {
			agencies: [],
			defaultAgencyId: null,
			reason,
			showCreatePrompt: true
		};
	}

	// If user has only one agency and no special reason, redirect to it
	const firstAgency = userAgencies[0];
	if (userAgencies.length === 1 && !reason && firstAgency) {
		throw redirect(302, `/${firstAgency.slug}`);
	}

	return {
		agencies: userAgencies,
		defaultAgencyId: user?.defaultAgencyId ?? null,
		reason,
		showCreatePrompt: false
	};
};

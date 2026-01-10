/**
 * Dashboard Page Server Load
 *
 * Loads data for the agency dashboard including:
 * - Consultation counts for statistics
 * - Demo data status (for onboarding)
 * - Profile completeness (for onboarding)
 */

import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { consultations, agencyProfiles } from '$lib/server/schema';
import { eq, and, sql, count } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	// Get agency context from layout
	const { agency } = await parent();
	const agencyId = agency.id;

	// Get consultation count for this agency
	const [consultationStats] = await db
		.select({ count: count() })
		.from(consultations)
		.where(eq(consultations.agencyId, agencyId));

	// Check if demo data exists (consultations with "Demo:" prefix in business name)
	const [demoData] = await db
		.select({ id: consultations.id })
		.from(consultations)
		.where(
			and(
				eq(consultations.agencyId, agencyId),
				sql`${consultations.contactInfo}->>'business_name' LIKE 'Demo:%'`
			)
		)
		.limit(1);

	// Check if agency profile is complete (has required business details)
	const [profile] = await db
		.select({
			abn: agencyProfiles.abn,
			legalEntityName: agencyProfiles.legalEntityName,
			addressLine1: agencyProfiles.addressLine1,
			city: agencyProfiles.city,
			state: agencyProfiles.state,
			postcode: agencyProfiles.postcode
		})
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, agencyId))
		.limit(1);

	// Profile is complete if key business fields are filled
	const isProfileComplete = !!(
		profile &&
		profile.legalEntityName &&
		profile.addressLine1 &&
		profile.city &&
		profile.state &&
		profile.postcode
	);

	const consultationCount = Number(consultationStats?.count ?? 0);

	return {
		consultationCount,
		hasDemoData: !!demoData,
		isProfileComplete,
		isNewAgency: consultationCount === 0
	};
};

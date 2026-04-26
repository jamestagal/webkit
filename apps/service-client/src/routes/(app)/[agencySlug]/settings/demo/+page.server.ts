/**
 * Demo Settings Page Server Load
 *
 * Loads profile completeness status to determine if demo data can be loaded.
 * Demo data requires agency profile to be complete first so that
 * proposals, contracts, and invoices have proper agency details.
 */

import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { agencyProfiles } from "$lib/server/schema";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
	const { agency } = await parent();

	// Check if agency profile is complete
	const [profile] = await db
		.select({
			legalEntityName: agencyProfiles.legalEntityName,
			addressLine1: agencyProfiles.addressLine1,
			city: agencyProfiles.city,
			state: agencyProfiles.state,
			postcode: agencyProfiles.postcode,
		})
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, agency.id))
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

	return {
		isProfileComplete,
	};
};

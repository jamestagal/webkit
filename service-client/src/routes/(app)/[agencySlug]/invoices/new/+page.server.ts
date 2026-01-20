import type { PageServerLoad } from "./$types";
import { getProposals } from "$lib/api/proposals.remote";
import { getContracts } from "$lib/api/contracts.remote";
import { db } from "$lib/server/db";
import { agencyProfiles, agencyPackages, agencyAddons } from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async () => {
	const context = await getAgencyContext();

	// Get agency profile for defaults
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Get packages and addons for line item suggestions
	const [packages, addons] = await Promise.all([
		db.select().from(agencyPackages).where(eq(agencyPackages.agencyId, context.agencyId)),
		db.select().from(agencyAddons).where(eq(agencyAddons.agencyId, context.agencyId)),
	]);

	// Get accepted proposals and signed contracts for quick invoice creation
	const [proposals, contracts] = await Promise.all([
		getProposals({ status: "accepted" }),
		getContracts({ status: "signed" }),
	]);

	return {
		profile,
		packages,
		addons,
		proposals,
		contracts,
	};
};

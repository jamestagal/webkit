import type { PageServerLoad } from "./$types";
import { getQuotation } from "$lib/api/quotations.remote";
import { getScopeTemplates } from "$lib/api/quotation-templates.remote";
import { db } from "$lib/server/db";
import { agencyProfiles } from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq } from "drizzle-orm";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const { quotationId } = params;
	const context = await getAgencyContext();

	const result = await getQuotation(quotationId);

	if (!result) {
		throw error(404, "Quotation not found");
	}

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	const scopeTemplates = await getScopeTemplates({ activeOnly: true });

	return {
		quotation: result.quotation,
		sections: result.sections,
		creatorName: result.creatorName,
		profile,
		scopeTemplates,
	};
};

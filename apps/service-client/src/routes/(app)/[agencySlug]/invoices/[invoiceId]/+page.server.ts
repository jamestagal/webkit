import type { PageServerLoad } from "./$types";
import { getInvoice } from "$lib/api/invoices.remote";
import { db } from "$lib/server/db";
import { agencyProfiles } from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { decryptProfileFields } from "$lib/server/crypto";

export const load: PageServerLoad = async ({ params }) => {
	const { invoiceId } = params;
	const context = await getAgencyContext();

	const result = await getInvoice(invoiceId);

	if (!result) {
		throw error(404, "Invoice not found");
	}

	// Get agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	return {
		invoice: result.invoice,
		lineItems: result.lineItems,
		profile: profile ? decryptProfileFields(profile) : null,
	};
};

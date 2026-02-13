import type { PageServerLoad } from "./$types";
import {
	getQuotationTemplates,
	getScopeTemplates,
} from "$lib/api/quotation-templates.remote";
import { getClientById } from "$lib/api/clients.remote";
import { db } from "$lib/server/db";
import { agencyProfiles } from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ url }) => {
	const context = await getAgencyContext();
	const clientId = url.searchParams.get("clientId");

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	const [templates, scopeTemplates] = await Promise.all([
		getQuotationTemplates({ activeOnly: true }),
		getScopeTemplates({ activeOnly: true }),
	]);

	// Pre-fill client data if clientId provided
	let prefillClient: {
		id: string;
		businessName: string;
		email: string;
		contactName: string | null;
		phone: string | null;
	} | null = null;

	if (clientId) {
		try {
			const client = await getClientById(clientId);
			prefillClient = {
				id: client.id,
				businessName: client.businessName,
				email: client.email,
				contactName: client.contactName,
				phone: client.phone,
			};
		} catch {
			// Client not found, ignore
		}
	}

	return {
		profile,
		templates,
		scopeTemplates,
		prefillClient,
	};
};

import type { PageServerLoad } from "./$types";
import { getClientById } from "$lib/api/clients.remote";

export const load: PageServerLoad = async ({ url }) => {
	const clientId = url.searchParams.get("clientId");

	let prefillClient: { businessName: string; email: string; contactName: string | null; phone: string | null } | null = null;

	if (clientId) {
		try {
			const client = await getClientById(clientId);
			prefillClient = {
				businessName: client.businessName,
				email: client.email,
				contactName: client.contactName,
				phone: client.phone,
			};
		} catch {
			// Client not found, ignore
		}
	}

	return { prefillClient };
};

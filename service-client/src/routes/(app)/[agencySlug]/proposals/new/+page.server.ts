import type { PageServerLoad } from "./$types";
import { getClientById } from "$lib/api/clients.remote";

export const load: PageServerLoad = async ({ url }) => {
	const clientId = url.searchParams.get("clientId");

	let prefillClientId: string | null = null;
	let prefillClientName: string | null = null;

	if (clientId) {
		try {
			const client = await getClientById(clientId);
			prefillClientId = client.id;
			prefillClientName = client.businessName;
		} catch {
			// Client not found, ignore
		}
	}

	return { prefillClientId, prefillClientName };
};

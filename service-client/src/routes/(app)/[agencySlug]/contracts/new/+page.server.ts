import type { PageServerLoad } from "./$types";
import { getProposals } from "$lib/api/proposals.remote";
import { getContractTemplates } from "$lib/api/contract-templates.remote";
import { getClientById } from "$lib/api/clients.remote";

export const load: PageServerLoad = async ({ url }) => {
	const clientId = url.searchParams.get("clientId");

	const [proposals, templates] = await Promise.all([
		// Get proposals that are accepted and don't have contracts yet
		getProposals({ status: "accepted" }),
		getContractTemplates({ activeOnly: true }),
	]);

	// Pre-fill client data if clientId provided (from Quick Create in Client Hub)
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

	return { proposals, templates, prefillClientId, prefillClientName };
};

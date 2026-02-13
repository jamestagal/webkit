import type { PageServerLoad } from "./$types";
import { getClientDocuments } from "$lib/api/clients.remote";
import { getClientEmailLogs } from "$lib/api/email.remote";

export const load: PageServerLoad = async ({ params }) => {
	const { clientId } = params;

	// Get client with all linked documents + email history
	const [data, emailLogs] = await Promise.all([
		getClientDocuments(clientId),
		getClientEmailLogs(clientId),
	]);

	return {
		client: data.client,
		consultations: data.consultations,
		proposals: data.proposals,
		contracts: data.contracts,
		invoices: data.invoices,
		quotations: data.quotations,
		counts: data.counts,
		emailLogs,
	};
};

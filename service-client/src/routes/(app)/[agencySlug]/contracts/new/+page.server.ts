import type { PageServerLoad } from "./$types";
import { getProposals } from "$lib/api/proposals.remote";
import { getContractTemplates } from "$lib/api/contract-templates.remote";

export const load: PageServerLoad = async () => {
	const [proposals, templates] = await Promise.all([
		// Get proposals that are accepted and don't have contracts yet
		getProposals({ status: "accepted" }),
		getContractTemplates({ activeOnly: true }),
	]);

	return { proposals, templates };
};

import type { PageServerLoad } from "./$types";
import { getProposalWithRelations, getClientSEOSummary } from "$lib/api/proposals.remote";
import { getActivePackages } from "$lib/api/agency-packages.remote";
import { getActiveAddons } from "$lib/api/agency-addons.remote";

export const load: PageServerLoad = async ({ params }) => {
	const [{ proposal }, packages, addons] = await Promise.all([
		getProposalWithRelations(params.proposalId),
		getActivePackages(),
		getActiveAddons(),
	]);

	// Fetch SEO summary if proposal has a linked client
	const seoSummary = proposal.clientId ? await getClientSEOSummary(proposal.clientId) : null;

	return { proposal, packages, addons, seoSummary };
};

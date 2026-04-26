import type { PageServerLoad } from "./$types";
import { getProposals } from "$lib/api/proposals.remote";

export const load: PageServerLoad = async () => {
	const proposals = await getProposals({});
	return { proposals };
};

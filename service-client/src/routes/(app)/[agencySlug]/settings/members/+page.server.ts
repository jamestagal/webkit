import { getAgencyMembers } from "$lib/api/agency.remote";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends }) => {
	depends("load:members");
	const members = await getAgencyMembers();
	return { members };
};

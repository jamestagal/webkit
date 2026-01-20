import type { PageServerLoad } from "./$types";
import { getAgencyPackages } from "$lib/api/agency-packages.remote";

export const load: PageServerLoad = async () => {
	const packages = await getAgencyPackages();
	return { packages };
};

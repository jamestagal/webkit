import type { PageServerLoad } from "./$types";
import { getAddonsWithPackages } from "$lib/api/agency-addons.remote";

export const load: PageServerLoad = async () => {
	const addons = await getAddonsWithPackages();
	return { addons };
};

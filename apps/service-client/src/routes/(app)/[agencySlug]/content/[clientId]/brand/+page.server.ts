import type { PageServerLoad } from "./$types";
import { getBrandProfile } from "$lib/api/content-brand.remote";

export const load: PageServerLoad = async ({ params }) => {
	try {
		const brand = await getBrandProfile(params.clientId);
		return { brand };
	} catch {
		return { brand: null };
	}
};

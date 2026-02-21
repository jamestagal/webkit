import type { PageServerLoad } from "./$types";
import { getClientContentOverview } from "$lib/api/content-overview.remote";

export const load: PageServerLoad = async ({ params }) => {
	try {
		const overview = await getClientContentOverview(params.clientId);
		return { overview };
	} catch {
		return { overview: null };
	}
};

import type { PageServerLoad } from "./$types";
import { getContentPages } from "$lib/api/content.remote";

export const load: PageServerLoad = async ({ params }) => {
	const pages = await getContentPages(params.clientId);
	return { pages, clientId: params.clientId };
};

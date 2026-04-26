import type { PageServerLoad } from "./$types";
import { getContentPage } from "$lib/api/content.remote";

export const load: PageServerLoad = async ({ params }) => {
	const contentPage = await getContentPage({
		clientId: params.clientId,
		pageId: params.pageId,
	});
	return { contentPage };
};

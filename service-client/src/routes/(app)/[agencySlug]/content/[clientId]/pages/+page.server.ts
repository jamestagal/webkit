import type { PageServerLoad } from "./$types";
import { getContentPages } from "$lib/api/content.remote";
import { getClientContentOverview } from "$lib/api/content-overview.remote";

export const load: PageServerLoad = async ({ params }) => {
	const [pages, overview] = await Promise.all([
		getContentPages(params.clientId),
		getClientContentOverview(params.clientId).catch(() => null),
	]);
	return {
		pages,
		sourceUrl: overview?.crawl?.source_url ?? "",
	};
};

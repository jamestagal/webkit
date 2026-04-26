import type { PageServerLoad } from "./$types";
import { getSocialPosts } from "$lib/api/content-social.remote";

export const load: PageServerLoad = async ({ params, url }) => {
	const platform = url.searchParams.get("platform") || undefined;
	const status = url.searchParams.get("status") || undefined;
	const posts = await getSocialPosts({ clientId: params.clientId, platform, status });
	return { posts, clientId: params.clientId };
};

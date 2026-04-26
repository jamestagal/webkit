import type { PageServerLoad } from "./$types";
import { getSocialPosts } from "$lib/api/content-social.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const posts = await getSocialPosts({ clientId: params.clientId });
	const post = posts.find((p) => p.id === params.postId) ?? null;
	if (!post) throw error(404, "Social post not found");
	return { post, clientId: params.clientId };
};

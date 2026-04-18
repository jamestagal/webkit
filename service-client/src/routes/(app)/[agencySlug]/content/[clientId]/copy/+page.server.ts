import type { PageServerLoad } from "./$types";
import { getClientCopy } from "$lib/api/content-copy.remote";

export const load: PageServerLoad = async ({ params, url }) => {
	const status = url.searchParams.get("status") || undefined;
	const copyType = url.searchParams.get("copy_type") || undefined;
	const copies = await getClientCopy({
		clientId: params.clientId,
		status,
		copyType,
	});

	// The Go /api/content/copy endpoint returns every row in the copy table —
	// including social_post rows, which have their own Social Posts tab.
	// Filter here so Page Copy only surfaces true page-copy types and
	// doesn't duplicate what Social Posts already shows.
	const pageCopy = copies.filter((c) => c.copy_type !== "social_post");

	return { copies: pageCopy, clientId: params.clientId };
};

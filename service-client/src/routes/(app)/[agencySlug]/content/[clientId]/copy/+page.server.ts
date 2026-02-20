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
	return { copies, clientId: params.clientId };
};

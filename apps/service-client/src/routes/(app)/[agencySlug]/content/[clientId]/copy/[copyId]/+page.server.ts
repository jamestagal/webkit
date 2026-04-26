import type { PageServerLoad } from "./$types";
import { getClientCopy } from "$lib/api/content-copy.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const copies = await getClientCopy({ clientId: params.clientId });
	const copy = copies.find((c) => c.id === params.copyId) ?? null;
	if (!copy) {
		throw error(404, "Copy not found");
	}
	return { copy, clientId: params.clientId };
};

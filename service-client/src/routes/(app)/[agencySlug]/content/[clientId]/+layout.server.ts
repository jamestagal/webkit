import type { LayoutServerLoad } from "./$types";
import { getClientById } from "$lib/api/clients.remote";

export const load: LayoutServerLoad = async ({ params }) => {
	const client = await getClientById(params.clientId);
	return { client };
};

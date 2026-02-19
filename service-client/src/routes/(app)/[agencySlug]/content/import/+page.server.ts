import type { PageServerLoad } from "./$types";
import { getClients } from "$lib/api/clients.remote";

export const load: PageServerLoad = async () => {
	const clients = await getClients({ status: "active" });
	return { clients };
};

import type { PageServerLoad } from "./$types";
import { getClientsWithCrawls } from "$lib/api/content.remote";

export const load: PageServerLoad = async () => {
	const data = await getClientsWithCrawls();
	return data;
};

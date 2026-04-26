import type { PageServerLoad } from "./$types";
import { getClientsWithContentStatus } from "$lib/api/content.remote";

export const load: PageServerLoad = async () => {
	const clientStatuses = await getClientsWithContentStatus();
	return { clientStatuses };
};

import type { PageServerLoad } from "./$types";
import { getClientReports } from "$lib/api/content-audit.remote";

export const load: PageServerLoad = async ({ params }) => {
	const reports = await getClientReports(params.clientId);
	return { reports };
};

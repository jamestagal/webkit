import type { PageServerLoad } from "./$types";
import { getClientAudits } from "$lib/api/content-audit.remote";
import { getAudit } from "$lib/api/content-audit.remote";

export const load: PageServerLoad = async ({ params }) => {
	const audits = await getClientAudits(params.clientId);
	let latestAudit = null;
	const first = audits[0];
	if (first) {
		try {
			latestAudit = await getAudit(first.id);
		} catch {
			latestAudit = null;
		}
	}
	return { audits, latestAudit, clientId: params.clientId };
};

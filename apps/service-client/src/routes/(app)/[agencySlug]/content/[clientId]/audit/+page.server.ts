import type { PageServerLoad } from "./$types";
import { getClientAudits, getAudit, getShareStatus } from "$lib/api/content-audit.remote";

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

	let shareStatus = null;
	if (first && latestAudit?.status === "complete") {
		try {
			shareStatus = await getShareStatus(first.id);
		} catch {
			shareStatus = null;
		}
	}

	return { audits, latestAudit, clientId: params.clientId, shareStatus };
};

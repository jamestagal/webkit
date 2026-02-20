import type { PageServerLoad } from "./$types";
import { getClientAudits, getAuditCompetitors } from "$lib/api/content-audit.remote";

export const load: PageServerLoad = async ({ params }) => {
	const audits = await getClientAudits(params.clientId);
	const first = audits[0];
	if (!first) return { competitors: null };
	try {
		const competitors = await getAuditCompetitors(first.id);
		return { competitors };
	} catch {
		return { competitors: null };
	}
};

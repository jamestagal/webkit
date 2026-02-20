import type { PageServerLoad } from "./$types";
import { getClientAudits, getAuditBacklinks } from "$lib/api/content-audit.remote";

export const load: PageServerLoad = async ({ params }) => {
	const audits = await getClientAudits(params.clientId);
	const first = audits[0];
	if (!first) return { backlinks: null };
	try {
		const backlinks = await getAuditBacklinks(first.id);
		return { backlinks };
	} catch {
		return { backlinks: null };
	}
};

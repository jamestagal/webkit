import type { PageServerLoad } from "./$types";
import { getClientAudits, getAuditKeywords } from "$lib/api/content-audit.remote";

export const load: PageServerLoad = async ({ params }) => {
	const audits = await getClientAudits(params.clientId);
	const first = audits[0];
	if (!first) return { keywords: null };
	try {
		const keywords = await getAuditKeywords(first.id);
		return { keywords };
	} catch (e) {
		console.error("[content audit keywords load]", e);
		return { keywords: null };
	}
};

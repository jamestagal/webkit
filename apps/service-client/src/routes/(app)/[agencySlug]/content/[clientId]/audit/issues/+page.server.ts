import type { PageServerLoad } from "./$types";
import { getClientAudits, getAuditIssues } from "$lib/api/content-audit.remote";

export const load: PageServerLoad = async ({ params, url }) => {
	const audits = await getClientAudits(params.clientId);
	const first = audits[0];
	if (!first) return { issues: null, auditId: null };

	const auditId = first.id;
	const category = url.searchParams.get("category") || undefined;
	const severity = url.searchParams.get("severity") || undefined;
	const page = Number(url.searchParams.get("page")) || 1;
	const perPage = Number(url.searchParams.get("per_page")) || 20;

	try {
		const issues = await getAuditIssues({ auditId, category, severity, page, perPage });
		return { issues, auditId };
	} catch {
		return { issues: null, auditId };
	}
};

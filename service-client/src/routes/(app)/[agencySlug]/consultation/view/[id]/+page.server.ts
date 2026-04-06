import type { PageServerLoad } from "./$types";
import { getFieldOptionSets, getFormTemplateBySlug } from "$lib/api/forms.remote";
import { db } from "$lib/server/db";
import { consultations, seoAudits } from "$lib/server/schema";
import { eq, and, desc } from "drizzle-orm";

export const load: PageServerLoad = async ({ params }) => {
	const consultationId = params.id;

	// Load option sets for form rendering
	const optionSets = await getFieldOptionSets();

	// Load Full Discovery template as default schema fallback
	let fallbackTemplate = null;
	try {
		fallbackTemplate = await getFormTemplateBySlug("full-discovery");
	} catch {
		// Template may not exist
	}

	// Fetch consultation's clientId to look up SEO audit PageSpeed data
	let auditPerformanceData = null;
	let auditCompletedAt: Date | null = null;
	const [consultation] = await db
		.select({ clientId: consultations.clientId })
		.from(consultations)
		.where(eq(consultations.id, consultationId))
		.limit(1);

	if (consultation?.clientId) {
		const [audit] = await db
			.select({
				performanceData: seoAudits.performanceData,
				completedAt: seoAudits.completedAt,
			})
			.from(seoAudits)
			.where(
				and(
					eq(seoAudits.clientId, consultation.clientId),
					eq(seoAudits.status, "complete"),
				),
			)
			.orderBy(desc(seoAudits.completedAt))
			.limit(1);

		if (audit?.performanceData && typeof audit.performanceData === "object") {
			auditPerformanceData = audit.performanceData;
			auditCompletedAt = audit.completedAt;
		}
	}

	return {
		consultationId,
		optionSets,
		fallbackTemplate,
		auditPerformanceData,
		auditCompletedAt,
	};
};

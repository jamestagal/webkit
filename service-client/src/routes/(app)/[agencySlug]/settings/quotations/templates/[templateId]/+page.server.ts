import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import {
	getQuotationTemplate,
	getScopeTemplates,
	getTermsTemplates,
} from "$lib/api/quotation-templates.remote";

export const load: PageServerLoad = async ({ params }) => {
	const [templateData, scopeTemplates, termsTemplates] = await Promise.all([
		getQuotationTemplate(params.templateId),
		getScopeTemplates({ activeOnly: true }),
		getTermsTemplates({ activeOnly: true }),
	]);

	if (!templateData) {
		throw error(404, "Template not found");
	}

	return {
		...templateData,
		scopeTemplates,
		termsTemplates,
	};
};

import type { PageServerLoad } from "./$types";
import { getScopeTemplates, getTermsTemplates, getQuotationTemplates } from "$lib/api/quotation-templates.remote";

export const load: PageServerLoad = async () => {
	const [scopeTemplates, termsTemplates, quotationTemplates] = await Promise.all([
		getScopeTemplates({ activeOnly: true }),
		getTermsTemplates({ activeOnly: true }),
		getQuotationTemplates({ activeOnly: true }),
	]);

	return {
		scopeCount: scopeTemplates.length,
		termsCount: termsTemplates.length,
		templateCount: quotationTemplates.length,
	};
};

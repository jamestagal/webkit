import type { PageServerLoad } from "./$types";
import { getQuotationTemplates } from "$lib/api/quotation-templates.remote";

export const load: PageServerLoad = async () => {
	const templates = await getQuotationTemplates({ activeOnly: false });
	return { templates };
};

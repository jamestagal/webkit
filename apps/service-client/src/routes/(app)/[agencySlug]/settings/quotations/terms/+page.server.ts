import type { PageServerLoad } from "./$types";
import { getTermsTemplates } from "$lib/api/quotation-templates.remote";

export const load: PageServerLoad = async () => {
	const templates = await getTermsTemplates({ activeOnly: false });
	return { templates };
};

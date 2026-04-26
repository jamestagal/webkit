import type { PageServerLoad } from "./$types";
import { getScopeTemplates } from "$lib/api/quotation-templates.remote";

export const load: PageServerLoad = async () => {
	const templates = await getScopeTemplates({ activeOnly: false });
	return { templates };
};

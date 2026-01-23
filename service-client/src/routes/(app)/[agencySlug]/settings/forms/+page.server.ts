import type { PageServerLoad } from "./$types";
import { getAgencyForms, getFormTemplates } from "$lib/api/forms.remote";

export const load: PageServerLoad = async () => {
	const [forms, templates] = await Promise.all([getAgencyForms({}), getFormTemplates({})]);

	return { forms, templates };
};

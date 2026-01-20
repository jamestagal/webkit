import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	// No data needed for the new questionnaire form
	return {};
};

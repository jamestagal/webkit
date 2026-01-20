import type { PageServerLoad } from "./$types";
import { getQuestionnaires } from "$lib/api/questionnaire.remote";

export const load: PageServerLoad = async () => {
	const questionnaires = await getQuestionnaires({});
	return { questionnaires };
};

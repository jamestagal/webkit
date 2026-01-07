import type { PageServerLoad } from './$types';
import { getQuestionnaireById } from '$lib/api/questionnaire.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { questionnaireId } = params;

	try {
		const questionnaire = await getQuestionnaireById(questionnaireId);
		return { questionnaire };
	} catch (err) {
		throw error(404, 'Questionnaire not found');
	}
};

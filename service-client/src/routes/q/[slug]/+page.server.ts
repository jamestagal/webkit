/**
 * Public Questionnaire View - Server Load
 *
 * Loads questionnaire by contract slug without authentication.
 * Checks access control (contract signed + invoice paid).
 */

import type { PageServerLoad } from './$types';
import { checkQuestionnaireAccess } from '$lib/api/questionnaire.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	// Check access and get questionnaire data
	const result = await checkQuestionnaireAccess(slug);

	if (result.reason === 'contract_not_found') {
		throw error(404, 'Questionnaire not found');
	}

	return {
		allowed: result.allowed,
		reason: result.reason,
		contract: result.contract || null,
		agency: result.agency || null,
		agencyProfile: result.agencyProfile || null,
		questionnaire: result.questionnaire || null
	};
};

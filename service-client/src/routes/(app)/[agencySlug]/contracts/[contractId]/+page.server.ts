import type { PageServerLoad } from './$types';
import { getContractWithRelations } from '$lib/api/contracts.remote';
import { getQuestionnaireByContract } from '$lib/api/questionnaire.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const result = await getContractWithRelations(params.contractId);

	if (!result?.contract) {
		throw error(404, 'Contract not found');
	}

	// Load questionnaire data if contract is signed
	let questionnaire = null;
	if (['signed', 'completed'].includes(result.contract.status)) {
		try {
			questionnaire = await getQuestionnaireByContract(params.contractId);
		} catch {
			// Questionnaire may not exist yet
		}
	}

	return {
		contract: result.contract,
		proposal: result.proposal,
		template: result.template,
		questionnaire
	};
};

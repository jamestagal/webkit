import type { PageServerLoad } from './$types';
import { getContractWithRelations } from '$lib/api/contracts.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const result = await getContractWithRelations(params.contractId);

	if (!result?.contract) {
		throw error(404, 'Contract not found');
	}

	return {
		contract: result.contract,
		proposal: result.proposal,
		template: result.template
	};
};

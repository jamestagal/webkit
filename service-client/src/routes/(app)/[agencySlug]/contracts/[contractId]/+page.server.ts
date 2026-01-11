import type { PageServerLoad } from './$types';
import { getContractWithRelations } from '$lib/api/contracts.remote';
import { getAllActiveSchedules } from '$lib/api/contract-templates.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const result = await getContractWithRelations(params.contractId);

	if (!result?.contract) {
		throw error(404, 'Contract not found');
	}

	// Load available schedule sections for selection
	let availableSchedules: Awaited<ReturnType<typeof getAllActiveSchedules>> = [];
	try {
		availableSchedules = await getAllActiveSchedules();
	} catch {
		// Templates may not exist
	}

	return {
		contract: result.contract,
		proposal: result.proposal,
		template: result.template,
		availableSchedules
	};
};

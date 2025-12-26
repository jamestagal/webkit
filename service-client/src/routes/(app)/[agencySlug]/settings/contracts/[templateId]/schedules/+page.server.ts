import type { PageServerLoad } from './$types';
import { getContractTemplate, getContractSchedules } from '$lib/api/contract-templates.remote';
import { getAgencyPackages } from '$lib/api/agency-packages.remote';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const [result, schedules, packages] = await Promise.all([
		getContractTemplate(params.templateId),
		getContractSchedules(params.templateId),
		getAgencyPackages()
	]);

	if (!result?.template) {
		throw error(404, 'Template not found');
	}

	return {
		template: result.template,
		schedules,
		packages
	};
};

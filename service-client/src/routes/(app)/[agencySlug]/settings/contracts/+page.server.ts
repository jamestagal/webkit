import type { PageServerLoad } from './$types';
import { getContractTemplates } from '$lib/api/contract-templates.remote';

export const load: PageServerLoad = async () => {
	const templates = await getContractTemplates({ activeOnly: false });
	return { templates };
};

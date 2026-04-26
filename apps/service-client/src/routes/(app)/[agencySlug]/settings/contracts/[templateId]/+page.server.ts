import type { PageServerLoad } from "./$types";
import { getContractTemplate } from "$lib/api/contract-templates.remote";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
	const result = await getContractTemplate(params.templateId);

	if (!result?.template) {
		throw error(404, "Template not found");
	}

	return {
		template: result.template,
		schedules: result.schedules,
	};
};

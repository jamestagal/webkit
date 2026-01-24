import type { PageServerLoad } from "./$types";
import { getFieldOptionSets, getFormTemplateBySlug } from "$lib/api/forms.remote";

export const load: PageServerLoad = async ({ params }) => {
	const consultationId = params.id;

	// Load option sets for form rendering
	const optionSets = await getFieldOptionSets();

	// Load Full Discovery template as default schema fallback
	let fallbackTemplate = null;
	try {
		fallbackTemplate = await getFormTemplateBySlug("full-discovery");
	} catch {
		// Template may not exist
	}

	return {
		consultationId,
		optionSets,
		fallbackTemplate,
	};
};

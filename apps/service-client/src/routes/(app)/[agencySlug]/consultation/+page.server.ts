import type { PageServerLoad } from "./$types";
import { getDefaultForm, getFieldOptionSets, getFormTemplateBySlug } from "$lib/api/forms.remote";
import { getAgencyForms } from "$lib/api/forms.remote";
import { getClientById } from "$lib/api/clients.remote";

export const load: PageServerLoad = async ({ url }) => {
	const clientId = url.searchParams.get("clientId");

	// Load agency's consultation forms
	const consultationForms = await getAgencyForms({ formType: "consultation", activeOnly: true });

	// Load default consultation form
	const defaultForm = await getDefaultForm("consultation");

	// Load Full Discovery template as fallback
	let fullDiscoveryTemplate = null;
	if (!defaultForm && consultationForms.length === 0) {
		try {
			fullDiscoveryTemplate = await getFormTemplateBySlug("full-discovery");
		} catch {
			// Template may not exist yet
		}
	}

	// Load option sets for form rendering
	const optionSets = await getFieldOptionSets();

	// Pre-fill client data if clientId provided
	let prefillClient = null;
	if (clientId) {
		try {
			prefillClient = await getClientById(clientId);
		} catch {
			// Client not found, continue without prefill
		}
	}

	return {
		consultationForms,
		defaultForm,
		fullDiscoveryTemplate,
		optionSets,
		prefillClient,
	};
};

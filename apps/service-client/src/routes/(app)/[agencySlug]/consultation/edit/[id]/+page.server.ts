import type { PageServerLoad } from "./$types";
import { getFieldOptionSets, getFormTemplateBySlug, getFormById } from "$lib/api/forms.remote";
import { getConsultation } from "$lib/api/consultation.remote";
import { consultationToFormData } from "$lib/utils/consultation-field-map";
import { buildFormSchema } from "$lib/components/form-builder/utils/schema-generator";

export const load: PageServerLoad = async ({ params }) => {
	const consultationId = params.id;

	// Load consultation data server-side (critical: avoids top-level await in page component)
	const consultation = await getConsultation(consultationId);

	// Resolve form schema from consultation's formId or fallback template
	let formSchema = null;
	let formName = "Consultation";
	let formDescription: string | null = null;

	if (consultation.formId) {
		try {
			const form = await getFormById(consultation.formId);
			formSchema = buildFormSchema(form.schema, form.uiConfig);
			formName = form.name;
			formDescription = form.description;
		} catch {
			// Form may have been deleted
		}
	}

	// Load Full Discovery template as default schema fallback
	let fallbackTemplate = null;
	if (!formSchema) {
		try {
			fallbackTemplate = await getFormTemplateBySlug("full-discovery");
			formSchema = buildFormSchema(fallbackTemplate.schema, fallbackTemplate.uiConfig);
			formName = fallbackTemplate.name;
			formDescription = fallbackTemplate.description;
		} catch {
			// Template may not exist
		}
	}

	// Load option sets for form rendering
	const optionSets = await getFieldOptionSets();

	// Build initial data from consultation columns + customData
	const initialData = consultationToFormData(
		consultation as unknown as Record<string, unknown>,
		(consultation.customData as Record<string, unknown>) ?? undefined,
	);

	return {
		consultationId,
		consultation,
		formSchema,
		formName,
		formDescription,
		optionSets,
		initialData,
	};
};

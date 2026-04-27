import type { PageServerLoad } from "./$types";
import { getSubmissionBySlug } from "$lib/api/forms.remote";
import { error } from "@sveltejs/kit";
import { getEffectiveBranding } from "$lib/server/document-branding";

export const load: PageServerLoad = async ({ params }) => {
	try {
		const result = await getSubmissionBySlug(params.slug);

		// Resolve effective branding for the form document type. Single source
		// of truth for all colors + logo on the rendered page — do not read
		// colors from `agency`. The FormDocument wrapper converts this to HSL
		// for DaisyUI and injects `--p`/`--s`/`--a` alongside `--brand-*`.
		const branding = await getEffectiveBranding(result.agency.id, "form");

		const {
			logoUrl: _logoUrl,
			primaryColor: _primaryColor,
			secondaryColor: _secondaryColor,
			accentColor: _accentColor,
			accentGradient: _accentGradient,
			...agencyWithoutBranding
		} = result.agency;

		return {
			submission: result.submission,
			form: result.form,
			agency: agencyWithoutBranding,
			branding,
		};
	} catch {
		throw error(404, "Form not found");
	}
};

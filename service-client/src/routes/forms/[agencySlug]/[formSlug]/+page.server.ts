import type { PageServerLoad, Actions } from "./$types";
import { getFormBySlug, submitForm } from "$lib/api/forms.remote";
import { error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { agencies } from "$lib/server/schema";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ params }) => {
	// Get agency by slug
	const [agency] = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			secondaryColor: agencies.secondaryColor,
			accentColor: agencies.accentColor,
			accentGradient: agencies.accentGradient,
		})
		.from(agencies)
		.where(eq(agencies.slug, params.agencySlug));

	if (!agency) {
		throw error(404, "Agency not found");
	}

	// Get form by slug (public endpoint)
	const form = await getFormBySlug({
		agencySlug: params.agencySlug,
		formSlug: params.formSlug,
	});

	if (!form) {
		throw error(404, "Form not found");
	}

	// Check if form requires authentication
	if (form.requiresAuth) {
		// For now, we'll just show an error. In production, redirect to login.
		throw error(403, "This form requires authentication");
	}

	return {
		agency: {
			id: agency.id,
			name: agency.name,
			slug: agency.slug,
			logoUrl: agency.logoUrl,
			primaryColor: agency.primaryColor,
			secondaryColor: agency.secondaryColor,
			accentColor: agency.accentColor,
			accentGradient: agency.accentGradient,
		},
		form,
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formData = await request.formData();
		const data = Object.fromEntries(formData.entries());

		// Get the form to get its ID
		const form = await getFormBySlug({
			agencySlug: params.agencySlug,
			formSlug: params.formSlug,
		});

		if (!form) {
			return { success: false, error: "Form not found" };
		}

		try {
			await submitForm({
				formId: form.id,
				data,
				metadata: {
					userAgent: request.headers.get("user-agent"),
					submittedAt: new Date().toISOString(),
				},
			});

			return { success: true };
		} catch (err) {
			console.error("Form submission error:", err);
			return { success: false, error: "Failed to submit form" };
		}
	},
};

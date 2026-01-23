<script lang="ts">
	/**
	 * Public Form Page
	 *
	 * Renders a public form with agency branding for client submissions.
	 */
	import { DynamicForm } from "$lib/components/form-renderer";
	import { submitForm } from "$lib/api/forms.remote";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import type { PageProps } from "./$types";
	import type { ResolvedBranding } from "$lib/types/branding";
	import type { FormSchema, FormUIConfig } from "$lib/types/form-builder";
	import { defaultAgencyBranding } from "$lib/types/branding";

	const toast = getToast();
	let { data }: PageProps = $props();

	// Build resolved branding from agency data columns
	let branding = $derived.by((): ResolvedBranding => {
		// Build branding from individual agency columns, spreading defaults first
		const colors = {
			...defaultAgencyBranding.colors,
			primary: data.agency.primaryColor || defaultAgencyBranding.colors.primary,
			secondary: data.agency.secondaryColor || defaultAgencyBranding.colors.secondary,
			accent: data.agency.accentColor || defaultAgencyBranding.colors.accent,
		};

		return {
			...defaultAgencyBranding,
			colors,
			logo: data.agency.logoUrl ? { url: data.agency.logoUrl, position: "center" as const } : undefined,
		};
	});

	// Handle form submission
	async function handleSubmit(formData: Record<string, unknown>) {
		try {
			await submitForm({
				formId: data.form.id,
				data: formData,
				metadata: {
					submittedAt: new Date().toISOString(),
				},
			});
		} catch (err) {
			toast.error("Failed to submit form", err instanceof Error ? err.message : "");
			throw err; // Re-throw to let DynamicForm handle the error state
		}
	}

	function handleSuccess() {
		// Optional: Additional success handling like analytics
	}
</script>

<svelte:head>
	<title>{data.form.name} | {data.agency.name}</title>
	<meta name="description" content={data.form.description || `${data.form.name} - ${data.agency.name}`} />
</svelte:head>

<div class="min-h-screen bg-base-200">
	<DynamicForm
		schema={data.form.schema as FormSchema}
		branding={branding}
		onSubmit={handleSubmit}
		onSuccess={handleSuccess}
		submitButtonText={(data.form.uiConfig as FormUIConfig | null)?.submitButtonText}
		successMessage={(data.form.uiConfig as FormUIConfig | null)?.successMessage}
	/>
</div>

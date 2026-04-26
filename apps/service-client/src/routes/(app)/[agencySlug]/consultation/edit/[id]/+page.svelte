<script lang="ts">
	/**
	 * Consultation Edit Page (DynamicForm with Save)
	 *
	 * All data is loaded in +page.server.ts to avoid top-level await.
	 * This prevents SvelteKit from remounting the component when command() runs,
	 * which would reset DynamicForm's currentStepIndex.
	 */

	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import DynamicForm from "$lib/components/form-renderer/DynamicForm.svelte";
	import { updateDynamicConsultation } from "$lib/api/consultation.remote";
	import { mapFormDataToConsultation } from "$lib/utils/consultation-field-map";
	import type { ResolvedBranding } from "$lib/types/branding";
	import { defaultAgencyBranding } from "$lib/types/branding";
	import { hexToHsl } from "$lib/components/form-renderer/utils/theme-generator";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const agencySlug = page.params.agencySlug;

	// All data comes from +page.server.ts — no top-level await needed
	const consultation = data.consultation;
	const formSchema = data.formSchema;
	const formName = data.formName;
	const formDescription = data.formDescription;
	const initialData = data.initialData;

	// Agency branding (from parent layout)
	function toHsl(hex: string | null | undefined): string | undefined {
		if (!hex) return undefined;
		return hex.startsWith("#") ? hexToHsl(hex) : hex;
	}

	const agency = data.agency;
	let branding = $derived.by((): ResolvedBranding => {
		const colors: ResolvedBranding["colors"] = {
			...defaultAgencyBranding.colors,
			primary: toHsl(agency?.primaryColor) || defaultAgencyBranding.colors.primary,
		};
		const sec = toHsl(agency?.secondaryColor);
		if (sec) colors.secondary = sec;
		const acc = toHsl(agency?.accentColor);
		if (acc) colors.accent = acc;
		return {
			...defaultAgencyBranding,
			colors,
			logo: agency?.logoUrl ? { url: agency.logoUrl, position: "center" as const } : undefined,
		} as ResolvedBranding;
	});

	// Resolved branding with form header
	let resolvedBranding = $derived.by((): ResolvedBranding => {
		const header: { title: string; subtitle?: string } = { title: formName };
		if (formDescription) header.subtitle = formDescription;
		return {
			...branding,
			formOverrides: { header },
		};
	});

	// State
	let saving = $state(false);
	let error = $state<string | null>(null);

	function extractError(e: unknown, fallback: string): string {
		if (e instanceof Error) return e.message;
		if (e && typeof e === "object" && "body" in e) {
			const body = (e as { body: { message?: string } }).body;
			if (body?.message) return body.message;
		}
		return fallback;
	}

	// Step change handler (auto-save on next)
	async function handleStepChange(
		direction: "next" | "prev",
		_stepIndex: number,
		formData: Record<string, unknown>,
	) {
		if (direction === "prev") return;

		saving = true;
		error = null;

		try {
			const { mapped, custom } = mapFormDataToConsultation(formData);
			await updateDynamicConsultation({
				consultationId: consultation.id,
				...mapped,
				customData: Object.keys(custom).length > 0 ? custom : undefined,
			});
		} catch (e) {
			error = extractError(e, "Failed to save progress");
			throw e;
		} finally {
			saving = false;
		}
	}

	// Explicit save handler
	async function handleSave(formData: Record<string, unknown>) {
		saving = true;
		error = null;

		try {
			const { mapped, custom } = mapFormDataToConsultation(formData);
			await updateDynamicConsultation({
				consultationId: consultation.id,
				...mapped,
				customData: Object.keys(custom).length > 0 ? custom : undefined,
			});
		} catch (e) {
			error = extractError(e, "Failed to save");
		} finally {
			saving = false;
		}
	}

	// Final submit handler
	async function handleSubmit(formData: Record<string, unknown>) {
		saving = true;
		error = null;

		try {
			const { mapped, custom } = mapFormDataToConsultation(formData);
			await updateDynamicConsultation({
				consultationId: consultation.id,
				...mapped,
				customData: Object.keys(custom).length > 0 ? custom : undefined,
				status: "completed",
			});

			goto(`/${agencySlug}/consultation/view/${consultation.id}`);
		} catch (e) {
			error = extractError(e, "Failed to submit consultation");
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Edit {consultation.businessName || "Consultation"} | Webkit</title>
</svelte:head>

<div class="min-h-screen bg-base-200 py-8">
	<div class="mx-auto max-w-4xl px-4">
		<!-- Header -->
		<div class="mb-6">
			<button
				type="button"
				onclick={() => goto(`/${agencySlug}/consultation/view/${consultation.id}`)}
				class="mb-4 inline-flex items-center text-sm text-base-content/60 hover:text-base-content"
			>
				<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				Back to View
			</button>
			<h1 class="text-2xl font-bold text-base-content">
				Edit: {consultation.businessName || "Consultation"}
			</h1>
		</div>

		{#if error}
			<div class="alert alert-error mb-4">
				<span>{error}</span>
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (error = null)}>
					Dismiss
				</button>
			</div>
		{/if}

		{#if saving}
			<div class="fixed top-4 right-4 z-50">
				<div class="alert alert-info shadow-lg">
					<span class="loading loading-spinner loading-sm"></span>
					<span>Saving...</span>
				</div>
			</div>
		{/if}

		{#if formSchema}
			<DynamicForm
				schema={formSchema}
				branding={resolvedBranding}
				optionSets={data.optionSets}
				{initialData}
				showSaveButton={true}
				onStepChange={handleStepChange}
				onSave={handleSave}
				onSubmit={handleSubmit}
			/>
		{:else}
			<div class="alert alert-warning">
				<span>No form schema available for editing. The form template may have been removed.</span>
			</div>
		{/if}
	</div>
</div>

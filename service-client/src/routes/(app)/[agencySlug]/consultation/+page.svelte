<script lang="ts">
	/**
	 * Agency-Scoped Consultation Page (DynamicForm)
	 *
	 * Uses DynamicForm with the agency's consultation form schema.
	 * Supports lazy creation (consultation created on first step advancement).
	 */

	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import DynamicForm from "$lib/components/form-renderer/DynamicForm.svelte";
	import ClientPickerStep from "$lib/components/consultation/ClientPickerStep.svelte";
	import {
		createDynamicConsultation,
		updateDynamicConsultation,
	} from "$lib/api/consultation.remote";
	import { mapFormDataToConsultation } from "$lib/utils/consultation-field-map";
	import { buildFormSchema } from "$lib/components/form-builder/utils/schema-generator";
	import type { FormSchema } from "$lib/types/form-builder";
	import type { ResolvedBranding } from "$lib/types/branding";
	import { defaultAgencyBranding } from "$lib/types/branding";
	import { hexToHsl } from "$lib/components/form-renderer/utils/theme-generator";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const agencySlug = page.params.agencySlug;

	// Agency branding (from parent layout)
	// Colors from DB are hex - convert to HSL for theme generator
	function toHsl(hex: string | null | undefined): string | undefined {
		if (!hex) return undefined;
		return hex.startsWith("#") ? hexToHsl(hex) : hex;
	}

	const agency = $derived(data.agency);
	let branding = $derived.by((): ResolvedBranding => {
		const colors: ResolvedBranding["colors"] = {
			...defaultAgencyBranding.colors,
			primary: toHsl(agency.primaryColor) || defaultAgencyBranding.colors.primary,
		};
		const sec = toHsl(agency.secondaryColor);
		if (sec) colors.secondary = sec;
		const acc = toHsl(agency.accentColor);
		if (acc) colors.accent = acc;
		return {
			...defaultAgencyBranding,
			colors,
			logo: agency.logoUrl ? { url: agency.logoUrl, position: "center" as const } : undefined,
		} as ResolvedBranding;
	});

	// State
	let phase = $state<"pick-client" | "pick-form" | "filling">("pick-client");
	let selectedForm = $state<{ schema: FormSchema; id?: string; name?: string; description?: string | null } | null>(null);
	let consultationId = $state<string | null>(null);
	let prefillData = $state<Record<string, unknown>>({});
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Determine form options
	const forms = $derived(data.consultationForms ?? []);
	const defaultForm = $derived(data.defaultForm);
	const fallbackTemplate = $derived(data.fullDiscoveryTemplate);

	// Skip client picker if prefillClient exists
	if (data.prefillClient) {
		prefillData = {
			businessName: data.prefillClient.businessName,
			email: data.prefillClient.email,
			contactPerson: data.prefillClient.contactName ?? "",
			phone: data.prefillClient.phone ?? "",
		};
		phase = "pick-form";
		autoSelectForm();
	}

	function autoSelectForm() {
		// Auto-select: default form > first form > fallback template
		if (defaultForm) {
			selectedForm = { schema: buildFormSchema(defaultForm.schema, defaultForm.uiConfig), id: defaultForm.id, name: defaultForm.name, description: defaultForm.description };
			phase = "filling";
		} else if (forms.length === 1 && forms[0]) {
			selectedForm = { schema: buildFormSchema(forms[0].schema, forms[0].uiConfig), id: forms[0].id, name: forms[0].name, description: forms[0].description };
			phase = "filling";
		} else if (forms.length === 0 && fallbackTemplate) {
			selectedForm = { schema: buildFormSchema(fallbackTemplate.schema, fallbackTemplate.uiConfig), name: fallbackTemplate.name, description: fallbackTemplate.description };
			phase = "filling";
		} else if (forms.length > 1) {
			phase = "pick-form";
		} else {
			// No forms available at all
			error = "No consultation form configured. Please contact your administrator.";
		}
	}

	// Client picker handlers
	function handleClientSelect(client: {
		id: string;
		businessName: string;
		email: string;
		contactName: string | null;
		phone: string | null;
	}) {
		prefillData = {
			businessName: client.businessName,
			email: client.email,
			contactPerson: client.contactName ?? "",
			phone: client.phone ?? "",
		};
		autoSelectForm();
	}

	function handleClientSkip() {
		autoSelectForm();
	}

	// Form picker handler
	function selectForm(form: (typeof forms)[0]) {
		selectedForm = { schema: buildFormSchema(form.schema, form.uiConfig), id: form.id, name: form.name, description: form.description };
		phase = "filling";
	}

	// Step change handler (lazy create + step save)
	async function handleStepChange(
		direction: "next" | "prev",
		_stepIndex: number,
		formData: Record<string, unknown>,
	) {
		if (direction === "prev") return; // Don't save on back

		saving = true;
		error = null;

		try {
			const { mapped, custom } = mapFormDataToConsultation(formData);

			if (!consultationId) {
				// First step advancement → create consultation
				const result = await createDynamicConsultation({
					...mapped,
					formId: selectedForm?.id,
					customData: Object.keys(custom).length > 0 ? custom : undefined,
					status: "draft",
				});
				consultationId = result.consultationId;
			} else {
				// Subsequent steps → update
				await updateDynamicConsultation({
					consultationId,
					...mapped,
					customData: Object.keys(custom).length > 0 ? custom : undefined,
				});
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to save progress";
			throw e; // Abort step transition
		} finally {
			saving = false;
		}
	}

	// Save button handler
	async function handleSave(formData: Record<string, unknown>) {
		saving = true;
		error = null;

		try {
			const { mapped, custom } = mapFormDataToConsultation(formData);

			if (!consultationId) {
				const result = await createDynamicConsultation({
					...mapped,
					formId: selectedForm?.id,
					customData: Object.keys(custom).length > 0 ? custom : undefined,
					status: "draft",
				});
				consultationId = result.consultationId;
			} else {
				await updateDynamicConsultation({
					consultationId,
					...mapped,
					customData: Object.keys(custom).length > 0 ? custom : undefined,
				});
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to save";
		} finally {
			saving = false;
		}
	}

	// Form branding overrides (header title/subtitle from selected form)
	let resolvedBranding = $derived.by((): ResolvedBranding => {
		const header: { title: string; subtitle?: string } = {
			title: selectedForm?.name || "Consultation",
		};
		if (selectedForm?.description) header.subtitle = selectedForm.description;
		return {
			...branding,
			formOverrides: { header },
		};
	});

	// Final submit handler
	async function handleSubmit(formData: Record<string, unknown>) {
		saving = true;
		error = null;

		try {
			const { mapped, custom } = mapFormDataToConsultation(formData);

			if (!consultationId) {
				// Submit without prior saves
				const result = await createDynamicConsultation({
					...mapped,
					formId: selectedForm?.id,
					customData: Object.keys(custom).length > 0 ? custom : undefined,
					status: "completed",
				});
				consultationId = result.consultationId;
			} else {
				await updateDynamicConsultation({
					consultationId,
					...mapped,
					customData: Object.keys(custom).length > 0 ? custom : undefined,
					status: "completed",
				});
			}

			goto(`/${agencySlug}/consultation/view/${consultationId}`);
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to submit consultation";
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>New Consultation | Webkit</title>
</svelte:head>

<div class="min-h-screen bg-base-200 py-8">
	<div class="mx-auto max-w-4xl px-4">
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

		{#if phase === "pick-client"}
			<ClientPickerStep onSelect={handleClientSelect} onSkip={handleClientSkip} />
		{:else if phase === "pick-form" && forms.length > 1}
			<div class="max-w-2xl mx-auto">
				<h2 class="text-xl font-semibold text-base-content mb-4">Select Form</h2>
				<p class="text-sm text-base-content/60 mb-6">
					Choose which consultation form to use.
				</p>
				<div class="space-y-3">
					{#each forms as form}
						<button
							type="button"
							class="w-full text-left p-4 bg-base-100 rounded-lg border border-base-300 hover:border-primary transition-colors"
							onclick={() => selectForm(form)}
						>
							<div class="font-medium text-base-content">{form.name}</div>
							{#if form.description}
								<div class="text-sm text-base-content/60 mt-1">{form.description}</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{:else if selectedForm}
			<DynamicForm
				schema={selectedForm.schema}
				branding={resolvedBranding}
				optionSets={data.optionSets}
				initialData={prefillData}
				onStepChange={handleStepChange}
				showSaveButton={true}
				onSave={handleSave}
				onSubmit={handleSubmit}
			/>
		{/if}
	</div>
</div>

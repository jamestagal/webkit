<script lang="ts">
	/**
	 * Consultation View Page (Read-Only DynamicForm)
	 *
	 * Displays a completed/draft consultation using DynamicForm in readOnly mode.
	 * Falls back to structured view if no form schema available.
	 */

	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import DynamicForm from "$lib/components/form-renderer/DynamicForm.svelte";
	import { getConsultation } from "$lib/api/consultation.remote";
	import { getFormById } from "$lib/api/forms.remote";
	import { consultationToFormData } from "$lib/utils/consultation-field-map";
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

	// Load consultation
	const consultation = await getConsultation(data.consultationId);

	// Resolve form schema: from consultation's formId or fallback template
	let formSchema: FormSchema | null = null;
	let formName: string = "Consultation";
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
	if (!formSchema && data.fallbackTemplate) {
		formSchema = buildFormSchema(data.fallbackTemplate.schema, data.fallbackTemplate.uiConfig);
		formName = data.fallbackTemplate.name;
		formDescription = data.fallbackTemplate.description;
	}

	// Resolved branding with form header
	let resolvedBranding = $derived.by((): ResolvedBranding => {
		const header: { title: string; subtitle?: string } = { title: formName };
		if (formDescription) header.subtitle = formDescription;
		return {
			...branding,
			formOverrides: { header },
		};
	});

	// Build initial data from consultation columns + customData
	const initialData = consultationToFormData(
		consultation as unknown as Record<string, unknown>,
		(consultation.customData as Record<string, unknown>) ?? undefined,
	);

	function formatDate(date: Date | string | null): string {
		if (!date) return "N/A";
		const d = new Date(date);
		return d.toLocaleDateString("en-AU", {
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case "completed":
				return "badge-success";
			case "draft":
				return "badge-warning";
			case "converted":
				return "badge-info";
			default:
				return "badge-ghost";
		}
	}

	function goBack() {
		goto(`/${agencySlug}/consultation/history`);
	}

	function editConsultation() {
		goto(`/${agencySlug}/consultation/edit/${data.consultationId}`);
	}
</script>

<svelte:head>
	<title>{consultation.businessName || "Consultation"} | Webkit</title>
</svelte:head>

<div class="min-h-screen bg-base-200 py-8">
	<div class="mx-auto max-w-4xl px-4">
		<!-- Header -->
		<div class="mb-6">
			<button
				type="button"
				onclick={goBack}
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
				Back to History
			</button>

			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-2xl font-bold text-base-content">
						{consultation.businessName || "Consultation Details"}
					</h1>
					<div class="mt-2 flex items-center gap-3">
						<span class="badge {getStatusBadgeClass(consultation.status)}">
							{consultation.status}
						</span>
						<span class="text-sm text-base-content/60">
							Created {formatDate(consultation.createdAt)}
						</span>
					</div>
				</div>
				<button type="button" class="btn btn-primary btn-sm" onclick={editConsultation}>
					Edit
				</button>
			</div>
		</div>

		<!-- DynamicForm in read-only mode -->
		{#if formSchema}
			<DynamicForm
				schema={formSchema}
				branding={resolvedBranding}
				optionSets={data.optionSets}
				{initialData}
				readOnly={true}
			/>
		{:else}
			<!-- Fallback: simple key-value display when no form schema -->
			<div class="bg-base-100 rounded-lg border border-base-300 p-6">
				<h2 class="text-lg font-semibold mb-4">Consultation Data</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each Object.entries(initialData) as [key, value]}
						{#if value}
							<div>
								<dt class="text-sm font-medium text-base-content/60 capitalize">
									{key.replace(/([A-Z])/g, " $1").trim()}
								</dt>
								<dd class="mt-1 text-sm text-base-content">
									{Array.isArray(value) ? value.join(", ") : value}
								</dd>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Metadata -->
		<div class="mt-6 rounded-lg bg-base-100 border border-base-300 p-4">
			<div class="grid gap-4 text-sm sm:grid-cols-3">
				<div>
					<dt class="font-medium text-base-content/60">Consultation ID</dt>
					<dd class="mt-1 font-mono text-xs">{consultation.id}</dd>
				</div>
				<div>
					<dt class="font-medium text-base-content/60">Created</dt>
					<dd class="mt-1">{formatDate(consultation.createdAt)}</dd>
				</div>
				<div>
					<dt class="font-medium text-base-content/60">Last Updated</dt>
					<dd class="mt-1">{formatDate(consultation.updatedAt)}</dd>
				</div>
			</div>
		</div>
	</div>
</div>

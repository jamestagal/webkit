<script lang="ts">
	/**
	 * FormDocument — self-contained form/questionnaire renderer.
	 *
	 * Phase 2.1g-c-1 (markup lift only): lifts the existing /f/[slug]/+page.svelte
	 * body into a component with branding plumbed through getEffectiveBranding.
	 * Wraps everything in `.branded-document` with only the 4 generic
	 * `--brand-*` vars — DaisyUI `--p`/`--s`/`--a` injection is deferred to
	 * Phase 2.1g-c-2 once this markup-lift is verified not to regress
	 * DynamicForm theming. DynamicForm currently retains its internal
	 * FormBranding+generateDaisyTheme plumbing; the wrapper-side DaisyUI
	 * injection in the next commit will make it redundant but that's a
	 * separately bisectable change.
	 *
	 * The hex→HSL conversion for ResolvedBranding still happens in-component
	 * (moved from the page) using the existing theme-generator import. Next
	 * commit moves hexToHsl to $lib/utils/color.ts.
	 */
	import DynamicForm from '$lib/components/form-renderer/DynamicForm.svelte';
	import { saveSubmissionProgress, completeSubmission } from '$lib/api/forms.remote';
	import type { FormSchema, UIConfig } from '$lib/types/form-builder';
	import type { ResolvedBranding } from '$lib/types/branding';
	import { defaultAgencyBranding } from '$lib/types/branding';
	import { hexToHsl, hexToDaisyHsl } from '$lib/utils/color';
	import { Check, AlertCircle } from 'lucide-svelte';
	import type { EffectiveBranding } from '$lib/server/document-branding';
	import type { PageData } from '../../../routes/f/[slug]/$types';

	let {
		data,
		branding,
		previewMode = false
	}: {
		data: PageData;
		branding: EffectiveBranding;
		previewMode?: boolean;
	} = $props();

	let submissionId = $derived(data.submission.id);
	let submissionStatus = $derived(data.submission.status);
	let submissionData = $derived(data.submission.data);
	let submissionCurrentStep = $derived(data.submission.currentStep);
	let form = $derived(data.form);
	let agency = $derived(data.agency);

	// Build DynamicForm-shaped ResolvedBranding from the resolved hex
	// EffectiveBranding. This is the existing conversion, just moved
	// from the page to the component.
	let resolvedBranding = $derived.by((): ResolvedBranding => {
		const colors = {
			...defaultAgencyBranding.colors,
			primary: branding.primaryColor
				? hexToHsl(branding.primaryColor)
				: defaultAgencyBranding.colors.primary,
			secondary: branding.secondaryColor
				? hexToHsl(branding.secondaryColor)
				: defaultAgencyBranding.colors.secondary || '280 70% 50%',
			accent: branding.accentColor
				? hexToHsl(branding.accentColor)
				: defaultAgencyBranding.colors.accent || '45 100% 50%'
		};

		const result: ResolvedBranding = {
			...defaultAgencyBranding,
			colors
		};

		if (branding.logoUrl) {
			result.logo = { url: branding.logoUrl, position: 'center', height: 48 };
		}

		return result;
	});

	let formSchema = $derived.by((): FormSchema | null => {
		if (!form?.schema) return null;
		try {
			const parsed = typeof form.schema === 'string' ? JSON.parse(form.schema) : form.schema;
			if (parsed && parsed.version && Array.isArray(parsed.steps)) {
				const schema = parsed as FormSchema;

				const header: { title?: string; subtitle?: string; showLogo?: boolean } = {
					...schema.formOverrides?.header
				};
				const formTitle = form.name || schema.formOverrides?.header?.title;
				const formSubtitle = form.description || schema.formOverrides?.header?.subtitle;
				if (formTitle) header.title = formTitle;
				if (formSubtitle) header.subtitle = formSubtitle;

				return {
					...schema,
					formOverrides: {
						...schema.formOverrides,
						header
					}
				};
			}
			return null;
		} catch {
			return null;
		}
	});

	let formData = $state<Record<string, unknown>>({});
	let currentStep = $state(0);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let isCompleted = $state(false);
	let isSubmitted = $state(false);

	$effect(() => {
		isCompleted = submissionStatus === 'completed';
		if (submissionData && typeof submissionData === 'object') {
			formData = submissionData as Record<string, unknown>;
		}
		currentStep = submissionCurrentStep || 0;
	});

	async function autoSave(saveData: Record<string, unknown>, step: number) {
		if (isCompleted || previewMode) return;

		saveStatus = 'saving';

		try {
			const schema = formSchema;
			let totalRequired = 0;
			let filledRequired = 0;

			if (schema?.steps) {
				for (const s of schema.steps) {
					for (const field of s.fields) {
						if (
							field.required &&
							!['heading', 'paragraph', 'divider'].includes(field.type)
						) {
							totalRequired++;
							const value = saveData[field.name];
							if (value !== undefined && value !== null && value !== '') {
								if (!Array.isArray(value) || value.length > 0) {
									filledRequired++;
								}
							}
						}
					}
				}
			}

			const completionPercentage =
				totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;

			await saveSubmissionProgress({
				submissionId,
				data: saveData,
				currentStep: step,
				completionPercentage
			});

			saveStatus = 'saved';

			setTimeout(() => {
				if (saveStatus === 'saved') {
					saveStatus = 'idle';
				}
			}, 2000);
		} catch (err) {
			console.error('Auto-save failed:', err);
			saveStatus = 'error';
		}
	}

	function scheduleAutoSave() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		saveTimeout = setTimeout(() => {
			autoSave(formData, currentStep);
		}, 2000);
	}

	$effect(() => {
		JSON.stringify(formData);
		if (Object.keys(formData).length > 0 && !isCompleted && !previewMode) {
			scheduleAutoSave();
		}
	});

	async function handleSubmit(submitData: Record<string, unknown>) {
		if (previewMode) return;
		await completeSubmission({
			submissionId,
			data: submitData
		});
		isSubmitted = true;
	}

	// DaisyUI-ready comma-separated HSL values computed from the branding
	// cascade. Injected on the wrapper as --p / --s / --a below so
	// DynamicForm (and any future consumer that reads DaisyUI theme vars)
	// sees the resolved branding live — postMessage-driven branding updates
	// in Phase 2.3 will flow through the wrapper's reactive style:--p and
	// cascade to every descendant with zero DynamicForm changes.
	let primaryDaisy = $derived(
		branding.primaryColor ? hexToDaisyHsl(branding.primaryColor) : null
	);
	let secondaryDaisy = $derived(
		branding.secondaryColor ? hexToDaisyHsl(branding.secondaryColor) : null
	);
	let accentDaisy = $derived(
		branding.accentColor ? hexToDaisyHsl(branding.accentColor) : null
	);

	let uiConfig = $derived.by((): UIConfig => {
		if (!form?.uiConfig) {
			return {
				layout: 'single-column',
				showProgressBar: true,
				showStepNumbers: true,
				submitButtonText: 'Submit',
				successMessage: 'Thank you for your submission!'
			};
		}
		return typeof form.uiConfig === 'string' ? JSON.parse(form.uiConfig) : form.uiConfig;
	});
</script>

<div
	class="branded-document"
	style:--brand-primary={branding.primaryColor}
	style:--brand-secondary={branding.secondaryColor}
	style:--brand-accent={branding.accentColor}
	style:--brand-accent-gradient={branding.accentGradient}
	style:--p={primaryDaisy}
	style:--s={secondaryDaisy}
	style:--a={accentDaisy}
>
	{#if isCompleted && !isSubmitted}
		<!-- Already Completed State -->
		<div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
			<div class="card bg-base-100 shadow-lg max-w-md w-full">
				<div class="card-body items-center text-center">
					<div
						class="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success mb-4"
					>
						<Check class="h-8 w-8" />
					</div>
					<h1 class="text-xl font-bold">Form Already Submitted</h1>
					<p class="text-base-content/70">
						This form has already been completed. Thank you for your submission!
					</p>
					{#if branding.logoUrl}
						<div class="mt-6 opacity-60">
							<img src={branding.logoUrl} alt={agency?.name ?? ''} class="h-8 object-contain" />
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else if formSchema}
		<!-- Form Render with Agency Branding -->
		<!-- Auto-save Status Indicator (hidden in preview) -->
		{#if !previewMode && saveStatus !== 'idle'}
			<div class="fixed top-4 right-4 z-50">
				<div
					class="badge gap-2 {saveStatus === 'saving'
						? 'badge-warning'
						: saveStatus === 'saved'
							? 'badge-success'
							: 'badge-error'}"
				>
					{#if saveStatus === 'saving'}
						<span class="loading loading-spinner loading-xs"></span>
						Saving...
					{:else if saveStatus === 'saved'}
						<Check class="h-3 w-3" />
						Saved
					{:else if saveStatus === 'error'}
						<AlertCircle class="h-3 w-3" />
						Save failed
					{/if}
				</div>
			</div>
		{/if}

		<DynamicForm
			schema={formSchema}
			branding={resolvedBranding}
			onSubmit={handleSubmit}
			submitButtonText={uiConfig.submitButtonText}
			successMessage={uiConfig.successMessage}
		/>
	{:else}
		<!-- Error State -->
		<div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
			<div class="card bg-base-100 shadow-lg max-w-md w-full">
				<div class="card-body items-center text-center">
					<div
						class="flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error mb-4"
					>
						<AlertCircle class="h-8 w-8" />
					</div>
					<h1 class="text-xl font-bold">Form Not Found</h1>
					<p class="text-base-content/70">
						This form could not be loaded. It may have been deleted or the link may be incorrect.
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.branded-document {
		display: contents;
	}
</style>

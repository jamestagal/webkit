<script lang="ts">
	import { onMount } from 'svelte';
	import { saveQuestionnaireProgress, submitQuestionnaire } from '$lib/api/questionnaire.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import type { QuestionnaireResponse } from '$lib/server/schema';
	import type { QuestionnaireResponses } from '$lib/api/questionnaire.types';

	// Import section components
	import QuestionnaireSidebar from './QuestionnaireSidebar.svelte';
	import QuestionnaireNav from './QuestionnaireNav.svelte';
	import Section1Personal from './Section1Personal.svelte';
	import Section2Company from './Section2Company.svelte';
	import Section3Display from './Section3Display.svelte';
	import Section4Domain from './Section4Domain.svelte';
	import Section5Business from './Section5Business.svelte';
	import Section6Content from './Section6Content.svelte';
	import Section7Design from './Section7Design.svelte';
	import Section8Final from './Section8Final.svelte';

	interface Props {
		questionnaire: QuestionnaireResponse;
		agencyLogoUrl?: string | null;
		agencyName?: string;
		onComplete?: () => void;
		readOnly?: boolean;
		isPreview?: boolean;
	}

	let { questionnaire, agencyLogoUrl, agencyName, onComplete, readOnly = false, isPreview = false }: Props = $props();

	const toast = getToast();

	// Section definitions
	const sections = [
		{ id: 0, title: 'Personal Information', shortTitle: 'Personal' },
		{ id: 1, title: 'Company Details', shortTitle: 'Company' },
		{ id: 2, title: 'Display Information', shortTitle: 'Display' },
		{ id: 3, title: 'Domain & Technical', shortTitle: 'Domain' },
		{ id: 4, title: 'About Your Business', shortTitle: 'Business' },
		{ id: 5, title: 'Website Content', shortTitle: 'Content' },
		{ id: 6, title: 'Website Design', shortTitle: 'Design' },
		{ id: 7, title: 'Final Details', shortTitle: 'Final' }
	];

	// State
	let currentSection = $state(questionnaire.currentSection || 0);
	let responses = $state<QuestionnaireResponses>((questionnaire.responses as QuestionnaireResponses) || {});
	let saving = $state(false);
	let submitting = $state(false);
	let hasUnsavedChanges = $state(false);
	let completionPercentage = $state(questionnaire.completionPercentage || 0);

	// Track section completion
	let sectionCompletion = $derived(calculateSectionCompletion());

	function calculateSectionCompletion(): boolean[] {
		// Check required fields per section
		const checks = [
			// Section 1: Personal (3 required)
			!!(responses.first_name && responses.last_name && responses.email),
			// Section 2: Company (2 required)
			!!(responses.company_name && responses.registered_address),
			// Section 3: Display (1 required)
			!!responses.displayed_business_name,
			// Section 4: Domain (2 required)
			!!(responses.has_domain && responses.has_google_business),
			// Section 5: Business (5 required)
			!!(responses.business_story && responses.areas_served && responses.target_customers && responses.top_services && responses.differentiators),
			// Section 6: Content (4 required)
			!!(responses.pages_wanted && responses.customer_actions && responses.key_information && responses.calls_to_action),
			// Section 7: Design (2 required)
			!!(responses.reference_websites && responses.aesthetic_description),
			// Section 8: Final (2 required)
			!!(responses.timeline && responses.google_analytics)
		];
		return checks;
	}

	// Auto-save on section change
	async function saveProgress() {
		// Skip saving in preview mode or read-only
		if (isPreview || readOnly || !hasUnsavedChanges || questionnaire.status === 'completed') return;

		saving = true;
		try {
			const result = await saveQuestionnaireProgress({
				questionnaireId: questionnaire.id,
				responses: responses as Record<string, unknown>,
				currentSection
			});
			if (result) {
				completionPercentage = result.completionPercentage;
				hasUnsavedChanges = false;
			}
		} catch (err) {
			console.error('Failed to save progress:', err);
			toast.error('Failed to save progress');
		} finally {
			saving = false;
		}
	}

	// Navigate to section
	async function goToSection(sectionId: number) {
		if (currentSection !== sectionId) {
			await saveProgress();
			currentSection = sectionId;
		}
	}

	// Navigation handlers
	async function handlePrevious() {
		if (currentSection > 0) {
			await goToSection(currentSection - 1);
		}
	}

	async function handleNext() {
		if (currentSection < sections.length - 1) {
			await goToSection(currentSection + 1);
		}
	}

	// Submit questionnaire
	async function handleSubmit() {
		if (submitting || questionnaire.status === 'completed') return;

		// In preview mode, just show a message
		if (isPreview) {
			toast.info('This is a preview - submissions are disabled');
			return;
		}

		// Save current progress first
		await saveProgress();

		// Check completion
		const allComplete = sectionCompletion.every(Boolean);
		if (!allComplete) {
			toast.warning('Please complete all required fields before submitting');
			// Find first incomplete section
			const firstIncomplete = sectionCompletion.findIndex((complete) => !complete);
			if (firstIncomplete >= 0) {
				currentSection = firstIncomplete;
			}
			return;
		}

		submitting = true;
		try {
			const result = await submitQuestionnaire({ questionnaireId: questionnaire.id });
			if (result.success) {
				toast.success('Questionnaire submitted successfully!');
				onComplete?.();
			}
		} catch (err) {
			console.error('Failed to submit questionnaire:', err);
			toast.error('Failed to submit questionnaire');
		} finally {
			submitting = false;
		}
	}

	// Mark changes when responses update
	function handleResponseChange() {
		hasUnsavedChanges = true;
	}

	// Warn about unsaved changes on navigation (skip in preview mode)
	function handleBeforeUnload(event: BeforeUnloadEvent): string | void {
		if (hasUnsavedChanges && !isPreview) {
			event.preventDefault();
			return 'You have unsaved changes. Are you sure you want to leave?';
		}
	}

	// Auto-save periodically (skip in preview mode)
	let autoSaveInterval: ReturnType<typeof setInterval>;
	onMount(() => {
		if (!isPreview) {
			autoSaveInterval = setInterval(() => {
				if (hasUnsavedChanges && !readOnly) {
					saveProgress();
				}
			}, 30000); // Auto-save every 30 seconds
		}

		return () => {
			if (autoSaveInterval) {
				clearInterval(autoSaveInterval);
			}
		};
	});
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<div class="min-h-screen bg-base-100">
	<!-- Header with Agency Logo -->
	<header class="border-b border-base-300 bg-base-100 py-6">
		<div class="mx-auto max-w-5xl px-4">
			<div class="flex flex-col items-center gap-4">
				{#if agencyLogoUrl}
					<img src={agencyLogoUrl} alt="{agencyName || 'Agency'} Logo" class="h-16 max-w-[200px] object-contain" />
				{:else if agencyName}
					<h2 class="text-xl font-bold text-base-content">{agencyName}</h2>
				{/if}
				<div class="text-center">
					<h1 class="text-2xl font-bold text-base-content">Initial Website Questionnaire</h1>
					<p class="mt-1 text-base-content/70">Help us understand your needs to create the perfect website</p>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-5xl px-4 py-8">
		{#if questionnaire.status === 'completed'}
			<!-- Completed State -->
			<div class="card bg-base-200">
				<div class="card-body items-center text-center">
					<div class="text-success mb-4">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<h2 class="card-title text-2xl">Questionnaire Completed</h2>
					<p class="text-base-content/70 max-w-md">
						Thank you for completing the questionnaire. We'll use this information to create your perfect website.
					</p>
					<p class="text-sm text-base-content/50 mt-4">
						Completed on {questionnaire.completedAt ? new Date(questionnaire.completedAt).toLocaleDateString() : 'N/A'}
					</p>
				</div>
			</div>
		{:else}
			<div class="flex flex-col lg:flex-row gap-8">
				<!-- Sidebar -->
				<aside class="lg:w-64 flex-shrink-0">
					<QuestionnaireSidebar
						{sections}
						{currentSection}
						{sectionCompletion}
						{completionPercentage}
						onSectionClick={goToSection}
					/>
				</aside>

				<!-- Form Content -->
				<div class="flex-1 min-w-0">
					<div class="card bg-base-200">
						<div class="card-body">
							<!-- Section Header -->
							<div class="mb-6">
								<div class="text-sm text-base-content/50 mb-1">
									Section {currentSection + 1} of {sections.length}
								</div>
								<h2 class="text-xl font-bold">{sections[currentSection]?.title ?? 'Section'}</h2>
							</div>

							<!-- Section Content -->
							<div class="space-y-6">
								{#if currentSection === 0}
									<Section1Personal bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{:else if currentSection === 1}
									<Section2Company bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{:else if currentSection === 2}
									<Section3Display bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{:else if currentSection === 3}
									<Section4Domain bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{:else if currentSection === 4}
									<Section5Business bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{:else if currentSection === 5}
									<Section6Content bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{:else if currentSection === 6}
									<Section7Design bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{:else if currentSection === 7}
									<Section8Final bind:responses onchange={handleResponseChange} disabled={readOnly} />
								{/if}
							</div>

							<!-- Navigation -->
							<QuestionnaireNav
								{currentSection}
								totalSections={sections.length}
								{saving}
								{submitting}
								{hasUnsavedChanges}
								onPrevious={handlePrevious}
								onNext={handleNext}
								onSubmit={handleSubmit}
								disabled={readOnly}
							/>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>

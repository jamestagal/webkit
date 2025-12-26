<script lang="ts">
	/**
	 * Consultation Form Page - Remote Functions Implementation
	 *
	 * Pattern: Multi-Step Form with Remote Functions
	 * Cognitive Load: 18
	 * - Component imports: 4
	 * - State management (step tracking): 3
	 * - Navigation handlers: 4
	 * - Initialization: 2
	 * - Progress tracking: 3
	 * - Completion handler: 2
	 *
	 * This is the NEW implementation using SvelteKit remote functions.
	 * Feature flag: VITE_USE_REMOTE_FUNCTIONS controls which version loads.
	 */

	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ClientInfoForm from '$lib/components/consultation/ClientInfoForm.svelte';
	import BusinessContext from '$lib/components/consultation/BusinessContext.svelte';
	import PainPointsCapture from '$lib/components/consultation/PainPointsCapture.svelte';
	import GoalsObjectives from '$lib/components/consultation/GoalsObjectives.svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';

	const toast = getToast();
	import {
		saveContactInfo,
		saveBusinessContext,
		savePainPoints,
		saveGoalsObjectives,
		completeConsultation,
		createConsultationWithContactInfo
	} from '$lib/api/consultation.remote';
	import type { Consultation } from '$lib/server/schema';
	import type { ConsultationDraft } from '$lib/api/consultation.remote';

	// Props from server - consultation can be null (lazy creation pattern)
	let {
		consultation,
		draft
	}: { consultation: Consultation | null; draft: ConsultationDraft | null } = $props();

	// Debug: Log loaded consultation data
	console.log('ConsultationPage loaded:', {
		id: consultation?.id ?? 'NEW (not created yet)',
		contactInfo: consultation?.contactInfo,
		businessContext: consultation?.businessContext,
		painPoints: consultation?.painPoints,
		goalsObjectives: consultation?.goalsObjectives
	});

	// State
	let currentStep = $state(0);
	// consultationId is null until the consultation is created (lazy creation)
	let consultationId = $state<string | null>(consultation?.id ?? null);
	let loading = $state(false);
	let isInitializing = $state(false);
	let isSaving = $state(false);
	let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Form data state - will be bound to child components
	let contactInfoData = $state(consultation?.contactInfo || {});
	let businessContextData = $state(consultation?.businessContext || {});
	let painPointsData = $state(consultation?.painPoints || {});
	let goalsObjectivesData = $state(consultation?.goalsObjectives || {});

	// Step configuration
	const steps = [
		{ id: 'contact_info', title: 'Contact Information' },
		{ id: 'business_context', title: 'Business Context' },
		{ id: 'pain_points', title: 'Pain Points' },
		{ id: 'goals_objectives', title: 'Goals & Objectives' }
	];

	// Derived state
	const totalSteps = steps.length;
	const currentStepInfo = $derived(steps[currentStep] || steps[0]);
	const isFirstStep = $derived(currentStep === 0);
	const isLastStep = $derived(currentStep === totalSteps - 1);
	const progressPercentage = $derived(Math.round(((currentStep + 1) / totalSteps) * 100));

	// Initialize from props
	if (draft) {
		// TODO: Populate form fields from draft
		console.log('Draft loaded:', draft);
	}

	// Save current step data to database
	// Returns the consultationId (important for lazy creation on step 0)
	async function saveCurrentStep(): Promise<string> {
		console.log('Saving step', currentStep, 'with data:', {
			step: currentStep,
			consultationId,
			contactInfoData,
			businessContextData,
			painPointsData,
			goalsObjectivesData
		});

		try {
			if (currentStep === 0) {
				// LAZY CREATION: If no consultationId, create the consultation now
				if (!consultationId) {
					console.log('Creating new consultation with contact info (lazy creation)');
					const result = await createConsultationWithContactInfo(contactInfoData);
					consultationId = result.consultationId;
					console.log('Consultation created with ID:', consultationId);
					return consultationId;
				}

				// Update existing consultation
				console.log('Calling saveContactInfo with:', { consultationId, ...contactInfoData });
				await saveContactInfo({
					consultationId,
					...contactInfoData
				});
				console.log('saveContactInfo completed');
			} else if (currentStep === 1) {
				if (!consultationId) throw new Error('No consultation ID - cannot save step 1');
				console.log('Calling saveBusinessContext with:', { consultationId, ...businessContextData });
				await saveBusinessContext({
					consultationId,
					...businessContextData
				});
				console.log('saveBusinessContext completed');
			} else if (currentStep === 2) {
				if (!consultationId) throw new Error('No consultation ID - cannot save step 2');
				console.log('Calling savePainPoints with:', { consultationId, ...painPointsData });
				await savePainPoints({
					consultationId,
					...painPointsData
				});
				console.log('savePainPoints completed');
			} else if (currentStep === 3) {
				if (!consultationId) throw new Error('No consultation ID - cannot save step 3');
				console.log('Calling saveGoalsObjectives with:', { consultationId, ...goalsObjectivesData });
				await saveGoalsObjectives({
					consultationId,
					...goalsObjectivesData
				});
				console.log('saveGoalsObjectives completed');
			}
			return consultationId!;
		} catch (error) {
			console.error('Error in saveCurrentStep:', error);
			throw error;
		}
	}

	// Auto-save with debounce (saves 2 seconds after last change)
	function triggerAutoSave(): void {
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
		}
		autoSaveTimeout = setTimeout(async () => {
			if (!isSaving && !loading) {
				isSaving = true;
				try {
					await saveCurrentStep();
					console.log('Auto-save completed for step', currentStep);
				} catch (error) {
					console.error('Auto-save failed:', error);
				} finally {
					isSaving = false;
				}
			}
		}, 2000);
	}

	// Watch for form data changes and trigger auto-save
	// Only auto-save if we have a consultationId (not for new forms)
	$effect(() => {
		// Track all form data
		const _ = JSON.stringify({
			contactInfoData,
			businessContextData,
			painPointsData,
			goalsObjectivesData
		});
		// Only auto-save when we have a consultationId (after lazy creation)
		// New forms should only be saved when user clicks "Next"
		if (consultationId) {
			triggerAutoSave();
		}
	});

	// Navigation handlers
	async function handleNext(): Promise<void> {
		if (isLastStep) return;

		loading = true;
		try {
			// Save current step data before moving to next
			await saveCurrentStep();
			currentStep++;
		} catch (error) {
			console.error('Error saving step:', error);
			toast.error('Failed to save. Please try again.');
		} finally {
			loading = false;
		}
	}

	async function handlePrevious(): Promise<void> {
		if (!isFirstStep) {
			// Save current step before going back (only if we have a consultation)
			if (consultationId) {
				loading = true;
				try {
					await saveCurrentStep();
				} catch (error) {
					console.error('Error saving before previous:', error);
				} finally {
					loading = false;
				}
			}
			currentStep--;
		}
	}

	async function handleComplete(): Promise<void> {
		if (!consultationId) {
			toast.error('No consultation to complete. Please fill out the form first.');
			return;
		}

		loading = true;
		try {
			// Save goals objectives first
			await saveGoalsObjectives({
				consultationId,
				...goalsObjectivesData
			});

			// Complete the consultation
			const result = await completeConsultation({ consultationId });

			// Handle redirect on client side (commands can't redirect)
			if (result?.success) {
				goto('/consultation/success');
			}
		} catch (error) {
			console.error('Error completing consultation:', error);
			toast.error('Failed to complete. Please try again.');
			loading = false;
		}
	}

	// Handle browser navigation/close
	// Only warn if user has created a consultation and not completed it
	function handleBeforeUnload(event: BeforeUnloadEvent): void {
		if (consultationId && !isLastStep) {
			event.preventDefault();
			event.returnValue = 'You have not completed the consultation. Are you sure you want to leave?';
			return event.returnValue;
		}
	}
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="border-b bg-white shadow-sm">
		<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<div class="py-6">
				<h1 class="text-3xl font-bold text-gray-900">Project Consultation</h1>
				<p class="mt-2 text-lg text-gray-600">
					Help us understand your needs so we can provide the best solution for your project.
				</p>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Progress Bar -->
		<div class="mb-8">
			<div class="mb-2 flex items-center justify-between text-sm">
				<span class="font-medium text-gray-700">Step {currentStep + 1} of {totalSteps}</span>
				<span class="text-gray-500">{progressPercentage}% Complete</span>
			</div>
			<div class="overflow-hidden rounded-full bg-gray-200">
				<div
					class="h-2 rounded-full bg-indigo-600 transition-all duration-300"
					style="width: {progressPercentage}%"
				></div>
			</div>
		</div>

		<!-- Step Indicator -->
		<div class="mb-8">
			<nav class="flex items-center justify-center">
				<ol class="flex items-center space-x-4">
					{#each steps as step, index}
						<li class="flex items-center">
							<button
								type="button"
								onclick={() => {
									if (index < currentStep) {
										currentStep = index;
									}
								}}
								disabled={loading || index > currentStep}
								class="flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors
                  {index === currentStep
										? 'border-indigo-600 bg-indigo-600 text-white'
										: index < currentStep
											? 'border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-50'
											: 'border-gray-300 bg-white text-gray-400 cursor-not-allowed'}"
							>
								{index + 1}
							</button>

							{#if index < steps.length - 1}
								<div
									class="ml-4 h-0.5 w-12 transition-colors
                    {index < currentStep ? 'bg-indigo-600' : 'bg-gray-300'}"
								></div>
							{/if}
						</li>
					{/each}
				</ol>
			</nav>

			<!-- Step Title -->
			<div class="mt-4 text-center">
				<h2 class="text-lg font-medium text-gray-900">{currentStepInfo.title}</h2>
			</div>
		</div>

		<!-- Form Content -->
		<div class="rounded-lg bg-white shadow-lg">
			<!-- Loading State -->
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<svg
							class="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<p class="text-lg text-gray-600">Loading consultation form...</p>
					</div>
				</div>
			{:else}
				<!-- Current Form Step -->
				<div class="p-6 sm:p-8">
					{#if currentStep === 0}
						<ClientInfoForm bind:data={contactInfoData} disabled={loading} />
					{:else if currentStep === 1}
						<BusinessContext bind:data={businessContextData} disabled={loading} />
					{:else if currentStep === 2}
						<PainPointsCapture bind:data={painPointsData} disabled={loading} />
					{:else if currentStep === 3}
						<GoalsObjectives bind:data={goalsObjectivesData} disabled={loading} />
					{/if}
				</div>

				<!-- Form Navigation -->
				<div class="border-t border-gray-200 px-6 py-6 sm:px-8">
					<div class="flex items-center justify-between">
						<!-- Previous Button -->
						<div>
							{#if !isFirstStep}
								<button
									type="button"
									class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
									onclick={handlePrevious}
									disabled={loading}
								>
									<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 19l-7-7 7-7"
										/>
									</svg>
									Previous
								</button>
							{/if}
						</div>

						<!-- Step Info -->
						<div class="hidden items-center space-x-4 text-sm text-gray-500 sm:flex">
							<span>Step {currentStep + 1} of {totalSteps}</span>
							<span>•</span>
							<span>{currentStepInfo.title}</span>
						</div>

						<!-- Next/Complete Button -->
						<div>
							{#if isLastStep}
								<button
									type="button"
									class="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
									onclick={handleComplete}
									disabled={loading}
								>
									{#if loading}
										<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Completing...
									{:else}
										Complete Consultation
										<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											/>
										</svg>
									{/if}
								</button>
							{:else}
								<button
									type="button"
									class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
									onclick={handleNext}
									disabled={loading}
								>
									{#if loading}
										<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Saving...
									{:else}
										Next
										<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 5l7 7-7 7"
											/>
										</svg>
									{/if}
								</button>
							{/if}
						</div>
					</div>

					<!-- Keyboard Shortcuts Hint -->
					<div class="mt-4 text-center text-xs text-gray-400">
						<p>Use arrow keys or click step numbers to navigate</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

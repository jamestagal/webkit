<script lang="ts">
	/**
	 * Consultation Form Page v2 - Remote Functions Implementation
	 *
	 * Streamlined 4-step consultation form with flat column structure.
	 * Steps:
	 * 1. Contact & Business
	 * 2. Situation & Challenges
	 * 3. Goals & Budget
	 * 4. Preferences & Notes
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ContactBusinessForm from '$lib/components/consultation/ContactBusinessForm.svelte';
	import SituationChallenges from '$lib/components/consultation/SituationChallenges.svelte';
	import GoalsBudget from '$lib/components/consultation/GoalsBudget.svelte';
	import PreferencesNotes from '$lib/components/consultation/PreferencesNotes.svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { FEATURES } from '$lib/config/features';
	import {
		createConsultation,
		updateContactBusiness,
		updateSituation,
		updateGoalsBudget,
		updatePreferencesNotes,
		completeConsultation
	} from '$lib/api/consultation.remote';
	import type { consultations } from '$lib/server/schema';
	import type {
		ContactBusiness,
		Situation,
		GoalsBudget as GoalsBudgetType,
		PreferencesNotes as PreferencesNotesType,
		toConsultationData
	} from '$lib/types/consultation';
	import { safeParse } from 'valibot';
	import {
		ContactBusinessSchema,
		SituationSchema,
		GoalsBudgetSchema,
		PreferencesNotesSchema
	} from '$lib/schema/consultation';

	type Consultation = typeof consultations.$inferSelect;

	const feature = FEATURES.consultations;
	const toast = getToast();

	// Props from server - consultation can be null (lazy creation pattern)
	let { consultation, agencyId }: { consultation: Consultation | null; agencyId: string } =
		$props();

	// Get agency slug from route params for navigation
	let agencySlug = $derived(page.params.agencySlug);

	// State
	let currentStep = $state(0);
	let consultationId = $state<string | null>(consultation?.id ?? null);
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});

	// Form data state - will be bound to child components
	let contactBusinessData = $state<ContactBusiness>({
		business_name: consultation?.businessName ?? '',
		contact_person: consultation?.contactPerson ?? '',
		email: consultation?.email ?? '',
		phone: consultation?.phone ?? '',
		website: consultation?.website ?? '',
		social_media: {
			linkedin: consultation?.socialLinkedin ?? '',
			facebook: consultation?.socialFacebook ?? '',
			instagram: consultation?.socialInstagram ?? ''
		},
		industry: consultation?.industry ?? '',
		business_type: consultation?.businessType ?? ''
	});

	let situationData = $state<Situation>({
		website_status: (consultation?.websiteStatus as Situation['website_status']) ?? 'none',
		primary_challenges: consultation?.primaryChallenges ?? [],
		urgency_level: (consultation?.urgencyLevel as Situation['urgency_level']) ?? 'low'
	});

	let goalsBudgetData = $state<GoalsBudgetType>({
		primary_goals: consultation?.primaryGoals ?? [],
		conversion_goal: consultation?.conversionGoal ?? '',
		budget_range: consultation?.budgetRange ?? '',
		timeline: (consultation?.timeline as GoalsBudgetType['timeline']) ?? undefined
	});

	let preferencesNotesData = $state<PreferencesNotesType>({
		design_styles: consultation?.designStyles ?? [],
		admired_websites: consultation?.admiredWebsites ?? '',
		consultation_notes: consultation?.consultationNotes ?? ''
	});

	// Step configuration
	const steps = [
		{ id: 'contact_business', title: 'Contact & Business' },
		{ id: 'situation', title: 'Situation & Challenges' },
		{ id: 'goals_budget', title: 'Goals & Budget' },
		{ id: 'preferences_notes', title: 'Preferences & Notes' }
	];

	// Derived state
	const totalSteps = steps.length;
	const currentStepInfo = $derived(steps[currentStep] || steps[0]);
	const isFirstStep = $derived(currentStep === 0);
	const isLastStep = $derived(currentStep === totalSteps - 1);
	const progressPercentage = $derived(Math.round(((currentStep + 1) / totalSteps) * 100));

	// Extract field name from Valibot issue path
	function getErrorKey(issue: {
		path?: Array<{ key?: string | number | symbol }>;
		message?: string;
	}): string {
		// Valibot path structure: [{ key: 'fieldName' }, ...]
		const firstPath = issue.path?.[0];
		if (firstPath && typeof firstPath.key === 'string') {
			return firstPath.key;
		}
		// Fallback: try to extract field name from message
		// e.g., "Invalid type: Expected string but received undefined" for budget_range
		return 'form';
	}

	// Convert Valibot issues to error object with field keys
	function issuesToErrors(
		issues: Array<{ path?: Array<{ key?: string | number | symbol }>; message: string }>
	): Record<string, string> {
		const result: Record<string, string> = {};
		for (const issue of issues) {
			const key = getErrorKey(issue);
			result[key] = issue.message;
		}
		return result;
	}

	// Validate current step
	function validateCurrentStep(): boolean {
		errors = {};

		if (currentStep === 0) {
			const result = safeParse(ContactBusinessSchema, contactBusinessData);
			if (!result.success) {
				errors = issuesToErrors(result.issues);
				return false;
			}
		} else if (currentStep === 1) {
			const result = safeParse(SituationSchema, situationData);
			if (!result.success) {
				errors = issuesToErrors(result.issues);
				return false;
			}
		} else if (currentStep === 2) {
			const result = safeParse(GoalsBudgetSchema, goalsBudgetData);
			if (!result.success) {
				errors = issuesToErrors(result.issues);
				return false;
			}
		} else if (currentStep === 3) {
			const result = safeParse(PreferencesNotesSchema, preferencesNotesData);
			if (!result.success) {
				errors = issuesToErrors(result.issues);
				return false;
			}
		}

		return true;
	}

	// Save current step data to database
	async function saveCurrentStep(): Promise<string> {
		try {
			if (currentStep === 0) {
				// LAZY CREATION: If no consultationId, create the consultation now
				if (!consultationId) {
					const result = await createConsultation({
						agencyId,
						...contactBusinessData
					});
					consultationId = result.consultationId;
					return consultationId;
				}

				// Update existing consultation
				await updateContactBusiness({
					consultationId,
					...contactBusinessData
				});
			} else if (currentStep === 1) {
				if (!consultationId) throw new Error('No consultation ID - cannot save step 1');
				await updateSituation({
					consultationId,
					...situationData
				});
			} else if (currentStep === 2) {
				if (!consultationId) throw new Error('No consultation ID - cannot save step 2');
				await updateGoalsBudget({
					consultationId,
					...goalsBudgetData
				});
			} else if (currentStep === 3) {
				if (!consultationId) throw new Error('No consultation ID - cannot save step 3');
				await updatePreferencesNotes({
					consultationId,
					...preferencesNotesData
				});
			}
			return consultationId!;
		} catch (error) {
			console.error('Error in saveCurrentStep:', error);
			throw error;
		}
	}

	// Navigation handlers
	async function handleNext(): Promise<void> {
		if (isLastStep) return;

		// Validate before proceeding
		if (!validateCurrentStep()) {
			toast.error('Please fix the errors before continuing.');
			return;
		}

		loading = true;
		try {
			await saveCurrentStep();
			currentStep++;
			errors = {};
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
			errors = {};
		}
	}

	async function handleComplete(): Promise<void> {
		if (!consultationId) {
			toast.error('No consultation to complete. Please fill out the form first.');
			return;
		}

		// Validate final step
		if (!validateCurrentStep()) {
			toast.error('Please fix the errors before completing.');
			return;
		}

		loading = true;
		try {
			// Save preferences notes first
			await updatePreferencesNotes({
				consultationId,
				...preferencesNotesData
			});

			// Complete the consultation
			const result = await completeConsultation({ consultationId });

			// Handle redirect on client side (commands can't redirect)
			if (result?.success) {
				goto(`/${agencySlug}/consultation/success`);
			}
		} catch (error) {
			console.error('Error completing consultation:', error);
			toast.error('Failed to complete. Please try again.');
			loading = false;
		}
	}

	// Handle browser navigation/close
	function handleBeforeUnload(event: BeforeUnloadEvent): void {
		if (consultationId && !isLastStep) {
			event.preventDefault();
			event.returnValue =
				'You have not completed the consultation. Are you sure you want to leave?';
			return event.returnValue;
		}
	}

	// Save current page without navigating
	async function handleSave(): Promise<void> {
		// Validate before saving
		if (!validateCurrentStep()) {
			toast.error('Please fix the errors before saving.');
			return;
		}

		loading = true;
		try {
			await saveCurrentStep();
			toast.success('Saved successfully');
		} catch (error) {
			console.error('Error saving:', error);
			toast.error('Failed to save. Please try again.');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
				style="background-color: {feature.colorLight}; color: {feature.color}"
			>
				<feature.icon class="h-6 w-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">New Consultation</h1>
				<p class="text-base-content/70 mt-1">
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
										: 'cursor-not-allowed border-gray-300 bg-white text-gray-400'}"
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
						<p class="text-lg text-gray-600">Saving...</p>
					</div>
				</div>
			{:else}
				<!-- Current Form Step -->
				<div class="p-6 sm:p-8">
					{#if currentStep === 0}
						<ContactBusinessForm bind:data={contactBusinessData} {errors} disabled={loading} />
					{:else if currentStep === 1}
						<SituationChallenges bind:data={situationData} {errors} disabled={loading} />
					{:else if currentStep === 2}
						<GoalsBudget bind:data={goalsBudgetData} {errors} disabled={loading} />
					{:else if currentStep === 3}
						<PreferencesNotes bind:data={preferencesNotesData} {errors} disabled={loading} />
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

						<!-- Save Button (center) -->
						<div class="flex items-center gap-4">
							{#if consultationId}
								<button
									type="button"
									class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
									onclick={handleSave}
									disabled={loading}
								>
									<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
										/>
									</svg>
									Save
								</button>
							{/if}
							<!-- Step Info (hidden on mobile) -->
							<div class="hidden items-center space-x-4 text-sm text-gray-500 sm:flex">
								<span>Step {currentStep + 1} of {totalSteps}</span>
								<span>&bull;</span>
								<span>{currentStepInfo.title}</span>
							</div>
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
									Complete Consultation
									<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										/>
									</svg>
								</button>
							{:else}
								<button
									type="button"
									class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
									onclick={handleNext}
									disabled={loading}
								>
									Next
									<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 5l7 7-7 7"
										/>
									</svg>
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

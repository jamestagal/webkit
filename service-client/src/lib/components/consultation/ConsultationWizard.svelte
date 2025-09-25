<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import { toast } from "$lib/components/shared/Toast.svelte";

	// Import form components
	import ClientInfoForm from "./ClientInfoForm.svelte";
	import BusinessContext from "./BusinessContext.svelte";
	import PainPointsCapture from "./PainPointsCapture.svelte";
	import GoalsObjectives from "./GoalsObjectives.svelte";

	// Import UI components
	import StepIndicator from "$lib/components/shared/StepIndicator.svelte";
	import ProgressBar from "$lib/components/shared/ProgressBar.svelte";
	import SaveDraft from "$lib/components/shared/SaveDraft.svelte";
	import Button from "$lib/components/Button.svelte";

	// Props
	let {
		consultationId = undefined,
		onComplete = () => {},
		showStepIndicator = true,
		showProgressBar = true,
		autoSave = true,
	}: {
		consultationId?: string;
		onComplete?: (consultation: any) => void;
		showStepIndicator?: boolean;
		showProgressBar?: boolean;
		autoSave?: boolean;
	} = $props();

	// Get store references
	const currentStep = $derived(() => consultationStore.formState.currentStep);
	const currentStepInfo = $derived(() => consultationStore.currentStepInfo);
	const isFirstStep = $derived(() => consultationStore.isFirstStep);
	const isLastStep = $derived(() => consultationStore.isLastStep);
	const canNavigateNext = $derived(() => consultationStore.canNavigateNext);
	const completionPercentage = $derived(() => consultationStore.completionPercentage);
	const hasUnsavedChanges = $derived(() => consultationStore.hasUnsavedChanges);
	const loading = $derived(() => consultationStore.loading);
	const saving = $derived(() => consultationStore.saving);

	// Form data for each step (reactive binding)
	let contactInfoData = $derived.by(() => consultationStore.formState.data.contact_info || {});
	let businessContextData = $derived.by(
		() => consultationStore.formState.data.business_context || {},
	);
	let painPointsData = $derived.by(() => consultationStore.formState.data.pain_points || {});
	let goalsObjectivesData = $derived.by(
		() => consultationStore.formState.data.goals_objectives || {},
	);

	// State for submission
	let isSubmitting = $state(false);

	// Initialize the consultation wizard
	onMount(async () => {
		const success = await consultationStore.initialize(consultationId);
		if (!success) {
			toast.error("Failed to initialize consultation form. Please refresh and try again.");
		}
	});

	// Cleanup and handle unsaved changes
	onDestroy(() => {
		if (hasUnsavedChanges()) {
			// In a real app, you might want to save or warn the user
			console.warn("Consultation wizard destroyed with unsaved changes");
		}
	});

	// Navigation handlers
	async function handleNext(): Promise<void> {
		// Validate current step before proceeding
		const isValid = consultationStore.validateCurrentStep();
		if (!isValid) {
			toast.warning("Please complete the required fields before proceeding.");
			return;
		}

		// Navigate to next step
		const success = consultationStore.nextStep();
		if (!success) {
			toast.error("Unable to proceed to the next step.");
		}
	}

	function handlePrevious(): void {
		const success = consultationStore.previousStep();
		if (!success) {
			toast.error("Unable to go back to the previous step.");
		}
	}

	async function handleSubmit(): Promise<void> {
		if (isSubmitting) return;

		isSubmitting = true;

		try {
			// Validate all steps are complete
			if (completionPercentage() < 100) {
				toast.warning("Please complete all required sections before submitting.");
				return;
			}

			// Save current progress
			const saveSuccess = await consultationStore.save();
			if (!saveSuccess) {
				toast.error("Failed to save consultation. Please try again.");
				return;
			}

			// Complete the consultation
			const completeSuccess = await consultationStore.complete();
			if (!completeSuccess) {
				toast.error("Failed to complete consultation. Please try again.");
				return;
			}

			// Show success message
			toast.success({
				title: "Consultation Complete!",
				message: "Thank you for providing your information. We'll be in touch soon.",
				duration: 5000,
			});

			// Call completion callback
			onComplete(consultationStore.consultation);
		} catch (error) {
			console.error("Consultation submission error:", error);
			toast.error("An unexpected error occurred. Please try again.");
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSave(): Promise<void> {
		const success = await consultationStore.save();
		if (success) {
			toast.success("Consultation saved successfully!");
		} else {
			toast.error("Failed to save consultation. Please try again.");
		}
	}

	// Handle browser navigation/close
	function handleBeforeUnload(event: BeforeUnloadEvent): void {
		if (hasUnsavedChanges()) {
			event.preventDefault();
			event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
			return event.returnValue;
		}
	}

	// Add beforeunload listener
	onMount(() => {
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	});

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent): void {
		if (event.metaKey || event.ctrlKey) {
			switch (event.key) {
				case "s":
					event.preventDefault();
					handleSave();
					break;
				case "ArrowLeft":
					if (!isFirstStep()) {
						event.preventDefault();
						handlePrevious();
					}
					break;
				case "ArrowRight":
					if (canNavigateNext() && !isLastStep()) {
						event.preventDefault();
						handleNext();
					}
					break;
				case "Enter":
					if (isLastStep() && completionPercentage() === 100) {
						event.preventDefault();
						handleSubmit();
					}
					break;
			}
		}
	}

	onMount(() => {
		document.addEventListener("keydown", handleKeydown);
		return () => document.removeEventListener("keydown", handleKeydown);
	});

	function getCurrentFormErrors() {
		const errors = consultationStore.formState.errors;
		switch (currentStep()) {
			case 0:
				return errors["contact_info"] || [];
			case 1:
				return errors["business_context"] || [];
			case 2:
				return errors["pain_points"] || [];
			case 3:
				return errors["goals_objectives"] || [];
			default:
				return [];
		}
	}
</script>

<svelte:window on:beforeunload={handleBeforeUnload} />

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
		<!-- Progress Indicators -->
		{#if showProgressBar}
			<div class="mb-8">
				<ProgressBar showPercentage={true} showStepCount={true} showLabels={false} animate={true} />
			</div>
		{/if}

		{#if showStepIndicator}
			<StepIndicator
				variant="horizontal"
				showLabels={true}
				allowNavigation={true}
				disabled={loading() || saving()}
			/>
		{/if}

		<!-- Form Content -->
		<div class="rounded-lg bg-white shadow-lg">
			<!-- Loading State -->
			{#if loading()}
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
					{#if currentStep() === 0}
						<ClientInfoForm
							bind:data={contactInfoData}
							errors={getCurrentFormErrors()}
							disabled={saving() || isSubmitting}
						/>
					{:else if currentStep() === 1}
						<BusinessContext
							bind:data={businessContextData}
							errors={getCurrentFormErrors()}
							disabled={saving() || isSubmitting}
						/>
					{:else if currentStep() === 2}
						<PainPointsCapture
							bind:data={painPointsData}
							errors={getCurrentFormErrors()}
							disabled={saving() || isSubmitting}
						/>
					{:else if currentStep() === 3}
						<GoalsObjectives
							bind:data={goalsObjectivesData}
							errors={getCurrentFormErrors()}
							disabled={saving() || isSubmitting}
						/>
					{/if}
				</div>

				<!-- Form Navigation -->
				<div class="border-t border-gray-200 px-6 py-6 sm:px-8">
					<div class="flex items-center justify-between">
						<!-- Previous Button -->
						<div>
							{#if !isFirstStep()}
								<Button
									variant="secondary"
									onclick={handlePrevious}
									disabled={loading() || saving() || isSubmitting}
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
								</Button>
							{/if}
						</div>

						<!-- Step Info -->
						<div class="hidden items-center space-x-4 text-sm text-gray-500 sm:flex">
							<span>Step {currentStep() + 1} of {consultationStore.totalSteps()}</span>
							{#if currentStepInfo()}
								<span>•</span>
								<span>{currentStepInfo().title}</span>
							{/if}
						</div>

						<!-- Next/Submit Button -->
						<div class="flex items-center space-x-3">
							{#if autoSave}
								<SaveDraft position="inline" showButton={false} showStatus={true} compact={true} />
							{/if}

							{#if isLastStep()}
								<Button
									variant="primary"
									onclick={handleSubmit}
									disabled={loading() || saving() || isSubmitting || completionPercentage() < 100}
									loading={isSubmitting}
								>
									{#if isSubmitting}
										Submitting...
									{:else}
										Complete Consultation
									{/if}
								</Button>
							{:else}
								<Button
									variant="primary"
									onclick={handleNext}
									disabled={loading() || saving() || isSubmitting || !canNavigateNext()}
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
								</Button>
							{/if}
						</div>
					</div>

					<!-- Keyboard Shortcuts Hint -->
					<div class="mt-4 text-center text-xs text-gray-400">
						<p>
							Keyboard shortcuts: Ctrl+S to save • Ctrl+← → to navigate
							{#if isLastStep && completionPercentage === 100}
								• Ctrl+Enter to submit
							{/if}
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Auto-save indicator (floating) -->
	{#if autoSave}
		<SaveDraft position="bottom-right" showButton={true} showStatus={true} />
	{/if}
</div>

<!-- Exit Confirmation Modal -->
{#if showExitConfirmation}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="mx-4 w-full max-w-md rounded-lg bg-white p-6">
			<h3 class="mb-4 text-lg font-medium text-gray-900">Unsaved Changes</h3>
			<p class="mb-6 text-sm text-gray-600">
				You have unsaved changes. Would you like to save before leaving?
			</p>
			<div class="flex space-x-3">
				<Button
					variant="primary"
					onclick={() => {
						handleSave();
						showExitConfirmation = false;
					}}
				>
					Save & Exit
				</Button>
				<Button variant="secondary" onclick={() => (showExitConfirmation = false)}>
					Continue Editing
				</Button>
				<Button
					variant="danger"
					onclick={() => {
						consultationStore.reset();
						showExitConfirmation = false;
					}}
				>
					Exit Without Saving
				</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Custom focus styles for better accessibility */
	:global(.consultation-wizard button:focus) {
		@apply ring-2 ring-indigo-500 ring-offset-2 outline-none;
	}

	/* Smooth transitions */
	:global(.consultation-wizard .form-section) {
		transition:
			opacity 0.3s ease-in-out,
			transform 0.3s ease-in-out;
	}

	/* Loading states */
	:global(.consultation-wizard .loading) {
		opacity: 0.7;
		pointer-events: none;
	}
</style>

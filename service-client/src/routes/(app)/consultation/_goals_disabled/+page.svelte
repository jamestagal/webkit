<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import GoalsObjectives from "$lib/components/consultation/GoalsObjectives.svelte";
	import StepIndicator from "$lib/components/shared/StepIndicator.svelte";
	import ProgressBar from "$lib/components/shared/ProgressBar.svelte";
	import SaveDraft from "$lib/components/shared/SaveDraft.svelte";
	import Button from "$lib/components/Button.svelte";
	import { toast } from "$lib/components/shared/Toast.svelte";

	// Form data
	let goalsObjectivesData = $derived.by(
		() => consultationStore.formState.data.goals_objectives || {},
	);

	// Navigation state
	const currentStep = $derived(() => consultationStore.formState.currentStep);
	const canNavigateNext = $derived(() => consultationStore.canNavigateNext);
	const completionPercentage = $derived(() => consultationStore.completionPercentage);

	// Set current step to goals (step 3)
	onMount(async () => {
		await consultationStore.initialize();
		consultationStore.goToStep(3);
	});

	// Navigation handlers
	async function handleNext() {
		const isValid = consultationStore.validateCurrentStep();
		if (!isValid) {
			toast.warning("Please complete the required fields before proceeding.");
			return;
		}

		await consultationStore.save();
		goto("/consultation/audit");
	}

	async function handleComplete() {
		const isValid = consultationStore.validateCurrentStep();
		if (!isValid) {
			toast.warning("Please complete the required fields before submitting.");
			return;
		}

		if (completionPercentage() < 100) {
			toast.warning("Please complete all required sections before submitting.");
			return;
		}

		const success = await consultationStore.complete();
		if (success) {
			toast.success("Consultation completed successfully!");
			goto("/consultation/success");
		} else {
			toast.error("Failed to complete consultation. Please try again.");
		}
	}

	function handlePrevious() {
		goto("/consultation/challenges");
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="border-b bg-white shadow-sm">
		<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<div class="py-6">
				<h1 class="text-3xl font-bold text-gray-900">Goals & Objectives</h1>
				<p class="mt-2 text-gray-600">Define your goals, timeline, and success metrics</p>

				<ProgressBar showPercentage={true} showStepCount={true} class="mt-4" />
			</div>
		</div>
	</div>

	<!-- Step Indicator -->
	<div class="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
		<StepIndicator variant="horizontal" showLabels={true} allowNavigation={true} />
	</div>

	<!-- Form Content -->
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<div class="rounded-lg bg-white shadow-lg">
			<div class="p-6 sm:p-8">
				<GoalsObjectives
					bind:data={goalsObjectivesData}
					errors={consultationStore.getSectionErrors("goals_objectives")}
				/>
			</div>

			<!-- Navigation -->
			<div class="border-t border-gray-200 px-6 py-6 sm:px-8">
				<div class="flex items-center justify-between">
					<Button variant="secondary" onclick={handlePrevious}>
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

					<div class="flex items-center space-x-3">
						<SaveDraft position="inline" showButton={false} showStatus={true} compact={true} />

						{#if completionPercentage() >= 100}
							<Button variant="primary" onclick={handleComplete}>
								Complete Consultation
								<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</Button>
						{:else}
							<Button variant="primary" onclick={handleNext} disabled={!canNavigateNext()}>
								Continue
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
			</div>
		</div>
	</div>
</div>

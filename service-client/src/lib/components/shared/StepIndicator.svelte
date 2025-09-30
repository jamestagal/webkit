<script lang="ts">
	import { consultationStore } from "$lib/stores/consultation.svelte";

	// Props
	let {
		variant = "horizontal",
		showLabels = true,
		allowNavigation = true,
		disabled = false,
	}: {
		variant?: "horizontal" | "vertical";
		showLabels?: boolean;
		allowNavigation?: boolean;
		disabled?: boolean;
	} = $props();

	// Simple reactive access - no derived chains
	const steps = consultationStore.steps;
	const currentStep = $derived(consultationStore.formState.currentStep);
	const completedSteps = $derived(consultationStore.getCompletedSteps());
	const isAutoSaving = $derived(consultationStore.formState.isAutoSaving);

	// Helper functions - no reactive dependencies
	function getStepState(stepIndex: number): "completed" | "current" | "upcoming" | "available" {
		const completed = consultationStore.getCompletedSteps();
		const current = consultationStore.getCurrentStep();

		if (completed.includes(stepIndex)) {
			return "completed";
		} else if (stepIndex === current) {
			return "current";
		} else if (canNavigateToStep(stepIndex)) {
			return "available";
		} else {
			return "upcoming";
		}
	}

	function canNavigateToStep(stepIndex: number): boolean {
		if (!allowNavigation || disabled || consultationStore.formState.isAutoSaving) return false;

		const completed = consultationStore.getCompletedSteps();
		const current = consultationStore.getCurrentStep();

		// Can always go back to completed steps
		if (completed.includes(stepIndex)) return true;

		// Can go to current step
		if (stepIndex === current) return true;

		// Can go to next step if current step is valid
		if (stepIndex === current + 1) return true;

		return false;
	}

	function getStepTitle(step: any): string {
		return step?.title || "";
	}

	function handleStepClick(stepIndex: number) {
		if (canNavigateToStep(stepIndex)) {
			consultationStore.goToStep(stepIndex);
		}
	}
</script>

<!-- Horizontal variant -->
{#if variant === "horizontal"}
	<div class="flex items-center justify-between">
		{#each steps as step, index}
			{@const state = getStepState(index)}
			<div class="flex items-center" class:flex-1={index < steps.length - 1}>
				<!-- Step circle -->
				<div
					class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 transition-colors duration-200"
					class:bg-green-500={state === "completed"}
					class:border-green-500={state === "completed"}
					class:text-white={state === "completed" || state === "current"}
					class:bg-indigo-600={state === "current"}
					class:border-indigo-600={state === "current"}
					class:bg-gray-200={state === "upcoming"}
					class:border-gray-300={state === "upcoming"}
					class:text-gray-500={state === "upcoming"}
					class:bg-blue-100={state === "available"}
					class:border-blue-300={state === "available"}
					class:text-blue-600={state === "available"}
					onclick={() => handleStepClick(index)}
				>
					{#if state === "completed"}
						<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					{:else}
						<span class="text-sm font-medium">{index + 1}</span>
					{/if}
				</div>

				<!-- Step label -->
				{#if showLabels}
					<div class="ml-3 min-w-0 flex-1">
						<p
							class="text-sm font-medium transition-colors duration-200"
							class:text-green-600={state === "completed"}
							class:text-indigo-600={state === "current"}
							class:text-gray-500={state === "upcoming"}
							class:text-blue-600={state === "available"}
						>
							{getStepTitle(step)}
						</p>
					</div>
				{/if}

				<!-- Connector line -->
				{#if index < steps.length - 1}
					<div
						class="mx-4 h-0.5 flex-1 transition-colors duration-200"
						class:bg-green-500={consultationStore.getCompletedSteps().includes(index)}
						class:bg-gray-300={!consultationStore.getCompletedSteps().includes(index)}
					></div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<!-- Progress Summary -->
{#if showLabels}
	<div class="mt-4 text-center">
		<p class="text-sm text-gray-600">
			Step {currentStep + 1} of {consultationStore.getTotalSteps()}:
			<span class="font-medium">{getStepTitle(steps[currentStep])}</span>
		</p>
		<div class="mt-2 h-2 w-full rounded-full bg-gray-200">
			<div
				class="h-2 rounded-full bg-indigo-600 transition-all duration-500"
				style="width: {(consultationStore.getCompletedSteps().length /
					consultationStore.getTotalSteps()) *
					100}%"
			></div>
		</div>
		<p class="mt-1 text-xs text-gray-500">
			{consultationStore.getCompletedSteps().length} of {consultationStore.getTotalSteps()} steps completed
			({Math.round(
				(consultationStore.getCompletedSteps().length / consultationStore.getTotalSteps()) * 100,
			)}%)
		</p>
	</div>
{/if}

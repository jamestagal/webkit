<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from "$lib/components/Button.svelte";

	interface Props {
		steps: {
			id: string;
			title: string;
		}[];
		onComplete?: () => void;
		onStepChange?: (newStepIndex: number, oldStepIndex: number) => void;
		showProgress?: boolean;
		// Individual step snippets passed as props
		contact_info?: Snippet;
		business_context?: Snippet;
		pain_points?: Snippet;
		goals_objectives?: Snippet;
	}

	let {
		steps,
		onComplete,
		onStepChange,
		showProgress = true,
		contact_info,
		business_context,
		pain_points,
		goals_objectives
	}: Props = $props();

	// Simple state management
	let currentStepIndex = $state(0);
	let canNavigateNext = $derived(currentStepIndex < steps.length - 1);
	let canNavigatePrev = $derived(currentStepIndex > 0);
	let isLastStep = $derived(currentStepIndex === steps.length - 1);

	const currentStep = $derived(steps[currentStepIndex]);
	const progress = $derived((currentStepIndex + 1) / steps.length * 100);

	function nextStep() {
		if (canNavigateNext) {
			const oldStepIndex = currentStepIndex;
			currentStepIndex++;
			onStepChange?.(currentStepIndex, oldStepIndex);
		} else if (isLastStep && onComplete) {
			onComplete();
		}
	}

	function prevStep() {
		if (canNavigatePrev) {
			const oldStepIndex = currentStepIndex;
			currentStepIndex--;
			onStepChange?.(currentStepIndex, oldStepIndex);
		}
	}

	function goToStep(stepIndex: number) {
		if (stepIndex >= 0 && stepIndex < steps.length) {
			const oldStepIndex = currentStepIndex;
			currentStepIndex = stepIndex;
			onStepChange?.(stepIndex, oldStepIndex);
		}
	}

</script>

<div class="min-h-screen flex flex-col">
	<!-- Header with Progress -->
	{#if showProgress}
		<div class="border-b border-base-300">
			<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
				<h1 class="text-3xl font-bold">New Consultation</h1>
				<p class="mt-2 opacity-70">{currentStep?.title}</p>

				<!-- Progress Bar -->
				<div class="mt-4">
					<div class="flex justify-between text-xs opacity-60 mb-2">
						<span>Step {currentStepIndex + 1} of {steps.length}</span>
						<span>{Math.round(progress)}% Complete</span>
					</div>
					<div class="w-full bg-base-200 rounded-full h-2">
						<div
							class="bg-primary h-2 rounded-full transition-all duration-300"
							style="width: {progress}%"
						></div>
					</div>
				</div>

				<!-- Step Indicators -->
				<div class="mt-4 flex justify-center space-x-4">
					{#each steps as step, index}
						<button
							type="button"
							onclick={() => goToStep(index)}
							class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-200"
							class:bg-primary={index === currentStepIndex}
							class:bg-success={index < currentStepIndex}
							class:text-primary-content={index === currentStepIndex || index < currentStepIndex}
							class:bg-base-300={index > currentStepIndex}
							class:text-base-content={index > currentStepIndex}
							class:opacity-50={index > currentStepIndex}
						>
							{#if index < currentStepIndex}
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
								</svg>
							{:else}
								{index + 1}
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Step Content -->
	<div class="flex-1 py-8">
		<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<div class="bg-base-100 rounded-lg shadow-lg">
				<div class="p-6 sm:p-8">
					{#if currentStep?.id === 'contact_info' && contact_info}
						{@render contact_info()}
					{:else if currentStep?.id === 'business_context' && business_context}
						{@render business_context()}
					{:else if currentStep?.id === 'pain_points' && pain_points}
						{@render pain_points()}
					{:else if currentStep?.id === 'goals_objectives' && goals_objectives}
						{@render goals_objectives()}
					{:else}
						<p class="opacity-60">Step content not found</p>
					{/if}
				</div>

				<!-- Navigation -->
				<div class="border-t border-base-200 px-6 py-6 sm:px-8 flex justify-between">
					<div>
						{#if canNavigatePrev}
							<Button variant="secondary" onclick={prevStep}>
								<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
								</svg>
								Previous
							</Button>
						{/if}
					</div>

					<div>
						<Button
							variant="primary"
							onclick={nextStep}
						>
							{#if isLastStep}
								Complete
							{:else}
								Next
								<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
							{/if}
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import BusinessContext from "$lib/components/consultation/BusinessContext.svelte";
	import StepIndicator from "$lib/components/shared/StepIndicator.svelte";
	import ProgressBar from "$lib/components/shared/ProgressBar.svelte";
	import SaveDraft from "$lib/components/shared/SaveDraft.svelte";
	import Button from "$lib/components/Button.svelte";
	import { toast } from "$lib/components/shared/Toast.svelte";

	// Form data
	let businessContextData = $derived.by(
		() => consultationStore.formState.data.business_context || {},
	);

	// Navigation state
	const currentStep = $derived(() => consultationStore.formState.currentStep);
	const canNavigateNext = $derived(() => consultationStore.canNavigateNext);

	// Set current step to business context (step 1)
	onMount(async () => {
		await consultationStore.initialize();
		consultationStore.goToStep(1);
	});

	// Navigation handlers
	async function handleNext() {
		const isValid = consultationStore.validateCurrentStep();
		if (!isValid) {
			toast.warning("Please complete the required fields before proceeding.");
			return;
		}

		await consultationStore.save();
		goto("/consultation/challenges");
	}

	function handlePrevious() {
		goto("/consultation");
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="border-b bg-white shadow-sm">
		<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
			<div class="py-6">
				<h1 class="text-3xl font-bold text-gray-900">Business Context</h1>
				<p class="mt-2 text-gray-600">Tell us about your business and industry</p>

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
				<BusinessContext
					bind:data={businessContextData}
					errors={consultationStore.getSectionErrors("business_context")}
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

						<Button variant="primary" onclick={handleNext} disabled={!canNavigateNext()}>
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
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

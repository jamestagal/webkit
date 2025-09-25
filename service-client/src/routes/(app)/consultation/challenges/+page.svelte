<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { consultationStore } from '$lib/stores/consultation.svelte';
  import PainPointsCapture from '$lib/components/consultation/PainPointsCapture.svelte';
  import StepIndicator from '$lib/components/shared/StepIndicator.svelte';
  import ProgressBar from '$lib/components/shared/ProgressBar.svelte';
  import SaveDraft from '$lib/components/shared/SaveDraft.svelte';
  import Button from '$lib/components/Button.svelte';
  import { toast } from '$lib/components/shared/Toast.svelte';

  // Form data
  let painPointsData = $derived.by(() => consultationStore.formState.data.pain_points || {});

  // Navigation state
  const currentStep = $derived(() => consultationStore.formState.currentStep);
  const canNavigateNext = $derived(() => consultationStore.canNavigateNext);

  // Set current step to pain points (step 2)
  onMount(async () => {
    await consultationStore.initialize();
    consultationStore.goToStep(2);
  });

  // Navigation handlers
  async function handleNext() {
    const isValid = consultationStore.validateCurrentStep();
    if (!isValid) {
      toast.warning('Please complete the required fields before proceeding.');
      return;
    }

    await consultationStore.save();
    goto('/consultation/goals');
  }

  function handlePrevious() {
    goto('/consultation/business');
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="py-6">
        <h1 class="text-3xl font-bold text-gray-900">Current Challenges</h1>
        <p class="mt-2 text-gray-600">Help us understand your pain points and challenges</p>

        <ProgressBar showPercentage={true} showStepCount={true} class="mt-4" />
      </div>
    </div>
  </div>

  <!-- Step Indicator -->
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
    <StepIndicator
      variant="horizontal"
      showLabels={true}
      allowNavigation={true}
    />
  </div>

  <!-- Form Content -->
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="bg-white shadow-lg rounded-lg">
      <div class="p-6 sm:p-8">
        <PainPointsCapture
          bind:data={painPointsData}
          errors={consultationStore.getSectionErrors('pain_points')}
        />
      </div>

      <!-- Navigation -->
      <div class="border-t border-gray-200 px-6 sm:px-8 py-6">
        <div class="flex items-center justify-between">
          <Button variant="secondary" onclick={handlePrevious}>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </Button>

          <div class="flex items-center space-x-3">
            <SaveDraft position="inline" showButton={false} showStatus={true} compact={true} />

            <Button
              variant="primary"
              onclick={handleNext}
              disabled={!canNavigateNext()}
            >
              Next
              <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
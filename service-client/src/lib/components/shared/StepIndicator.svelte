<script lang="ts">
  import { consultationStore } from '$lib/stores/consultation.svelte';

  // Props
  let {
    variant = 'horizontal',
    showLabels = true,
    allowNavigation = true,
    disabled = false
  }: {
    variant?: 'horizontal' | 'vertical';
    showLabels?: boolean;
    allowNavigation?: boolean;
    disabled?: boolean;
  } = $props();

  // Get store references
  const steps = consultationStore.steps;
  const currentStep = $derived(() => consultationStore.formState.currentStep);
  const completedSteps = $derived(() => consultationStore.formState.completedSteps);
  const totalSteps = $derived(() => consultationStore.totalSteps);
  const canNavigateNext = $derived(() => consultationStore.canNavigateNext);
  const isAutoSaving = $derived(() => consultationStore.formState.isAutoSaving);

  // Step state helpers
  function getStepState(stepIndex: number): 'completed' | 'current' | 'upcoming' | 'available' {
    if (completedSteps.includes(stepIndex)) {
      return 'completed';
    } else if (stepIndex === currentStep) {
      return 'current';
    } else if (canNavigateToStep(stepIndex)) {
      return 'available';
    } else {
      return 'upcoming';
    }
  }

  function canNavigateToStep(stepIndex: number): boolean {
    if (!allowNavigation || disabled || isAutoSaving) return false;

    // Can always go back to completed steps
    if (completedSteps.includes(stepIndex)) return true;

    // Can go to current step
    if (stepIndex === currentStep) return true;

    // Can go to next step if current step is valid
    if (stepIndex === currentStep + 1 && canNavigateNext) return true;

    return false;
  }

  function handleStepClick(stepIndex: number): void {
    if (!canNavigateToStep(stepIndex)) return;
    consultationStore.goToStep(stepIndex);
  }

  function getStepIcon(stepIndex: number, state: string): string {
    switch (state) {
      case 'completed':
        return 'check';
      case 'current':
        return isAutoSaving ? 'loading' : 'current';
      default:
        return 'number';
    }
  }

  function getStepClasses(stepIndex: number, state: string): string {
    const baseClasses = 'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all duration-200';

    const clickableClasses = canNavigateToStep(stepIndex) && !disabled
      ? 'cursor-pointer hover:scale-105'
      : 'cursor-default';

    switch (state) {
      case 'completed':
        return `${baseClasses} ${clickableClasses} bg-green-500 text-white shadow-sm`;
      case 'current':
        return `${baseClasses} ${clickableClasses} bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-200`;
      case 'available':
        return `${baseClasses} ${clickableClasses} bg-indigo-100 text-indigo-600 hover:bg-indigo-200`;
      default:
        return `${baseClasses} bg-gray-200 text-gray-500`;
    }
  }

  function getConnectorClasses(stepIndex: number): string {
    const baseClasses = variant === 'horizontal'
      ? 'flex-1 h-0.5 mx-2'
      : 'w-0.5 h-8 mx-auto my-2';

    const completedBefore = completedSteps.includes(stepIndex);
    const colorClasses = completedBefore
      ? 'bg-green-500'
      : 'bg-gray-300';

    return `${baseClasses} ${colorClasses} transition-colors duration-200`;
  }

  function getStepTitle(step: any): string {
    return step.title;
  }

  function getStepDescription(stepIndex: number, state: string): string {
    switch (state) {
      case 'completed':
        return 'Complete';
      case 'current':
        return isAutoSaving ? 'Saving...' : 'In Progress';
      case 'available':
        return 'Ready';
      default:
        return 'Pending';
    }
  }
</script>

{#if variant === 'horizontal'}
  <!-- Horizontal Layout -->
  <nav aria-label="Progress" class="mb-8">
    <ol class="flex items-center justify-between" role="list">
      {#each steps as step, index}
        {@const state = getStepState(index)}
        {@const icon = getStepIcon(index, state)}
        {@const canClick = canNavigateToStep(index)}

        <li class="relative flex-1" class:first:flex-initial={index === 0} class:last:flex-initial={index === steps.length - 1}>
          <div class="flex items-center">
            <!-- Step Circle -->
            <button
              type="button"
              onclick={() => handleStepClick(index)}
              disabled={!canClick}
              class={getStepClasses(index, state)}
              aria-current={state === 'current' ? 'step' : undefined}
              title={`Step ${index + 1}: ${getStepTitle(step)} - ${getStepDescription(index, state)}`}
            >
              {#if icon === 'check'}
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              {:else if icon === 'loading'}
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              {:else if icon === 'current'}
                <div class="w-2 h-2 bg-white rounded-full"></div>
              {:else}
                <span>{index + 1}</span>
              {/if}
            </button>

            <!-- Connector Line (except for last step) -->
            {#if index < steps.length - 1}
              <div class={getConnectorClasses(index)}></div>
            {/if}
          </div>

          <!-- Step Label -->
          {#if showLabels}
            <div class="absolute top-10 left-1/2 transform -translate-x-1/2 text-center min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate max-w-24">
                {getStepTitle(step)}
              </p>
              <p class="text-xs text-gray-500">
                {getStepDescription(index, state)}
              </p>
            </div>
          {/if}
        </li>
      {/each}
    </ol>

    <!-- Progress Summary -->
    {#if showLabels}
      <div class="mt-16 text-center">
        <p class="text-sm text-gray-600">
          Step {currentStep + 1} of {totalSteps}:
          <span class="font-medium">{getStepTitle(steps[currentStep])}</span>
        </p>
        <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            class="bg-indigo-600 h-2 rounded-full transition-all duration-500"
            style="width: {(completedSteps.length / totalSteps) * 100}%"
          ></div>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {completedSteps.length} of {totalSteps} steps completed ({Math.round((completedSteps.length / totalSteps) * 100)}%)
        </p>
      </div>
    {/if}
  </nav>
{:else}
  <!-- Vertical Layout -->
  <nav aria-label="Progress" class="mb-8">
    <ol class="space-y-1" role="list">
      {#each steps as step, index}
        {@const state = getStepState(index)}
        {@const icon = getStepIcon(index, state)}
        {@const canClick = canNavigateToStep(index)}

        <li>
          <button
            type="button"
            onclick={() => handleStepClick(index)}
            disabled={!canClick}
            class="w-full text-left p-4 rounded-lg transition-all duration-200 {
              state === 'current'
                ? 'bg-indigo-50 border-2 border-indigo-200'
                : state === 'completed'
                  ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                  : canClick
                    ? 'border border-gray-200 hover:bg-gray-50'
                    : 'border border-gray-200 opacity-60'
            }"
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <div class="flex items-center">
              <!-- Step Circle -->
              <div class={getStepClasses(index, state)}>
                {#if icon === 'check'}
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                {:else if icon === 'loading'}
                  <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                {:else if icon === 'current'}
                  <div class="w-2 h-2 bg-white rounded-full"></div>
                {:else}
                  <span>{index + 1}</span>
                {/if}
              </div>

              <!-- Step Content -->
              <div class="ml-4 min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900">
                  {getStepTitle(step)}
                </p>
                <p class="text-sm text-gray-500">
                  {getStepDescription(index, state)}
                </p>
              </div>

              <!-- Navigation Arrow -->
              {#if canClick && state !== 'current'}
                <div class="ml-4">
                  <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
              {/if}
            </div>
          </button>

          <!-- Connector Line (except for last step) -->
          {#if index < steps.length - 1}
            <div class="ml-4 pl-4">
              <div class={getConnectorClasses(index)}></div>
            </div>
          {/if}
        </li>
      {/each}
    </ol>

    <!-- Progress Summary -->
    <div class="mt-6 p-4 bg-gray-50 rounded-lg">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-600">Progress</span>
        <span class="font-medium text-gray-900">
          {completedSteps.length} of {totalSteps} completed
        </span>
      </div>
      <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-indigo-600 h-2 rounded-full transition-all duration-500"
          style="width: {(completedSteps.length / totalSteps) * 100}%"
        ></div>
      </div>
      <p class="text-xs text-gray-500 mt-2">
        Currently on: <span class="font-medium">{getStepTitle(steps[currentStep])}</span>
      </p>
    </div>
  </nav>
{/if}

<!-- Keyboard Navigation Hint -->
{#if allowNavigation && !disabled}
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    Step {currentStep + 1} of {totalSteps}: {getStepTitle(steps[currentStep])}.
    {completedSteps.length} steps completed.
    {canNavigateNext ? 'Ready to proceed to next step.' : 'Complete current step to continue.'}
  </div>
{/if}
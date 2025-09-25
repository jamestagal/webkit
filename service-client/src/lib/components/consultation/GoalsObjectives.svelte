<script lang="ts">
  import type { GoalsObjectives, Timeline } from '$lib/types/consultation';
  import { consultationStore } from '$lib/stores/consultation.svelte';
  import Input from '$lib/components/Input.svelte';
  import Select from '$lib/components/Select.svelte';
  import Textarea from '$lib/components/Textarea.svelte';

  // Props
  let {
    data = $bindable({}),
    errors = [],
    disabled = false
  }: {
    data: GoalsObjectives;
    errors?: string[];
    disabled?: boolean;
  } = $props();

  // Local form state with runes
  let primaryGoals = $state<string[]>(data.primary_goals || []);
  let secondaryGoals = $state<string[]>(data.secondary_goals || []);
  let successMetrics = $state<string[]>(data.success_metrics || []);
  let kpis = $state<string[]>(data.kpis || []);
  let budgetRange = $state(data.budget_range || '');
  let budgetConstraints = $state<string[]>(data.budget_constraints || []);
  let timeline = $state<Timeline>(data.timeline || {});

  // Temporary input values
  let newPrimaryGoal = $state('');
  let newSecondaryGoal = $state('');
  let newSuccessMetric = $state('');
  let newKpi = $state('');
  let newBudgetConstraint = $state('');

  // Timeline fields
  let desiredStart = $state(timeline.desired_start || '');
  let targetCompletion = $state(timeline.target_completion || '');
  let milestones = $state<string[]>(timeline.milestones || []);
  let newMilestone = $state('');

  // Predefined options
  const budgetRangeOptions = [
    { value: '', label: 'Select budget range' },
    { value: 'under-5k', label: 'Under $5,000' },
    { value: '5k-10k', label: '$5,000 - $10,000' },
    { value: '10k-25k', label: '$10,000 - $25,000' },
    { value: '25k-50k', label: '$25,000 - $50,000' },
    { value: '50k-100k', label: '$50,000 - $100,000' },
    { value: '100k-250k', label: '$100,000 - $250,000' },
    { value: '250k-500k', label: '$250,000 - $500,000' },
    { value: 'over-500k', label: 'Over $500,000' },
    { value: 'tbd', label: 'To be determined' }
  ];

  const commonPrimaryGoals = [
    'Increase website traffic',
    'Improve search engine rankings',
    'Boost online sales/conversions',
    'Enhance brand awareness',
    'Expand into new markets',
    'Improve customer experience',
    'Reduce operational costs',
    'Increase customer retention',
    'Launch new products/services',
    'Improve mobile experience',
    'Build stronger online presence',
    'Streamline business processes',
    'Improve data analytics',
    'Enhance security and compliance',
    'Scale business operations'
  ];

  const commonSecondaryGoals = [
    'Integrate with existing systems',
    'Improve team productivity',
    'Reduce manual processes',
    'Better customer support',
    'Improve data visualization',
    'Enhance user interface design',
    'Build API integrations',
    'Implement automation',
    'Improve performance monitoring',
    'Create better documentation',
    'Establish backup procedures',
    'Enhance accessibility',
    'Implement A/B testing',
    'Create training materials',
    'Establish maintenance processes'
  ];

  const commonSuccessMetrics = [
    'Website traffic increase (%)',
    'Conversion rate improvement (%)',
    'Page load speed (seconds)',
    'Search engine ranking positions',
    'Customer satisfaction score',
    'Return on investment (ROI)',
    'Cost per acquisition (CPA)',
    'Customer lifetime value (CLV)',
    'Email open/click rates',
    'Social media engagement',
    'Lead generation numbers',
    'Time on site increase',
    'Bounce rate reduction',
    'Mobile traffic increase',
    'Brand mention/awareness metrics'
  ];

  const commonKpis = [
    'Monthly website visitors',
    'Conversion rate percentage',
    'Average order value',
    'Customer acquisition cost',
    'Monthly recurring revenue',
    'Customer churn rate',
    'Net promoter score (NPS)',
    'Cost per lead',
    'Email subscriber growth',
    'Social media followers',
    'Organic search traffic',
    'Page views per session',
    'Cart abandonment rate',
    'Support ticket volume',
    'System uptime percentage'
  ];

  const commonBudgetConstraints = [
    'Fixed annual budget',
    'Need to show ROI within 6 months',
    'Budget must be spread over multiple phases',
    'Seasonal budget availability',
    'Need approval for amounts over $X',
    'Prefer monthly payment plans',
    'Must justify cost with detailed analysis',
    'Budget dependent on current performance',
    'Need to allocate across multiple departments',
    'Require detailed cost breakdown',
    'Budget review required quarterly',
    'Must compare with other vendor quotes',
    'Need to reserve budget for maintenance',
    'Prefer performance-based pricing',
    'Budget contingent on business growth'
  ];

  // Derived validation
  let isFormValid = $derived(() => {
    return primaryGoals.length > 0 && budgetRange.length > 0;
  });

  // Update parent data when local state changes
  $effect(() => {
    // Update timeline object
    timeline = {
      desired_start: desiredStart || undefined,
      target_completion: targetCompletion || undefined,
      milestones: milestones.length > 0 ? milestones : undefined
    };

    data.primary_goals = primaryGoals.length > 0 ? primaryGoals : undefined;
    data.secondary_goals = secondaryGoals.length > 0 ? secondaryGoals : undefined;
    data.success_metrics = successMetrics.length > 0 ? successMetrics : undefined;
    data.kpis = kpis.length > 0 ? kpis : undefined;
    data.budget_range = budgetRange || undefined;
    data.budget_constraints = budgetConstraints.length > 0 ? budgetConstraints : undefined;
    data.timeline = Object.keys(timeline).length > 0 ? timeline : undefined;

    // Update consultation store
    consultationStore.updateSectionData('goals_objectives', data);
  });

  // Goal management functions
  function addPrimaryGoal(): void {
    if (newPrimaryGoal.trim() && !primaryGoals.includes(newPrimaryGoal.trim())) {
      primaryGoals = [...primaryGoals, newPrimaryGoal.trim()];
      newPrimaryGoal = '';
    }
  }

  function removePrimaryGoal(goal: string): void {
    primaryGoals = primaryGoals.filter(g => g !== goal);
  }

  function addCommonPrimaryGoal(goal: string): void {
    if (!primaryGoals.includes(goal)) {
      primaryGoals = [...primaryGoals, goal];
    }
  }

  function addSecondaryGoal(): void {
    if (newSecondaryGoal.trim() && !secondaryGoals.includes(newSecondaryGoal.trim())) {
      secondaryGoals = [...secondaryGoals, newSecondaryGoal.trim()];
      newSecondaryGoal = '';
    }
  }

  function removeSecondaryGoal(goal: string): void {
    secondaryGoals = secondaryGoals.filter(g => g !== goal);
  }

  function addCommonSecondaryGoal(goal: string): void {
    if (!secondaryGoals.includes(goal)) {
      secondaryGoals = [...secondaryGoals, goal];
    }
  }

  // Metrics management functions
  function addSuccessMetric(): void {
    if (newSuccessMetric.trim() && !successMetrics.includes(newSuccessMetric.trim())) {
      successMetrics = [...successMetrics, newSuccessMetric.trim()];
      newSuccessMetric = '';
    }
  }

  function removeSuccessMetric(metric: string): void {
    successMetrics = successMetrics.filter(m => m !== metric);
  }

  function addCommonSuccessMetric(metric: string): void {
    if (!successMetrics.includes(metric)) {
      successMetrics = [...successMetrics, metric];
    }
  }

  function addKpi(): void {
    if (newKpi.trim() && !kpis.includes(newKpi.trim())) {
      kpis = [...kpis, newKpi.trim()];
      newKpi = '';
    }
  }

  function removeKpi(kpi: string): void {
    kpis = kpis.filter(k => k !== kpi);
  }

  function addCommonKpi(kpi: string): void {
    if (!kpis.includes(kpi)) {
      kpis = [...kpis, kpi];
    }
  }

  // Budget constraint management
  function addBudgetConstraint(): void {
    if (newBudgetConstraint.trim() && !budgetConstraints.includes(newBudgetConstraint.trim())) {
      budgetConstraints = [...budgetConstraints, newBudgetConstraint.trim()];
      newBudgetConstraint = '';
    }
  }

  function removeBudgetConstraint(constraint: string): void {
    budgetConstraints = budgetConstraints.filter(c => c !== constraint);
  }

  function addCommonBudgetConstraint(constraint: string): void {
    if (!budgetConstraints.includes(constraint)) {
      budgetConstraints = [...budgetConstraints, constraint];
    }
  }

  // Milestone management
  function addMilestone(): void {
    if (newMilestone.trim() && !milestones.includes(newMilestone.trim())) {
      milestones = [...milestones, newMilestone.trim()];
      newMilestone = '';
    }
  }

  function removeMilestone(milestone: string): void {
    milestones = milestones.filter(m => m !== milestone);
  }

  // Keyboard event handlers
  function handlePrimaryGoalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addPrimaryGoal();
    }
  }

  function handleSecondaryGoalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSecondaryGoal();
    }
  }

  function handleSuccessMetricKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSuccessMetric();
    }
  }

  function handleKpiKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addKpi();
    }
  }

  function handleBudgetConstraintKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addBudgetConstraint();
    }
  }

  function handleMilestoneKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addMilestone();
    }
  }

  // Date validation
  function formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  function parseDateFromInput(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toISOString();
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900">Goals & Objectives</h2>
    <p class="mt-1 text-sm text-gray-600">
      Define what you want to achieve and how you'll measure success.
    </p>
  </div>

  <!-- Error Summary -->
  {#if errors.length > 0}
    <div class="rounded-md bg-red-50 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Please correct the following errors:</h3>
          <div class="mt-2 text-sm text-red-700">
            <ul class="list-disc list-inside">
              {#each errors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Primary Goals -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Primary Goals *
    </label>
    <p class="text-sm text-gray-600 mb-3">
      What are the main objectives you want to achieve?
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonPrimaryGoals as goal}
        {#if !primaryGoals.includes(goal)}
          <button
            type="button"
            onclick={() => addCommonPrimaryGoal(goal)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {goal}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newPrimaryGoal}
        onkeydown={handlePrimaryGoalKeydown}
        placeholder="Add a custom primary goal"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addPrimaryGoal}
        disabled={disabled || !newPrimaryGoal.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if primaryGoals.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each primaryGoals as goal}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {goal}
            <button
              type="button"
              onclick={() => removePrimaryGoal(goal)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </path>
            </svg>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Secondary Goals -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Secondary Goals
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      Additional objectives that would be nice to achieve.
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonSecondaryGoals as goal}
        {#if !secondaryGoals.includes(goal)}
          <button
            type="button"
            onclick={() => addCommonSecondaryGoal(goal)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {goal}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newSecondaryGoal}
        onkeydown={handleSecondaryGoalKeydown}
        placeholder="Add a secondary goal"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addSecondaryGoal}
        disabled={disabled || !newSecondaryGoal.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if secondaryGoals.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each secondaryGoals as goal}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
            {goal}
            <button
              type="button"
              onclick={() => removeSecondaryGoal(goal)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-indigo-400 hover:text-indigo-600 disabled:opacity-50"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </path>
            </svg>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Timeline -->
  <div class="border-t pt-6">
    <h3 class="text-lg font-medium text-gray-900 mb-4">Project Timeline</h3>

    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <!-- Desired Start Date -->
      <div>
        <Input
          value={formatDateForInput(desiredStart)}
          oninput={(e) => { desiredStart = parseDateFromInput(e.target.value); }}
          type="date"
          label="Desired Start Date"
          disabled={disabled}
        />
      </div>

      <!-- Target Completion Date -->
      <div>
        <Input
          value={formatDateForInput(targetCompletion)}
          oninput={(e) => { targetCompletion = parseDateFromInput(e.target.value); }}
          type="date"
          label="Target Completion Date"
          disabled={disabled}
        />
      </div>
    </div>

    <!-- Milestones -->
    <div class="mt-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Key Milestones
        <span class="text-gray-500 font-normal">(Optional)</span>
      </label>
      <p class="text-sm text-gray-600 mb-3">
        Important checkpoints or deliverables throughout the project.
      </p>

      <!-- Add Milestone -->
      <div class="flex space-x-2 mb-3">
        <Input
          bind:value={newMilestone}
          onkeydown={handleMilestoneKeydown}
          placeholder="Add a project milestone"
          disabled={disabled}
          class="flex-1"
        />
        <button
          type="button"
          onclick={addMilestone}
          disabled={disabled || !newMilestone.trim()}
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      <!-- Selected Milestones -->
      {#if milestones.length > 0}
        <div class="space-y-2">
          {#each milestones as milestone, index}
            <div class="flex items-center justify-between bg-gray-50 rounded-md p-3">
              <div class="flex items-center space-x-3">
                <span class="flex-shrink-0 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                  {index + 1}
                </span>
                <span class="text-sm text-gray-900">{milestone}</span>
              </div>
              <button
                type="button"
                onclick={() => removeMilestone(milestone)}
                disabled={disabled}
                class="text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </path>
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Budget Section -->
<div class="border-t pt-6">
  <h3 class="text-lg font-medium text-gray-900 mb-4">Budget Information</h3>

  <!-- Budget Range -->
  <div class="mb-6">
    <Select
      bind:value={budgetRange}
      label="Budget Range"
      options={budgetRangeOptions}
      disabled={disabled}
      required={true}
    />
  </div>

  <!-- Budget Constraints -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Budget Constraints
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      Any specific requirements or limitations regarding budget and payments.
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonBudgetConstraints as constraint}
        {#if !budgetConstraints.includes(constraint)}
          <button
            type="button"
            onclick={() => addCommonBudgetConstraint(constraint)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {constraint}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newBudgetConstraint}
        onkeydown={handleBudgetConstraintKeydown}
        placeholder="Add a budget constraint"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addBudgetConstraint}
        disabled={disabled || !newBudgetConstraint.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if budgetConstraints.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each budgetConstraints as constraint}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            {constraint}
            <button
              type="button"
              onclick={() => removeBudgetConstraint(constraint)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-yellow-400 hover:text-yellow-600 disabled:opacity-50"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </path>
            </svg>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Success Metrics Section -->
<div class="border-t pt-6">
  <h3 class="text-lg font-medium text-gray-900 mb-4">Success Measurement</h3>

  <!-- Success Metrics -->
  <div class="mb-6">
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Success Metrics
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      How will you measure the success of this project?
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonSuccessMetrics as metric}
        {#if !successMetrics.includes(metric)}
          <button
            type="button"
            onclick={() => addCommonSuccessMetric(metric)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {metric}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newSuccessMetric}
        onkeydown={handleSuccessMetricKeydown}
        placeholder="Add a success metric"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addSuccessMetric}
        disabled={disabled || !newSuccessMetric.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if successMetrics.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each successMetrics as metric}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            {metric}
            <button
              type="button"
              onclick={() => removeSuccessMetric(metric)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:text-green-600 disabled:opacity-50"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </path>
            </svg>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- KPIs -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Key Performance Indicators (KPIs)
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      Specific metrics you'll track regularly to monitor progress.
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonKpis as kpi}
        {#if !kpis.includes(kpi)}
          <button
            type="button"
            onclick={() => addCommonKpi(kpi)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {kpi}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newKpi}
        onkeydown={handleKpiKeydown}
        placeholder="Add a KPI"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addKpi}
        disabled={disabled || !newKpi.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if kpis.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each kpis as kpi}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            {kpi}
            <button
              type="button"
              onclick={() => removeKpi(kpi)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-400 hover:text-purple-600 disabled:opacity-50"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </path>
            </svg>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Form Status Indicator -->
<div class="flex items-center space-x-2 text-sm pt-6 border-t">
  {#if isFormValid}
    <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
    </svg>
    <span class="text-green-700">Goals and objectives are complete</span>
  {:else}
    <svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
    </svg>
    <span class="text-yellow-700">Please add at least one primary goal and select a budget range</span>
  {/if}

  {#if consultationStore.formState.isAutoSaving}
    <div class="flex items-center space-x-1 text-blue-600">
      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="text-sm">Saving...</span>
    </div>
  {:else if consultationStore.formState.lastSaved}
    <span class="text-gray-500">
      Saved {consultationStore.formState.lastSaved.toLocaleTimeString()}
    </span>
  {/if}
</div>
</div>
<script lang="ts">
  import type { PainPoints, UrgencyLevel } from '$lib/types/consultation';
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
    data: PainPoints;
    errors?: string[];
    disabled?: boolean;
  } = $props();

  // Local form state with runes
  let primaryChallenges = $state<string[]>(data.primary_challenges || []);
  let technicalIssues = $state<string[]>(data.technical_issues || []);
  let urgencyLevel = $state<UrgencyLevel | undefined>(data.urgency_level);
  let impactAssessment = $state(data.impact_assessment || '');
  let currentSolutionGaps = $state<string[]>(data.current_solution_gaps || []);

  // Temporary input values
  let newChallenge = $state('');
  let newTechnicalIssue = $state('');
  let newSolutionGap = $state('');

  // Predefined options
  const urgencyOptions = [
    { value: '', label: 'Select urgency level' },
    { value: 'low', label: 'Low - Can wait several months' },
    { value: 'medium', label: 'Medium - Needed within 2-3 months' },
    { value: 'high', label: 'High - Needed within 4-6 weeks' },
    { value: 'critical', label: 'Critical - Needed immediately' }
  ];

  const commonChallenges = [
    'Low website traffic',
    'Poor search engine rankings',
    'Outdated website design',
    'Slow website performance',
    'Low conversion rates',
    'Lack of mobile optimization',
    'Poor user experience',
    'Limited online presence',
    'Ineffective marketing campaigns',
    'High customer acquisition costs',
    'Poor brand recognition',
    'Lack of analytics and tracking',
    'Manual processes',
    'Scalability issues',
    'Security concerns',
    'Integration problems',
    'High maintenance costs',
    'Limited functionality',
    'Poor customer support tools',
    'Inventory management issues'
  ];

  const commonTechnicalIssues = [
    'Website crashes frequently',
    'Slow loading times',
    'Database performance issues',
    'SSL certificate problems',
    'Email delivery issues',
    'Payment processing failures',
    'Form submission errors',
    'Search functionality broken',
    'Mobile compatibility issues',
    'Browser compatibility problems',
    'API integration failures',
    'Backup and recovery issues',
    'Security vulnerabilities',
    'Plugin/extension conflicts',
    'Hosting limitations',
    'CDN configuration issues',
    'Cache management problems',
    'Image optimization issues',
    'Video streaming problems',
    'Third-party service integration issues'
  ];

  const commonSolutionGaps = [
    'Lack of CRM integration',
    'No email marketing automation',
    'Missing analytics tracking',
    'No A/B testing capabilities',
    'Limited SEO tools',
    'No social media integration',
    'Missing e-commerce features',
    'No customer support chat',
    'Limited reporting capabilities',
    'No backup solutions',
    'Missing security monitoring',
    'No performance optimization',
    'Limited scalability options',
    'No user management system',
    'Missing content management features',
    'No lead generation tools',
    'Limited payment options',
    'No inventory management',
    'Missing workflow automation',
    'No disaster recovery plan'
  ];

  // Validation state
  let impactAssessmentError = $state('');

  // Derived validation
  let isFormValid = $derived(() => {
    return primaryChallenges.length > 0 && urgencyLevel !== undefined;
  });

  // Update parent data when local state changes
  $effect(() => {
    data.primary_challenges = primaryChallenges.length > 0 ? primaryChallenges : undefined;
    data.technical_issues = technicalIssues.length > 0 ? technicalIssues : undefined;
    data.urgency_level = urgencyLevel;
    data.impact_assessment = impactAssessment.trim() || undefined;
    data.current_solution_gaps = currentSolutionGaps.length > 0 ? currentSolutionGaps : undefined;

    // Update consultation store
    consultationStore.updateSectionData('pain_points', data);
  });

  // Primary challenges management
  function addChallenge(): void {
    if (newChallenge.trim() && !primaryChallenges.includes(newChallenge.trim())) {
      primaryChallenges = [...primaryChallenges, newChallenge.trim()];
      newChallenge = '';
    }
  }

  function removeChallenge(challenge: string): void {
    primaryChallenges = primaryChallenges.filter(c => c !== challenge);
  }

  function addCommonChallenge(challenge: string): void {
    if (!primaryChallenges.includes(challenge)) {
      primaryChallenges = [...primaryChallenges, challenge];
    }
  }

  // Technical issues management
  function addTechnicalIssue(): void {
    if (newTechnicalIssue.trim() && !technicalIssues.includes(newTechnicalIssue.trim())) {
      technicalIssues = [...technicalIssues, newTechnicalIssue.trim()];
      newTechnicalIssue = '';
    }
  }

  function removeTechnicalIssue(issue: string): void {
    technicalIssues = technicalIssues.filter(i => i !== issue);
  }

  function addCommonTechnicalIssue(issue: string): void {
    if (!technicalIssues.includes(issue)) {
      technicalIssues = [...technicalIssues, issue];
    }
  }

  // Solution gaps management
  function addSolutionGap(): void {
    if (newSolutionGap.trim() && !currentSolutionGaps.includes(newSolutionGap.trim())) {
      currentSolutionGaps = [...currentSolutionGaps, newSolutionGap.trim()];
      newSolutionGap = '';
    }
  }

  function removeSolutionGap(gap: string): void {
    currentSolutionGaps = currentSolutionGaps.filter(g => g !== gap);
  }

  function addCommonSolutionGap(gap: string): void {
    if (!currentSolutionGaps.includes(gap)) {
      currentSolutionGaps = [...currentSolutionGaps, gap];
    }
  }

  // Handle keyboard events
  function handleChallengeKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addChallenge();
    }
  }

  function handleTechnicalIssueKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTechnicalIssue();
    }
  }

  function handleSolutionGapKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSolutionGap();
    }
  }

  // Get urgency level color class
  function getUrgencyColorClass(level: UrgencyLevel | undefined): string {
    switch (level) {
      case 'low': return 'text-green-700 bg-green-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'critical': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900">Pain Points & Challenges</h2>
    <p class="mt-1 text-sm text-gray-600">
      Help us understand the current challenges and issues you're facing.
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

  <!-- Primary Challenges -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Primary Challenges *
    </label>
    <p class="text-sm text-gray-600 mb-3">
      What are the main business challenges you're currently facing?
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonChallenges as challenge}
        {#if !primaryChallenges.includes(challenge)}
          <button
            type="button"
            onclick={() => addCommonChallenge(challenge)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {challenge}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newChallenge}
        onkeydown={handleChallengeKeydown}
        placeholder="Add a custom challenge"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addChallenge}
        disabled={disabled || !newChallenge.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if primaryChallenges.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each primaryChallenges as challenge}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            {challenge}
            <button
              type="button"
              onclick={() => removeChallenge(challenge)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-400 hover:text-red-600 disabled:opacity-50"
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

  <!-- Technical Issues -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Technical Issues
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      Are there any specific technical problems you're experiencing?
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonTechnicalIssues as issue}
        {#if !technicalIssues.includes(issue)}
          <button
            type="button"
            onclick={() => addCommonTechnicalIssue(issue)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {issue}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newTechnicalIssue}
        onkeydown={handleTechnicalIssueKeydown}
        placeholder="Add a technical issue"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addTechnicalIssue}
        disabled={disabled || !newTechnicalIssue.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if technicalIssues.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each technicalIssues as issue}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
            {issue}
            <button
              type="button"
              onclick={() => removeTechnicalIssue(issue)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-orange-400 hover:text-orange-600 disabled:opacity-50"
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

  <!-- Urgency Level -->
  <div>
    <Select
      bind:value={urgencyLevel}
      label="Urgency Level"
      options={urgencyOptions}
      disabled={disabled}
      required={true}
    />
    {#if urgencyLevel}
      <div class="mt-2">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getUrgencyColorClass(urgencyLevel)}">
          {urgencyLevel.toUpperCase()}: {urgencyOptions.find(o => o.value === urgencyLevel)?.label.split(' - ')[1] || ''}
        </span>
      </div>
    {/if}
  </div>

  <!-- Impact Assessment -->
  <div>
    <Textarea
      bind:value={impactAssessment}
      label="Impact Assessment"
      placeholder="How are these challenges affecting your business? What's the cost of not addressing them?"
      rows={4}
      disabled={disabled}
      error={impactAssessmentError}
    />
    <p class="mt-1 text-sm text-gray-500">
      Describe the business impact of these challenges (e.g., lost revenue, reduced efficiency, customer dissatisfaction).
    </p>
  </div>

  <!-- Current Solution Gaps -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Current Solution Gaps
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      What's missing from your current solutions or systems?
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
      {#each commonSolutionGaps as gap}
        {#if !currentSolutionGaps.includes(gap)}
          <button
            type="button"
            onclick={() => addCommonSolutionGap(gap)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {gap}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newSolutionGap}
        onkeydown={handleSolutionGapKeydown}
        placeholder="Add a solution gap"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addSolutionGap}
        disabled={disabled || !newSolutionGap.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if currentSolutionGaps.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each currentSolutionGaps as gap}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            {gap}
            <button
              type="button"
              onclick={() => removeSolutionGap(gap)}
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

  <!-- Form Status Indicator -->
  <div class="flex items-center space-x-2 text-sm">
    {#if isFormValid}
      <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <span class="text-green-700">Pain points assessment is complete</span>
    {:else}
      <svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <span class="text-yellow-700">Please add at least one challenge and select urgency level</span>
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
<script lang="ts">
  import type { BusinessContext } from '$lib/types/consultation';
  import { consultationStore } from '$lib/stores/consultation.svelte';
  import Input from '$lib/components/Input.svelte';
  import Select from '$lib/components/Select.svelte';

  // Props
  let {
    data = $bindable({}),
    errors = [],
    disabled = false
  }: {
    data: BusinessContext;
    errors?: string[];
    disabled?: boolean;
  } = $props();

  // Local form state with runes
  let industry = $state(data.industry || '');
  let businessType = $state(data.business_type || '');
  let teamSize = $state(data.team_size || 1);
  let currentPlatform = $state(data.current_platform || '');
  let digitalPresence = $state<string[]>(data.digital_presence || []);
  let marketingChannels = $state<string[]>(data.marketing_channels || []);

  // Temporary input values for adding new items
  let newDigitalPresence = $state('');
  let newMarketingChannel = $state('');

  // Predefined options
  const industryOptions = [
    { value: '', label: 'Select an industry' },
    { value: 'technology', label: 'Technology' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'finance', label: 'Finance & Banking' },
    { value: 'retail', label: 'Retail & E-commerce' },
    { value: 'education', label: 'Education' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'hospitality', label: 'Hospitality & Tourism' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'agriculture', label: 'Agriculture' },
    { value: 'non-profit', label: 'Non-Profit' },
    { value: 'government', label: 'Government' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'media', label: 'Media & Entertainment' },
    { value: 'other', label: 'Other' }
  ];

  const businessTypeOptions = [
    { value: '', label: 'Select business type' },
    { value: 'startup', label: 'Startup' },
    { value: 'small-business', label: 'Small Business' },
    { value: 'mid-market', label: 'Mid-Market Company' },
    { value: 'enterprise', label: 'Enterprise' },
    { value: 'non-profit', label: 'Non-Profit Organization' },
    { value: 'government', label: 'Government Agency' },
    { value: 'freelancer', label: 'Freelancer/Solopreneur' }
  ];

  const commonDigitalPresences = [
    'Website', 'LinkedIn', 'Facebook', 'Instagram', 'Twitter', 'YouTube',
    'TikTok', 'Google My Business', 'Yelp', 'Amazon', 'Shopify'
  ];

  const commonMarketingChannels = [
    'SEO/Organic Search', 'Google Ads', 'Facebook Ads', 'Instagram Ads',
    'LinkedIn Ads', 'Email Marketing', 'Content Marketing', 'Social Media',
    'Word of Mouth', 'Referrals', 'Trade Shows', 'Print Advertising',
    'Radio', 'TV', 'Direct Mail', 'Cold Calling', 'Influencer Marketing'
  ];

  // Validation state
  let teamSizeError = $state('');

  // Derived validation
  let isTeamSizeValid = $derived(() => {
    return teamSize >= 1 && teamSize <= 10000;
  });

  let isFormValid = $derived(() => {
    return industry.length > 0 && businessType.length > 0 && isTeamSizeValid;
  });

  // Update parent data when local state changes
  $effect(() => {
    data.industry = industry || undefined;
    data.business_type = businessType || undefined;
    data.team_size = teamSize || undefined;
    data.current_platform = currentPlatform || undefined;
    data.digital_presence = digitalPresence.length > 0 ? digitalPresence : undefined;
    data.marketing_channels = marketingChannels.length > 0 ? marketingChannels : undefined;

    // Update consultation store
    consultationStore.updateSectionData('business_context', data);
  });

  // Update validation errors
  $effect(() => {
    teamSizeError = !isTeamSizeValid ? 'Team size must be between 1 and 10,000' : '';
  });

  // Digital presence management
  function addDigitalPresence(): void {
    if (newDigitalPresence.trim() && !digitalPresence.includes(newDigitalPresence.trim())) {
      digitalPresence = [...digitalPresence, newDigitalPresence.trim()];
      newDigitalPresence = '';
    }
  }

  function removeDigitalPresence(item: string): void {
    digitalPresence = digitalPresence.filter(p => p !== item);
  }

  function addCommonDigitalPresence(item: string): void {
    if (!digitalPresence.includes(item)) {
      digitalPresence = [...digitalPresence, item];
    }
  }

  // Marketing channels management
  function addMarketingChannel(): void {
    if (newMarketingChannel.trim() && !marketingChannels.includes(newMarketingChannel.trim())) {
      marketingChannels = [...marketingChannels, newMarketingChannel.trim()];
      newMarketingChannel = '';
    }
  }

  function removeMarketingChannel(item: string): void {
    marketingChannels = marketingChannels.filter(c => c !== item);
  }

  function addCommonMarketingChannel(item: string): void {
    if (!marketingChannels.includes(item)) {
      marketingChannels = [...marketingChannels, item];
    }
  }

  // Handle keyboard events for adding items
  function handleDigitalPresenceKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDigitalPresence();
    }
  }

  function handleMarketingChannelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addMarketingChannel();
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900">Business Context</h2>
    <p class="mt-1 text-sm text-gray-600">
      Help us understand your business and current digital presence.
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

  <!-- Form Fields -->
  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
    <!-- Industry -->
    <div class="sm:col-span-2">
      <Select
        bind:value={industry}
        label="Industry"
        options={industryOptions}
        disabled={disabled}
        required={true}
      />
    </div>

    <!-- Business Type -->
    <div>
      <Select
        bind:value={businessType}
        label="Business Type"
        options={businessTypeOptions}
        disabled={disabled}
        required={true}
      />
    </div>

    <!-- Team Size -->
    <div>
      <Input
        bind:value={teamSize}
        type="number"
        label="Team Size"
        placeholder="Number of employees/team members"
        min="1"
        max="10000"
        disabled={disabled}
        error={teamSizeError}
        required={true}
      />
    </div>

    <!-- Current Platform -->
    <div class="sm:col-span-2">
      <Input
        bind:value={currentPlatform}
        label="Current Platform/Website"
        placeholder="e.g., WordPress, Shopify, Custom solution, None"
        disabled={disabled}
      />
    </div>
  </div>

  <!-- Digital Presence -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Digital Presence
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      Where does your business currently have an online presence?
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3">
      {#each commonDigitalPresences as presence}
        {#if !digitalPresence.includes(presence)}
          <button
            type="button"
            onclick={() => addCommonDigitalPresence(presence)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {presence}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newDigitalPresence}
        onkeydown={handleDigitalPresenceKeydown}
        placeholder="Add custom digital presence"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addDigitalPresence}
        disabled={disabled || !newDigitalPresence.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if digitalPresence.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each digitalPresence as presence}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
            {presence}
            <button
              type="button"
              onclick={() => removeDigitalPresence(presence)}
              disabled={disabled}
              class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-indigo-400 hover:text-indigo-600 disabled:opacity-50"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </path>
            </svg>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Marketing Channels -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Current Marketing Channels
      <span class="text-gray-500 font-normal">(Optional)</span>
    </label>
    <p class="text-sm text-gray-600 mb-3">
      How do you currently reach and acquire customers?
    </p>

    <!-- Quick Add Buttons -->
    <div class="flex flex-wrap gap-2 mb-3">
      {#each commonMarketingChannels as channel}
        {#if !marketingChannels.includes(channel)}
          <button
            type="button"
            onclick={() => addCommonMarketingChannel(channel)}
            disabled={disabled}
            class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {channel}
          </button>
        {/if}
      {/each}
    </div>

    <!-- Custom Input -->
    <div class="flex space-x-2 mb-3">
      <Input
        bind:value={newMarketingChannel}
        onkeydown={handleMarketingChannelKeydown}
        placeholder="Add custom marketing channel"
        disabled={disabled}
        class="flex-1"
      />
      <button
        type="button"
        onclick={addMarketingChannel}
        disabled={disabled || !newMarketingChannel.trim()}
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>

    <!-- Selected Items -->
    {#if marketingChannels.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each marketingChannels as channel}
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            {channel}
            <button
              type="button"
              onclick={() => removeMarketingChannel(channel)}
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

  <!-- Form Status Indicator -->
  <div class="flex items-center space-x-2 text-sm">
    {#if isFormValid}
      <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <span class="text-green-700">Business context is complete</span>
    {:else}
      <svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <span class="text-yellow-700">Please complete required fields (Industry & Business Type)</span>
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
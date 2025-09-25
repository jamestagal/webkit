<script lang="ts">
  import type { ContactInfo } from '$lib/types/consultation';
  import { consultationStore } from '$lib/stores/consultation.svelte';
  import Input from '$lib/components/Input.svelte';
  import Textarea from '$lib/components/Textarea.svelte';

  // Props
  let {
    data = $bindable({}),
    errors = [],
    disabled = false
  }: {
    data: ContactInfo;
    errors?: string[];
    disabled?: boolean;
  } = $props();

  // Local form state with runes
  let businessName = $state(data.business_name || '');
  let contactPerson = $state(data.contact_person || '');
  let email = $state(data.email || '');
  let phone = $state(data.phone || '');
  let website = $state(data.website || '');
  let socialMediaJson = $state(JSON.stringify(data.social_media || {}, null, 2));

  // Validation state
  let emailError = $state('');
  let websiteError = $state('');
  let socialMediaError = $state('');

  // Derived validation
  let isEmailValid = $derived(() => {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  });

  let isWebsiteValid = $derived(() => {
    if (!website) return true; // Optional field
    try {
      new URL(website);
      return true;
    } catch {
      return false;
    }
  });

  let parsedSocialMedia = $derived(() => {
    if (!socialMediaJson.trim()) return {};
    try {
      return JSON.parse(socialMediaJson);
    } catch {
      return null;
    }
  });

  let isSocialMediaValid = $derived(() => parsedSocialMedia !== null);

  let isFormValid = $derived(() =>
    isEmailValid && isWebsiteValid && isSocialMediaValid
  );

  // Update parent data when local state changes
  $effect(() => {
    if (isFormValid) {
      data.business_name = businessName.trim() || undefined;
      data.contact_person = contactPerson.trim() || undefined;
      data.email = email.trim() || undefined;
      data.phone = phone.trim() || undefined;
      data.website = website.trim() || undefined;
      data.social_media = parsedSocialMedia && Object.keys(parsedSocialMedia).length > 0
        ? parsedSocialMedia
        : undefined;

      // Update consultation store
      consultationStore.updateSectionData('contact_info', data);
    }
  });

  // Update validation errors
  $effect(() => {
    emailError = !isEmailValid ? 'Please enter a valid email address' : '';
    websiteError = !isWebsiteValid ? 'Please enter a valid website URL' : '';
    socialMediaError = !isSocialMediaValid ? 'Invalid JSON format' : '';
  });

  // Focus management
  let businessNameRef: HTMLInputElement;

  $effect(() => {
    // Focus first field when component mounts
    if (businessNameRef) {
      businessNameRef.focus();
    }
  });

  // Handle social media shortcuts
  function addSocialMediaPlatform(platform: string): void {
    try {
      const current = JSON.parse(socialMediaJson || '{}');
      current[platform] = '';
      socialMediaJson = JSON.stringify(current, null, 2);
    } catch {
      socialMediaJson = JSON.stringify({ [platform]: '' }, null, 2);
    }
  }

  // Auto-format phone number
  function formatPhoneNumber(value: string): string {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return value;
  }

  // Handle phone input
  function handlePhoneInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const formatted = formatPhoneNumber(target.value);
    phone = formatted;
    target.value = formatted;
  }

  // Handle website input - auto-add protocol
  function handleWebsiteBlur(): void {
    if (website && !website.match(/^https?:\/\//)) {
      website = 'https://' + website;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-gray-900">Contact Information</h2>
    <p class="mt-1 text-sm text-gray-600">
      Tell us about your business and how we can reach you.
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
    <!-- Business Name -->
    <div class="sm:col-span-2">
      <Input
        bind:ref={businessNameRef}
        bind:value={businessName}
        label="Business Name"
        placeholder="Your company or organization name"
        disabled={disabled}
        autocomplete="organization"
      />
    </div>

    <!-- Contact Person -->
    <div class="sm:col-span-2">
      <Input
        bind:value={contactPerson}
        label="Contact Person"
        placeholder="Primary contact person"
        disabled={disabled}
        autocomplete="name"
      />
    </div>

    <!-- Email -->
    <div>
      <Input
        bind:value={email}
        type="email"
        label="Email Address"
        placeholder="contact@company.com"
        disabled={disabled}
        required={true}
        error={emailError}
        autocomplete="email"
      />
    </div>

    <!-- Phone -->
    <div>
      <Input
        value={phone}
        oninput={handlePhoneInput}
        type="tel"
        label="Phone Number"
        placeholder="(555) 123-4567"
        disabled={disabled}
        autocomplete="tel"
      />
    </div>

    <!-- Website -->
    <div class="sm:col-span-2">
      <Input
        bind:value={website}
        onblur={handleWebsiteBlur}
        type="url"
        label="Website"
        placeholder="https://www.company.com"
        disabled={disabled}
        error={websiteError}
        autocomplete="url"
      />
    </div>

    <!-- Social Media -->
    <div class="sm:col-span-2">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Social Media Profiles
        <span class="text-gray-500 font-normal">(Optional)</span>
      </label>

      <!-- Quick Add Buttons -->
      <div class="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onclick={() => addSocialMediaPlatform('linkedin')}
          disabled={disabled}
          class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          LinkedIn
        </button>
        <button
          type="button"
          onclick={() => addSocialMediaPlatform('twitter')}
          disabled={disabled}
          class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Twitter
        </button>
        <button
          type="button"
          onclick={() => addSocialMediaPlatform('facebook')}
          disabled={disabled}
          class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Facebook
        </button>
        <button
          type="button"
          onclick={() => addSocialMediaPlatform('instagram')}
          disabled={disabled}
          class="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Instagram
        </button>
      </div>

      <Textarea
        bind:value={socialMediaJson}
        placeholder='{\n  "linkedin": "https://linkedin.com/company/yourcompany",\n  "twitter": "https://twitter.com/yourcompany"\n}'
        rows={4}
        disabled={disabled}
        error={socialMediaError}
        class="font-mono text-sm"
      />
      <p class="mt-1 text-sm text-gray-500">
        Add your social media profiles in JSON format. Use the buttons above for quick setup.
      </p>
    </div>
  </div>

  <!-- Form Status Indicator -->
  <div class="flex items-center space-x-2 text-sm">
    {#if isFormValid}
      <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <span class="text-green-700">Contact information is complete</span>
    {:else}
      <svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <span class="text-yellow-700">Please review and complete the form</span>
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

<style>
  /* Custom JSON editor styling */
  :global(.font-mono) {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  }
</style>
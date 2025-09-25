<script lang="ts">
  import { consultationStore } from '$lib/stores/consultation.svelte';
  import { onMount } from 'svelte';

  // Props
  let {
    position = 'bottom-right',
    showButton = true,
    showStatus = true,
    autoSave = true,
    compact = false
  }: {
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
    showButton?: boolean;
    showStatus?: boolean;
    autoSave?: boolean;
    compact?: boolean;
  } = $props();

  // Get store references
  const isDirty = $derived(() => consultationStore.formState.isDirty);
  const isAutoSaving = $derived(() => consultationStore.formState.isAutoSaving);
  const lastSaved = $derived(() => consultationStore.formState.lastSaved);
  const hasUnsavedChanges = $derived(() => consultationStore.hasUnsavedChanges);
  const saving = $derived(() => consultationStore.saving);

  // Local state
  let showSuccessAnimation = $state(false);
  let lastSaveStatus = $state<'success' | 'error' | null>(null);

  // Position classes
  const positionClasses = {
    'top-right': 'fixed top-4 right-4 z-40',
    'top-left': 'fixed top-4 left-4 z-40',
    'bottom-right': 'fixed bottom-4 right-4 z-40',
    'bottom-left': 'fixed bottom-4 left-4 z-40',
    'inline': 'relative'
  };

  // Watch for save completion
  let previousSaving = false;
  $effect(() => {
    if (previousSaving && !saving && !isAutoSaving) {
      // Save just completed
      showSuccessAnimation = true;
      lastSaveStatus = 'success';

      setTimeout(() => {
        showSuccessAnimation = false;
      }, 2000);
    }
    previousSaving = saving;
  });

  // Manual save function
  async function handleSave(): Promise<void> {
    try {
      const success = await consultationStore.save();
      lastSaveStatus = success ? 'success' : 'error';
    } catch (error) {
      console.error('Save failed:', error);
      lastSaveStatus = 'error';
    }
  }

  // Format last saved time
  function formatLastSaved(date: Date | undefined): string {
    if (!date) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 30) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  }

  // Get save status info
  const saveStatusInfo = $derived(() => {
    if (isAutoSaving) {
      return {
        icon: 'saving',
        message: 'Auto-saving...',
        className: 'text-blue-600'
      };
    }

    if (saving) {
      return {
        icon: 'saving',
        message: 'Saving...',
        className: 'text-blue-600'
      };
    }

    if (showSuccessAnimation) {
      return {
        icon: 'success',
        message: 'Saved!',
        className: 'text-green-600'
      };
    }

    if (hasUnsavedChanges) {
      return {
        icon: 'unsaved',
        message: 'Unsaved changes',
        className: 'text-yellow-600'
      };
    }

    if (lastSaved) {
      return {
        icon: 'saved',
        message: `Saved ${formatLastSaved(lastSaved)}`,
        className: 'text-gray-500'
      };
    }

    return {
      icon: 'none',
      message: '',
      className: 'text-gray-500'
    };
  });

  // Keyboard shortcut handler
  function handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      if (hasUnsavedChanges) {
        handleSave();
      }
    }
  }

  // Add keyboard listener on mount
  onMount(() => {
    if (showButton) {
      document.addEventListener('keydown', handleKeydown);
      return () => {
        document.removeEventListener('keydown', handleKeydown);
      };
    }
  });
</script>

<div class="{positionClasses[position]}">
  <div class="flex items-center space-x-3 {
    position === 'inline' ? '' : 'bg-white shadow-lg rounded-lg px-4 py-2 border'
  } {
    compact ? 'text-sm' : 'text-base'
  }">

    <!-- Status Indicator -->
    {#if showStatus}
      <div class="flex items-center space-x-2">
        <!-- Status Icon -->
        <div class="flex-shrink-0">
          {#if saveStatusInfo.icon === 'saving'}
            <svg class="w-4 h-4 animate-spin {saveStatusInfo.className}" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else if saveStatusInfo.icon === 'success'}
            <svg class="w-4 h-4 {saveStatusInfo.className}" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          {:else if saveStatusInfo.icon === 'unsaved'}
            <svg class="w-4 h-4 {saveStatusInfo.className}" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          {:else if saveStatusInfo.icon === 'saved'}
            <svg class="w-4 h-4 {saveStatusInfo.className}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </div>

        <!-- Status Text -->
        {#if saveStatusInfo.message && !compact}
          <span class="{saveStatusInfo.className} {compact ? 'text-xs' : 'text-sm'}">
            {saveStatusInfo.message}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Manual Save Button -->
    {#if showButton}
      <button
        type="button"
        onclick={handleSave}
        disabled={saving || isAutoSaving || !hasUnsavedChanges}
        class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 {
          compact ? 'px-2 py-1 text-xs' : ''
        }"
        title="{hasUnsavedChanges ? 'Save changes (Ctrl+S)' : 'No changes to save'}"
      >
        {#if saving}
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Saving...
        {:else}
          <svg class="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        {/if}
      </button>
    {/if}
  </div>

  <!-- Auto-save Indicator (minimal) -->
  {#if !showStatus && (isAutoSaving || showSuccessAnimation)}
    <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full {
      isAutoSaving ? 'bg-blue-500 animate-pulse' : 'bg-green-500 animate-ping'
    }"></div>
  {/if}

  <!-- Connection Status Warning -->
  {#if lastSaveStatus === 'error'}
    <div class="absolute top-full mt-2 right-0 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg min-w-64">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">
            Save Failed
          </h3>
          <div class="mt-1 text-sm text-red-700">
            <p>Unable to save your changes. Please check your connection and try again.</p>
          </div>
          <div class="mt-3">
            <button
              type="button"
              onclick={() => { lastSaveStatus = null; handleSave(); }}
              class="text-sm bg-red-100 text-red-800 rounded-md px-2 py-1 hover:bg-red-200"
            >
              Retry Save
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Success Toast Animation -->
{#if showSuccessAnimation && position !== 'inline'}
  <div
    class="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-500 {showSuccessAnimation ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}"
  >
    <div class="flex items-center space-x-2">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      <span class="font-medium">Changes saved!</span>
    </div>
  </div>
{/if}

<!-- Auto-save Settings Info (only show if position is inline) -->
{#if position === 'inline' && autoSave}
  <div class="mt-2 text-xs text-gray-500">
    Changes are automatically saved as you type
  </div>
{/if}
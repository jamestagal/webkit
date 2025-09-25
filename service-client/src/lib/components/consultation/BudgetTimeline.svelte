<script lang="ts">
  // This component is essentially covered by the GoalsObjectives component
  // which includes both budget and timeline sections. This could be used
  // as a standalone component if needed, or as a wrapper around specific
  // sections of GoalsObjectives.

  import GoalsObjectives from './GoalsObjectives.svelte';

  // Props that match the interface expected by the parent
  let {
    data = $bindable({}),
    errors = [],
    disabled = false
  }: {
    data: any;
    errors?: string[];
    disabled?: boolean;
  } = $props();
</script>

<!--
  BudgetTimeline component - This is a specialized view of the GoalsObjectives
  component that focuses specifically on budget and timeline sections.
  In practice, these are integrated into the full GoalsObjectives form.
-->

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-gray-900">Budget & Timeline</h2>
    <p class="mt-1 text-sm text-gray-600">
      This information is captured as part of the Goals & Objectives section.
    </p>
  </div>

  <!-- Render the full GoalsObjectives component -->
  <GoalsObjectives bind:data {errors} {disabled} />
</div>
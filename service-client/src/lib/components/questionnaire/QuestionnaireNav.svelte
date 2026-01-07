<script lang="ts">
	import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-svelte';

	interface Props {
		currentSection: number;
		totalSections: number;
		saving: boolean;
		submitting: boolean;
		hasUnsavedChanges: boolean;
		onPrevious: () => void;
		onNext: () => void;
		onSubmit: () => void;
		disabled?: boolean;
	}

	let {
		currentSection,
		totalSections,
		saving,
		submitting,
		hasUnsavedChanges,
		onPrevious,
		onNext,
		onSubmit,
		disabled = false
	}: Props = $props();

	let isFirstSection = $derived(currentSection === 0);
	let isLastSection = $derived(currentSection === totalSections - 1);
</script>

<div class="mt-8 pt-6 border-t border-base-300">
	<div class="flex items-center justify-between">
		<!-- Previous Button -->
		<div>
			{#if !isFirstSection}
				<button
					type="button"
					class="btn btn-ghost gap-2"
					onclick={onPrevious}
					disabled={disabled || saving || submitting}
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</button>
			{:else}
				<div></div>
			{/if}
		</div>

		<!-- Save Status -->
		<div class="hidden sm:flex items-center gap-2 text-sm">
			{#if saving}
				<Loader2 class="h-4 w-4 animate-spin text-base-content/50" />
				<span class="text-base-content/50">Saving...</span>
			{:else if hasUnsavedChanges}
				<span class="text-warning">Unsaved changes</span>
			{:else}
				<span class="text-base-content/50">All changes saved</span>
			{/if}
		</div>

		<!-- Next/Submit Button -->
		<div>
			{#if isLastSection}
				<button
					type="button"
					class="btn btn-primary gap-2"
					onclick={onSubmit}
					disabled={disabled || saving || submitting}
				>
					{#if submitting}
						<Loader2 class="h-4 w-4 animate-spin" />
						Submitting...
					{:else}
						<Check class="h-4 w-4" />
						Submit Questionnaire
					{/if}
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-primary gap-2"
					onclick={onNext}
					disabled={disabled || saving || submitting}
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	<!-- Mobile Save Status -->
	<div class="sm:hidden mt-4 text-center text-sm">
		{#if saving}
			<span class="text-base-content/50">Saving...</span>
		{:else if hasUnsavedChanges}
			<span class="text-warning">Unsaved changes</span>
		{:else}
			<span class="text-base-content/50">All changes saved</span>
		{/if}
	</div>
</div>

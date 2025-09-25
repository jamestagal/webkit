<script lang="ts">
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import Textarea from "$lib/components/Textarea.svelte";

	// Props
	let {
		data = $bindable({ notes: "" }),
		errors = [],
		disabled = false,
	}: {
		data: { notes?: string };
		errors?: string[];
		disabled?: boolean;
	} = $props();

	// Local form state with runes
	let notes = $state(data.notes || "");

	// Character limits and validation
	const MAX_CHARACTERS = 2000;
	let charactersRemaining = $derived(() => MAX_CHARACTERS - notes.length);
	let isOverLimit = $derived(() => charactersRemaining < 0);

	// Update parent data when local state changes
	$effect(() => {
		if (!isOverLimit) {
			data.notes = notes.trim() || undefined;

			// Store notes in consultation store (this would be a separate section)
			// For now, we'll add it as additional context
			const currentData = consultationStore.formState.data.goals_objectives || {};
			consultationStore.updateSectionData("goals_objectives", {
				...currentData,
				notes: notes.trim() || undefined,
			});
		}
	});

	// Derived validation
	let isFormValid = $derived(() => !isOverLimit);

	// Auto-resize textarea
	function autoResize(textarea: HTMLTextAreaElement): void {
		textarea.style.height = "auto";
		textarea.style.height = textarea.scrollHeight + "px";
	}

	// Handle input with auto-resize
	function handleInput(event: Event): void {
		const target = event.target as HTMLTextAreaElement;
		notes = target.value;
		autoResize(target);
	}

	// Template suggestions for common consultation notes
	const suggestionTemplates = [
		{
			title: "Additional Requirements",
			content: "Additional requirements or considerations:\n- \n- \n- ",
		},
		{
			title: "Special Circumstances",
			content: "Special circumstances or constraints:\n- \n- ",
		},
		{
			title: "Preferred Communication",
			content:
				"Communication preferences:\n- Best time to reach: \n- Preferred method: \n- Frequency of updates: ",
		},
		{
			title: "Success Factors",
			content: "Critical success factors:\n- \n- \n- ",
		},
		{
			title: "Questions for Provider",
			content: "Questions for the service provider:\n- \n- \n- ",
		},
	];

	// Insert template
	function insertTemplate(template: { title: string; content: string }): void {
		if (notes) {
			notes += "\n\n" + template.content;
		} else {
			notes = template.content;
		}
	}

	// Clear notes with confirmation
	function clearNotes(): void {
		if (notes && confirm("Are you sure you want to clear all notes?")) {
			notes = "";
		}
	}

	// Word count
	let wordCount = $derived(() => {
		if (!notes.trim()) return 0;
		return notes.trim().split(/\s+/).length;
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-2xl font-bold text-gray-900">Additional Notes</h2>
		<p class="mt-1 text-sm text-gray-600">
			Add any additional information, requirements, or questions that weren't covered in the
			previous sections.
		</p>
	</div>

	<!-- Error Summary -->
	{#if errors.length > 0}
		<div class="rounded-md bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Please correct the following errors:</h3>
					<div class="mt-2 text-sm text-red-700">
						<ul class="list-inside list-disc">
							{#each errors as error}
								<li>{error}</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Template Suggestions -->
	{#if !notes.trim()}
		<div>
			<label class="mb-3 block text-sm font-medium text-gray-700">
				Quick Start Templates
				<span class="font-normal text-gray-500">(Optional)</span>
			</label>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each suggestionTemplates as template}
					<button
						type="button"
						onclick={() => insertTemplate(template)}
						{disabled}
						class="rounded-lg border border-gray-300 p-3 text-left transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<div class="text-sm font-medium text-gray-900">
							{template.title}
						</div>
						<div class="mt-1 text-xs text-gray-500">Click to add template</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Main Notes Textarea -->
	<div>
		<label class="mb-2 block text-sm font-medium text-gray-700">
			Notes & Additional Information
			<span class="font-normal text-gray-500">(Optional)</span>
		</label>

		<div class="relative">
			<Textarea
				bind:value={notes}
				oninput={handleInput}
				placeholder="Share any additional details, special requirements, questions, or context that would help us better understand your needs..."
				rows={6}
				{disabled}
				error={isOverLimit
					? `Exceeded character limit by ${Math.abs(charactersRemaining)} characters`
					: ""}
				class="resize-none"
				maxlength={MAX_CHARACTERS}
			/>

			<!-- Character counter -->
			<div
				class="absolute right-2 bottom-2 text-xs {isOverLimit
					? 'text-red-500'
					: charactersRemaining < 100
						? 'text-yellow-500'
						: 'text-gray-400'}"
			>
				{charactersRemaining} characters remaining
			</div>
		</div>

		<!-- Statistics -->
		<div class="mt-2 flex items-center justify-between text-sm text-gray-500">
			<span>
				{wordCount} words
			</span>

			{#if notes.trim()}
				<button
					type="button"
					onclick={clearNotes}
					{disabled}
					class="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Clear all
				</button>
			{/if}
		</div>
	</div>

	<!-- Content Guidelines -->
	<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
		<h4 class="mb-2 text-sm font-medium text-blue-900">Helpful information to include:</h4>
		<ul class="space-y-1 text-sm text-blue-800">
			<li>" Specific features or functionality you need</li>
			<li>" Integration requirements with existing systems</li>
			<li>" Compliance or regulatory considerations</li>
			<li>" Design preferences or brand guidelines</li>
			<li>" Team size and technical expertise levels</li>
			<li>" Any concerns or past experiences with similar projects</li>
		</ul>
	</div>

	<!-- Pre-submission Checklist -->
	{#if notes.trim()}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h4 class="mb-3 text-sm font-medium text-gray-900">Before you submit, consider:</h4>
			<div class="space-y-2">
				<label class="flex items-start">
					<input type="checkbox" class="mt-1 mr-2" />
					<span class="text-sm text-gray-700">
						Have you included all relevant technical requirements?
					</span>
				</label>
				<label class="flex items-start">
					<input type="checkbox" class="mt-1 mr-2" />
					<span class="text-sm text-gray-700">
						Are there any deadlines or milestones not mentioned earlier?
					</span>
				</label>
				<label class="flex items-start">
					<input type="checkbox" class="mt-1 mr-2" />
					<span class="text-sm text-gray-700">
						Have you clarified your budget expectations and constraints?
					</span>
				</label>
				<label class="flex items-start">
					<input type="checkbox" class="mt-1 mr-2" />
					<span class="text-sm text-gray-700">
						Did you mention any preferences for ongoing support?
					</span>
				</label>
			</div>
		</div>
	{/if}

	<!-- Form Status Indicator -->
	<div class="flex items-center space-x-2 text-sm">
		{#if isFormValid}
			<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					clip-rule="evenodd"
				/>
			</svg>
			<span class="text-green-700">
				{notes.trim() ? "Additional notes recorded" : "Optional section - ready to proceed"}
			</span>
		{:else}
			<svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
					clip-rule="evenodd"
				/>
			</svg>
			<span class="text-red-700">Please reduce notes to under {MAX_CHARACTERS} characters</span>
		{/if}

		{#if consultationStore.formState.isAutoSaving}
			<div class="flex items-center space-x-1 text-blue-600">
				<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
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

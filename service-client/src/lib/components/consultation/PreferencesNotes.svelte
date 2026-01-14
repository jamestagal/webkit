<script lang="ts">
	import type { PreferencesNotes } from '$lib/types/consultation';
	import { DESIGN_STYLE_OPTIONS } from '$lib/config/consultation-options';
	import ChipSelector from '$lib/components/shared/ChipSelector.svelte';

	interface Props {
		data: PreferencesNotes;
		errors?: Record<string, string>;
		disabled?: boolean;
	}

	let { data = $bindable(), errors = {}, disabled = false }: Props = $props();

	// Ensure design_styles is initialized as an array
	$effect(() => {
		if (!data.design_styles) {
			data.design_styles = [];
		}
	});
</script>

<div class="space-y-6">
	<!-- Design Style -->
	<div class="space-y-2">
		<label class="text-sm font-medium">Preferred Design Style</label>
		<p class="text-xs text-gray-500">Select any styles that appeal to you</p>
		{#if data.design_styles}
			<ChipSelector
				options={DESIGN_STYLE_OPTIONS}
				bind:selected={data.design_styles}
				allowCustom={false}
				{disabled}
			/>
		{/if}
	</div>

	<!-- Admired Websites -->
	<div class="form-control">
		<label class="label" for="admired_websites">
			<span class="label-text">Websites You Admire</span>
		</label>
		<p class="mb-2 text-xs text-gray-500">Paste 2-3 website URLs that you like the look/feel of</p>
		<textarea
			id="admired_websites"
			bind:value={data.admired_websites}
			rows="3"
			class="textarea textarea-bordered w-full"
			placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
			{disabled}
		></textarea>
	</div>

	<!-- Consultation Notes -->
	<div class="form-control">
		<label class="label" for="consultation_notes">
			<span class="label-text font-medium">Consultation Notes</span>
		</label>
		<p class="mb-2 text-xs text-gray-500">
			Capture key points from the conversation - context that helps personalize the proposal
		</p>
		<textarea
			id="consultation_notes"
			bind:value={data.consultation_notes}
			rows="6"
			class="textarea textarea-bordered w-full"
			placeholder="e.g., Client was burned by previous agency - wants clear timeline and communication...

Mentioned competitor acme.com.au - dislikes their cluttered design...

Decision maker is the business partner, not the person on the call...

Very price-sensitive, asked about payment plans..."
			{disabled}
		></textarea>
	</div>
</div>

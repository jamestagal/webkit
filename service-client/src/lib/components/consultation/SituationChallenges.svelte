<script lang="ts">
	import type { Situation } from '$lib/types/consultation';
	import {
		WEBSITE_STATUS_OPTIONS,
		PRIMARY_CHALLENGES_OPTIONS,
		URGENCY_LEVEL_OPTIONS,
		URGENCY_COLORS
	} from '$lib/config/consultation-options';
	import ChipSelector from '$lib/components/shared/ChipSelector.svelte';

	interface Props {
		data: Situation;
		errors?: Record<string, string>;
		disabled?: boolean;
	}

	let { data = $bindable(), errors = {}, disabled = false }: Props = $props();
</script>

<div class="space-y-6">
	<!-- Website Status -->
	<fieldset class="space-y-2">
		<legend class="text-sm font-medium">Current Website Status *</legend>
		<div class="flex flex-wrap gap-2">
			{#each WEBSITE_STATUS_OPTIONS as option}
				<label
					class="btn btn-outline"
					class:btn-active={data.website_status === option.value}
					class:btn-disabled={disabled}
				>
					<input
						type="radio"
						name="website_status"
						value={option.value}
						bind:group={data.website_status}
						class="hidden"
						{disabled}
					/>
					{option.label}
				</label>
			{/each}
		</div>
		{#if errors.website_status}
			<p class="text-sm text-error">{errors.website_status}</p>
		{/if}
	</fieldset>

	<!-- Primary Challenges -->
	<div class="space-y-2">
		<label class="text-sm font-medium">Primary Challenges *</label>
		<p class="text-xs text-gray-500">Select all that apply</p>
		<ChipSelector
			options={PRIMARY_CHALLENGES_OPTIONS}
			bind:selected={data.primary_challenges}
			allowCustom={true}
			{disabled}
		/>
		{#if errors.primary_challenges}
			<p class="text-sm text-error">{errors.primary_challenges}</p>
		{/if}
	</div>

	<!-- Urgency Level -->
	<div class="form-control">
		<label class="label" for="urgency_level">
			<span class="label-text">Urgency Level *</span>
		</label>
		<select
			id="urgency_level"
			bind:value={data.urgency_level}
			class="select select-bordered"
			class:select-error={errors.urgency_level}
			{disabled}
		>
			<option value="">Select urgency...</option>
			{#each URGENCY_LEVEL_OPTIONS as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		{#if data.urgency_level}
			<div class="mt-2">
				<span class="badge {URGENCY_COLORS[data.urgency_level]}">
					{URGENCY_LEVEL_OPTIONS.find((o) => o.value === data.urgency_level)?.label}
				</span>
			</div>
		{/if}
		{#if errors.urgency_level}
			<label class="label"><span class="label-text-alt text-error">{errors.urgency_level}</span></label
			>
		{/if}
	</div>
</div>

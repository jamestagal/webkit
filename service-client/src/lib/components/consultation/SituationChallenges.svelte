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
	<!-- General form errors alert -->
	{#if Object.keys(errors).length > 0}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<div>
				<p class="font-medium">Please fix the following errors:</p>
				<ul class="mt-1 list-disc list-inside text-sm">
					{#each Object.entries(errors) as [field, message]}
						<li>{message}</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

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
		<p class="text-xs text-gray-500">Select at least one challenge that applies (or add your own)</p>
		<ChipSelector
			options={PRIMARY_CHALLENGES_OPTIONS}
			bind:selected={data.primary_challenges}
			allowCustom={true}
			{disabled}
		/>
		{#if errors.primary_challenges}
			<p class="mt-1 text-sm text-error font-medium">{errors.primary_challenges}</p>
		{:else if data.primary_challenges.length === 0}
			<p class="mt-1 text-sm text-warning">⚠ Select at least one challenge to continue</p>
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

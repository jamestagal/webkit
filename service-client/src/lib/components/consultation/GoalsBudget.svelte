<script lang="ts">
	import type { GoalsBudget } from '$lib/types/consultation';
	import {
		PRIMARY_GOALS_OPTIONS,
		CONVERSION_GOAL_OPTIONS,
		BUDGET_RANGE_OPTIONS,
		TIMELINE_OPTIONS
	} from '$lib/config/consultation-options';
	import ChipSelector from '$lib/components/shared/ChipSelector.svelte';

	interface Props {
		data: GoalsBudget;
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

	<!-- Primary Goals -->
	<div class="space-y-2">
		<label class="text-sm font-medium">Primary Goals *</label>
		<p class="text-xs text-gray-500">Select at least one goal that applies (or add your own)</p>
		<ChipSelector
			options={PRIMARY_GOALS_OPTIONS}
			bind:selected={data.primary_goals}
			allowCustom={true}
			{disabled}
		/>
		{#if errors.primary_goals}
			<p class="mt-1 text-sm text-error font-medium">{errors.primary_goals}</p>
		{:else if data.primary_goals.length === 0}
			<p class="mt-1 text-sm text-warning">⚠ Select at least one goal to continue</p>
		{/if}
	</div>

	<!-- Conversion Goal -->
	<fieldset class="space-y-2">
		<legend class="text-sm font-medium">Primary Conversion Goal</legend>
		<p class="text-xs text-gray-500">What's the main action you want visitors to take?</p>
		<div class="flex flex-wrap gap-2">
			{#each CONVERSION_GOAL_OPTIONS as option}
				<label
					class="btn btn-sm btn-outline"
					class:btn-active={data.conversion_goal === option.value}
					class:btn-disabled={disabled}
				>
					<input
						type="radio"
						name="conversion_goal"
						value={option.value}
						bind:group={data.conversion_goal}
						class="hidden"
						{disabled}
					/>
					{option.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<!-- Budget & Timeline -->
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="form-control">
			<label class="label" for="budget_range">
				<span class="label-text">Budget Range *</span>
			</label>
			<select
				id="budget_range"
				bind:value={data.budget_range}
				class="select select-bordered"
				class:select-error={errors.budget_range}
				{disabled}
			>
				<option value="">Select budget...</option>
				{#each BUDGET_RANGE_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			{#if errors.budget_range}
				<label class="label"
					><span class="label-text-alt text-error">{errors.budget_range}</span></label
				>
			{/if}
		</div>

		<div class="form-control">
			<label class="label" for="timeline">
				<span class="label-text">Timeline</span>
			</label>
			<select
				id="timeline"
				bind:value={data.timeline}
				class="select select-bordered"
				class:select-error={errors.timeline}
				{disabled}
			>
				<option value="">Select timeline...</option>
				{#each TIMELINE_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			{#if errors.timeline}
				<label class="label"
					><span class="label-text-alt text-error">{errors.timeline}</span></label
				>
			{/if}
		</div>
	</div>
</div>

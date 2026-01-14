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
	<!-- Primary Goals -->
	<div class="space-y-2">
		<label class="text-sm font-medium">Primary Goals *</label>
		<p class="text-xs text-gray-500">Select all that apply</p>
		<ChipSelector
			options={PRIMARY_GOALS_OPTIONS}
			bind:selected={data.primary_goals}
			allowCustom={true}
			{disabled}
		/>
		{#if errors.primary_goals}
			<p class="text-sm text-error">{errors.primary_goals}</p>
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
			<select id="timeline" bind:value={data.timeline} class="select select-bordered" {disabled}>
				<option value="">Select timeline...</option>
				{#each TIMELINE_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
	</div>
</div>

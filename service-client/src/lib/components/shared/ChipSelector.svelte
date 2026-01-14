<script lang="ts">
	import type { SelectOption } from '$lib/config/consultation-options';

	interface Props {
		options: SelectOption[];
		selected: string[];
		allowCustom?: boolean;
		disabled?: boolean;
		placeholder?: string;
	}

	let {
		options,
		selected = $bindable([]),
		allowCustom = false,
		disabled = false,
		placeholder = 'Add custom...'
	}: Props = $props();

	let customValue = $state('');

	function toggleOption(value: string) {
		if (disabled) return;

		if (selected.includes(value)) {
			selected = selected.filter((v) => v !== value);
		} else {
			selected = [...selected, value];
		}
	}

	function addCustom() {
		if (!customValue.trim() || disabled) return;

		const value = customValue.trim().toLowerCase().replace(/\s+/g, '-');
		if (!selected.includes(value)) {
			selected = [...selected, value];
		}
		customValue = '';
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addCustom();
		}
	}

	function removeCustom(value: string) {
		if (disabled) return;
		selected = selected.filter((v) => v !== value);
	}

	// Get custom values (values not in options)
	let customValues = $derived(
		selected.filter((v) => !options.some((o) => o.value === v))
	);
</script>

<div class="space-y-3">
	<!-- Preset options -->
	<div class="flex flex-wrap gap-2">
		{#each options as option}
			<button
				type="button"
				class="btn btn-sm"
				class:btn-outline={!selected.includes(option.value)}
				class:btn-primary={selected.includes(option.value)}
				class:btn-disabled={disabled}
				onclick={() => toggleOption(option.value)}
				{disabled}
			>
				{option.label}
			</button>
		{/each}
	</div>

	<!-- Custom values display -->
	{#if customValues.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each customValues as value}
				<span class="badge badge-secondary gap-1">
					{value}
					<button
						type="button"
						class="btn btn-ghost btn-xs p-0"
						onclick={() => removeCustom(value)}
						{disabled}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-3 w-3"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</span>
			{/each}
		</div>
	{/if}

	<!-- Custom input -->
	{#if allowCustom}
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={customValue}
				onkeydown={handleKeyDown}
				{placeholder}
				class="input input-bordered input-sm flex-1"
				{disabled}
			/>
			<button
				type="button"
				class="btn btn-sm btn-outline"
				onclick={addCustom}
				disabled={disabled || !customValue.trim()}
			>
				Add
			</button>
		</div>
	{/if}
</div>

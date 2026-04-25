<script lang="ts">
	import { Pencil, X, Plus } from 'lucide-svelte';

	type Props = {
		label: string;
		value: string;
		onChange: (next: string) => void;
		disabled?: boolean;
	};

	let { label, value, onChange, disabled = false }: Props = $props();

	let inputEl: HTMLInputElement | undefined = $state();

	function openPicker() {
		if (disabled) return;
		inputEl?.click();
	}

	function handleInput(event: Event) {
		onChange((event.currentTarget as HTMLInputElement).value);
	}

	function clear() {
		onChange('');
	}

	const displayHex = $derived((value || '').toUpperCase() || '—');
	const hasValue = $derived(!!value);
</script>

<div
	class="group relative flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2 py-1.5 transition-colors hover:border-primary/40"
	class:opacity-50={disabled}
>
	<button
		type="button"
		onclick={openPicker}
		{disabled}
		class="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
	>
		<span
			class="block h-6 w-6 shrink-0 rounded-md ring-1 ring-base-300"
			style:background-color={value || 'transparent'}
		></span>
		<span class="truncate text-[11px] font-bold uppercase tracking-wider text-base-content/60">
			{label}
		</span>
		<span class="ml-auto font-mono text-xs text-base-content/80">{displayHex}</span>
	</button>
	{#if !disabled}
		<div class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
			{#if hasValue}
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-square"
					onclick={clear}
					title="Clear override"
					aria-label="Clear {label} override"
				>
					<X class="h-3 w-3" />
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-square"
					onclick={openPicker}
					title="Edit"
					aria-label="Edit {label}"
				>
					<Pencil class="h-3 w-3" />
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-square"
					onclick={openPicker}
					title="Set override"
					aria-label="Set {label}"
				>
					<Plus class="h-3 w-3" />
				</button>
			{/if}
		</div>
	{/if}
	<input
		bind:this={inputEl}
		type="color"
		value={value || '#000000'}
		oninput={handleInput}
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
	/>
</div>

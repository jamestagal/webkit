<script lang="ts">
	import { Pencil } from 'lucide-svelte';

	type Props = {
		label: string;
		value: string;
		onChange: (next: string) => void;
		description?: string;
		disabled?: boolean;
	};

	let { label, value, onChange, description, disabled = false }: Props = $props();

	let inputEl: HTMLInputElement | undefined = $state();

	function openPicker() {
		if (disabled) return;
		inputEl?.click();
	}

	function handleInput(event: Event) {
		onChange((event.currentTarget as HTMLInputElement).value);
	}

	const displayHex = $derived((value || '').toUpperCase() || '—');
</script>

<div class="relative">
	<button
		type="button"
		onclick={openPicker}
		{disabled}
		class="group flex w-full items-center justify-between gap-4 rounded-xl border border-base-300 bg-base-100 p-4 text-left transition-all duration-300 hover:border-primary/40 hover:bg-base-200 hover:shadow-[0_0_20px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed disabled:opacity-40"
	>
		<span class="flex items-center gap-4">
			<span
				class="block h-10 w-10 shrink-0 rounded-lg shadow-inner ring-1 ring-base-300"
				style:background-color={value || 'transparent'}
			></span>
			<span class="flex flex-col items-start">
				<span class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
					{label}
				</span>
				<span
					class="font-mono text-xs font-medium text-base-content/80 transition-colors group-hover:text-base-content"
				>
					{displayHex}
				</span>
				{#if description}
					<span class="mt-1 text-[11px] text-base-content/50">{description}</span>
				{/if}
			</span>
		</span>
		<Pencil
			class="h-4 w-4 shrink-0 -translate-x-2 text-base-content/40 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
		/>
	</button>
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

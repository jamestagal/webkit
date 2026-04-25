<script lang="ts">
	import { X } from 'lucide-svelte';

	type Props = {
		label: string;
		value: string;
		onChange: (next: string) => void;
		placeholder?: string;
		disabled?: boolean;
	};

	let {
		label,
		value,
		onChange,
		placeholder = 'linear-gradient(135deg, #4F46E5 0%, #F59E0B 100%)',
		disabled = false
	}: Props = $props();

	function handleInput(event: Event) {
		onChange((event.currentTarget as HTMLInputElement).value);
	}

	function clear() {
		onChange('');
	}

	const hasValue = $derived(!!value);
</script>

<div
	class="group relative flex items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2 py-1.5 transition-colors focus-within:border-primary/40 hover:border-primary/40"
	class:opacity-50={disabled}
>
	<span
		class="block h-6 w-6 shrink-0 rounded-md ring-1 ring-base-300"
		style:background={value ||
			'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.06) 4px 8px)'}
		aria-hidden="true"
	></span>
	<label
		for="gradient-{label}"
		class="shrink-0 truncate text-[11px] font-bold uppercase tracking-wider text-base-content/60"
	>
		{label}
	</label>
	<input
		id="gradient-{label}"
		type="text"
		{value}
		{placeholder}
		oninput={handleInput}
		{disabled}
		class="input input-ghost input-xs ml-auto h-7 min-w-0 flex-1 px-1 font-mono text-xs focus:outline-none disabled:cursor-not-allowed"
	/>
	{#if hasValue && !disabled}
		<button
			type="button"
			class="btn btn-ghost btn-xs btn-square shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
			onclick={clear}
			title="Clear override"
			aria-label="Clear {label} override"
		>
			<X class="h-3 w-3" />
		</button>
	{/if}
</div>

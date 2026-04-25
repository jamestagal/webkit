<script lang="ts">
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
</script>

<div
	class="flex w-full items-center gap-4 rounded-xl border border-base-300 bg-base-100 p-4 transition-colors focus-within:border-primary/40"
	class:opacity-40={disabled}
>
	<span
		class="block h-10 w-10 shrink-0 rounded-lg shadow-inner ring-1 ring-base-300"
		style:background={value || 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.06) 4px 8px)'}
		aria-hidden="true"
	></span>
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<label
			class="text-[11px] font-bold uppercase tracking-wider text-base-content/60"
			for="gradient-{label}"
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
			class="input input-ghost input-xs w-full px-0 font-mono text-xs focus:outline-none disabled:cursor-not-allowed"
		/>
		<span class="text-[11px] text-base-content/50">
			CSS gradient syntax. Empty = use solid accent color.
		</span>
	</div>
</div>

<script lang="ts">
	type Props = {
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
		accentGradient: string;
	};

	let { primaryColor, secondaryColor, accentColor, accentGradient }: Props = $props();

	const accentBackground = $derived(accentGradient || accentColor);
</script>

<section class="space-y-3 rounded-xl border border-base-300 bg-base-100 p-3">
	<h3 class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Preview</h3>

	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<span
				class="block h-6 w-6 rounded-md ring-1 ring-base-300"
				style:background-color={primaryColor}
				aria-hidden="true"
			></span>
			<span class="text-xs">Primary</span>
		</div>
		<div class="flex items-center gap-2">
			<span
				class="block h-6 w-6 rounded-md ring-1 ring-base-300"
				style:background-color={secondaryColor}
				aria-hidden="true"
			></span>
			<span class="text-xs">Secondary</span>
		</div>
		<div class="flex items-center gap-2">
			<span
				class="block h-6 w-6 rounded-md ring-1 ring-base-300"
				style:background-color={accentColor}
				aria-hidden="true"
			></span>
			<span class="text-xs">Accent</span>
		</div>
		{#if accentGradient}
			<div class="flex items-center gap-2">
				<span
					class="block h-6 w-6 rounded-md ring-1 ring-base-300"
					style:background={accentGradient}
					aria-hidden="true"
				></span>
				<span class="text-xs">Gradient</span>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<span
			class="rounded-md px-3 py-1 text-xs font-medium text-white shadow-sm"
			style:background-color={primaryColor}
		>
			Primary Button
		</span>
		<span
			class="rounded-md px-3 py-1 text-xs font-medium text-white shadow-sm"
			style:background={accentBackground}
		>
			Accent Button
		</span>
	</div>
</section>

<script lang="ts">
	import { Palette, Globe, Search, MapPin, CheckCircle2 } from 'lucide-svelte';

	let {
		brandActive = false,
		pagesActive = false,
		keywordsActive = false,
		gbpActive = false
	}: {
		brandActive?: boolean;
		pagesActive?: boolean;
		keywordsActive?: boolean;
		gbpActive?: boolean;
	} = $props();

	let items = $derived([
		{ label: 'Brand Voice', icon: Palette, color: '#d946ef', active: brandActive },
		{ label: 'Crawled Pages', icon: Globe, color: '#06b6d4', active: pagesActive },
		{ label: 'Keyword Data', icon: Search, color: '#a855f7', active: keywordsActive },
		{ label: 'GBP Profile', icon: MapPin, color: '#22c55e', active: gbpActive }
	]);
</script>

<div class="mt-6 bg-base-100 rounded-2xl border border-base-200 p-4 shadow-sm">
	<div class="flex items-center justify-between flex-wrap gap-4">
		<div class="flex items-center gap-8 flex-wrap">
			<div class="text-xs font-medium text-base-content/40 uppercase tracking-wider">
				Shared Context
			</div>
			{#each items as item}
				{@const Icon = item.icon}
				<div class="flex items-center gap-1.5 text-xs text-base-content/70">
					<Icon size={12} style="color: {item.color}" />
					<span>{item.label}</span>
					{#if item.active}
						<CheckCircle2 size={10} class="text-success/70" />
					{/if}
				</div>
			{/each}
		</div>
		<div class="text-xs text-base-content/40">
			Analysis data is shared across all content modules
		</div>
	</div>
</div>

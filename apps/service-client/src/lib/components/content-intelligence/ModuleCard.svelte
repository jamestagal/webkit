<script lang="ts">
	import {
		BarChart3,
		Palette,
		MapPin,
		Globe,
		FileEdit,
		Layers,
		MessageSquare,
		ChevronRight
	} from 'lucide-svelte';
	import type { Module } from '$lib/types/content-intelligence';
	import { alpha } from '$lib/types/content-intelligence';
	import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
	import ScoreBadge from '$lib/components/ui/ScoreBadge.svelte';

	interface Props {
		module: Module;
		expanded: boolean;
		ontoggle: (id: string) => void;
	}

	let { module, expanded, ontoggle }: Props = $props();

	const iconMap: Record<string, typeof BarChart3> = {
		BarChart3,
		Palette,
		MapPin,
		Globe,
		FileEdit,
		Layers,
		MessageSquare
	};

	let Icon = $derived(iconMap[module.icon]);
</script>

<div
	class="w-full text-left rounded-xl border transition-all duration-200 {expanded
		? 'border-base-300 shadow-md bg-base-100'
		: 'border-base-200 shadow-sm bg-base-100 hover:shadow-md hover:border-base-300'}"
>
	<button
		type="button"
		class="w-full text-left p-3.5 cursor-pointer"
		onclick={() => ontoggle(module.id)}
	>
		<div class="flex items-center gap-3">
			<div
				class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
				style="background-color: {alpha(module.color, 7)}"
			>
				{#if Icon}
					<Icon size={18} style="color: {module.color}" />
				{/if}
			</div>
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<span class="font-semibold text-sm text-base-content">{module.label}</span>
					{#if module.isNew}
						<span
							class="text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full"
						>
							New
						</span>
					{/if}
				</div>
				<div class="text-xs text-base-content/50 mt-0.5">{module.summary}</div>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				{#if module.score}
					<ScoreBadge score={module.score} />
				{/if}
				<StatusBadge status={module.status} />
			</div>
		</div>
	</button>

	{#if expanded && (module.items.length > 0 || module.href)}
		<div class="px-3.5 pb-3.5">
			<div class="pt-3 border-t border-base-200/60">
				{#if module.items.length > 0}
					<div class="grid grid-cols-2 gap-1.5">
						{#each module.items as item}
							<div class="flex items-center gap-2 text-xs text-base-content/70">
								<div
									class="w-1 h-1 rounded-full shrink-0"
									style="background-color: {module.color}"
								></div>
								{item}
							</div>
						{/each}
					</div>
				{/if}
				{#if module.href}
					<div class="mt-3 flex justify-end">
						<a
							href={module.href}
							class="text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors"
							style="color: {module.color}; background-color: {alpha(module.color, 6)}"
						>
							Open {module.label} <ChevronRight size={12} />
						</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

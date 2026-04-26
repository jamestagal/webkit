<script lang="ts">
	import type { Snippet, Component } from 'svelte';
	import { alpha } from '$lib/types/content-intelligence';

	interface Props {
		icon: Component<any>;
		title: string;
		subtitle: string;
		color: string;
		actionLabel?: string;
		actionIcon?: Component<any>;
		onaction?: () => void;
		badge?: Snippet;
		disabled?: boolean;
	}

	let {
		icon: Icon,
		title,
		subtitle,
		color,
		actionLabel,
		actionIcon: ActionIcon,
		onaction,
		badge,
		disabled = false
	}: Props = $props();
</script>

<div class="flex items-start justify-between mb-4">
	<div class="flex items-start gap-3">
		<div
			class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
			style="background-color: {alpha(color, 7)}"
		>
			<Icon size={20} style="color: {color}" />
		</div>
		<div>
			<div class="flex items-center gap-2">
				<h3 class="font-bold text-base-content">{title}</h3>
				{#if badge}
					{@render badge()}
				{/if}
			</div>
			<p class="text-sm text-base-content/60 mt-0.5">{subtitle}</p>
		</div>
	</div>
	{#if actionLabel}
		<button
			class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors shrink-0"
			class:opacity-50={disabled}
			class:cursor-not-allowed={disabled}
			style="color: {color}; border-color: {alpha(color, 25)}; background-color: {alpha(color, 3)};"
			onclick={disabled ? undefined : onaction}
			aria-disabled={disabled}
			title={disabled ? 'Coming soon' : undefined}
		>
			{#if ActionIcon}
				<ActionIcon size={14} />
			{/if}
			{actionLabel}
		</button>
	{/if}
</div>

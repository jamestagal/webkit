<script lang="ts">
	interface Props {
		score: number | null;
		size?: 'sm' | 'md' | 'lg';
		label?: string;
	}

	let { score, size = 'md', label }: Props = $props();

	const sizeMap = { sm: '4rem', md: '6rem', lg: '8rem' };
	const textSizeMap = { sm: 'text-sm', md: 'text-xl', lg: 'text-3xl' };

	let radiusSize = $derived(sizeMap[size]);

	function thresholdColor(s: number | null): string {
		if (s == null) return 'hsl(var(--bc) / 0.2)';
		if (s >= 80) return 'hsl(var(--su))';
		if (s >= 60) return 'hsl(var(--wa))';
		return 'hsl(var(--er))';
	}

	let color = $derived(thresholdColor(score));
	let displayScore = $derived(score != null ? score : '—');
	let percentage = $derived(score != null ? score : 0);
</script>

<div
	class="radial-progress font-bold {textSizeMap[size]}"
	style="--value:{percentage}; --size:{radiusSize}; --thickness:0.5rem; color: var(--agency-primary, {color});"
	role="progressbar"
	aria-valuenow={score ?? 0}
	aria-valuemin={0}
	aria-valuemax={100}
>
	{displayScore}
</div>
{#if label}
	<p class="mt-1 text-center text-xs text-base-content/60">{label}</p>
{/if}

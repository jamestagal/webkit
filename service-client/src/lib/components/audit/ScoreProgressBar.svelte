<script lang="ts">
	interface Props {
		label: string;
		score: number | null;
		max?: number;
	}

	let { label, score, max = 100 }: Props = $props();

	function thresholdClass(s: number | null): string {
		if (s == null) return 'progress';
		if (s >= 80) return 'progress progress-success';
		if (s >= 60) return 'progress progress-warning';
		return 'progress progress-error';
	}

	function scoreTextClass(s: number | null): string {
		if (s == null) return 'text-base-content/40';
		if (s >= 80) return 'text-success';
		if (s >= 60) return 'text-warning';
		return 'text-error';
	}

	let barClass = $derived(thresholdClass(score));
	let textClass = $derived(scoreTextClass(score));
	let displayValue = $derived(score != null ? `${score}%` : '—');
	let progressValue = $derived(score ?? 0);
</script>

<div>
	<div class="mb-1 flex items-baseline justify-between text-sm">
		<span class="text-base-content/80">{label}</span>
		<span class="font-medium {textClass}">{displayValue}</span>
	</div>
	<progress class="{barClass} w-full" value={progressValue} {max}></progress>
</div>

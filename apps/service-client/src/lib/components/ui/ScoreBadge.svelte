<script lang="ts">
	let { score }: { score: number } = $props();

	let cls = $derived(
		score >= 70
			? 'text-success bg-success/10 border-success/30'
			: score >= 40
				? 'text-warning bg-warning/10 border-warning/30'
				: 'text-error bg-error/10 border-error/30'
	);
</script>

<span class="text-sm font-bold px-2 py-0.5 rounded-lg border {cls}">
	{score}
</span>

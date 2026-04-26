<script lang="ts">
	import type { Snippet } from 'svelte';
	import ScoreDonut from './ScoreDonut.svelte';

	interface Props {
		title: string;
		score?: number | null;
		children: Snippet;
	}

	let { title, score, children }: Props = $props();
</script>

<div class="rounded-xl border border-base-300 bg-base-100 p-6">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-base font-semibold text-base-content">{title}</h3>
		{#if score != null}
			<ScoreDonut {score} size="sm" />
		{/if}
	</div>
	{@render children()}
</div>

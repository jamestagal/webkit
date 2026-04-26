<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		title: string;
		intro?: string;
		children: Snippet;
	}

	let { id, title, intro, children }: Props = $props();
</script>

<section {id} class="scroll-mt-20 space-y-4">
	<div>
		<h2 class="text-xl font-semibold text-base-content" style="color: var(--agency-primary);">{title}</h2>
		{#if intro}
			<p class="mt-1 text-sm text-base-content/60">{intro}</p>
		{/if}
	</div>
	{@render children()}
</section>

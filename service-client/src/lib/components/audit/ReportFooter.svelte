<script lang="ts">
	import type { ReportAgencyBranding } from '$lib/server/share-tokens';

	interface Props {
		agency: ReportAgencyBranding;
	}

	let { agency }: Props = $props();

	let ctaUrl = $derived(agency.website || null);
</script>

<footer class="mt-12 border-t border-base-300 px-6 py-8">
	<div class="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between">
		{#if ctaUrl}
			<a
				href={ctaUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="btn btn-sm border-none text-white"
				style="background: var(--agency-accent-gradient, var(--agency-accent, var(--agency-primary, #0ea5e9)));"
			>
				Contact {agency.name}
			</a>
		{:else}
			<span class="text-sm font-medium" style="color: var(--agency-primary);">{agency.name}</span>
		{/if}

		<p class="text-xs text-base-content/40">
			Powered by <a href="https://webkit.au" target="_blank" rel="noopener noreferrer" class="hover:underline">Webkit</a>
		</p>
	</div>
</footer>

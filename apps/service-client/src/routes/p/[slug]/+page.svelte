<script lang="ts">
	/**
	 * Public Proposal View — thin wrapper.
	 *
	 * Owns only page-level concerns: SEO metadata, the expired-state branch,
	 * and handing `data` / `form` / `branding` to ProposalDocument. All
	 * branded rendering, state, and client-response handling live inside
	 * the component (see $lib/components/documents/ProposalDocument.svelte).
	 */

	import { untrack } from 'svelte';
	import type { PageData, ActionData } from './$types';
	import { Clock } from 'lucide-svelte';
	import SvelteSeo from 'svelte-seo';
	import ProposalDocument from '$lib/components/documents/ProposalDocument.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Public proposal page — frozen render of the proposal document at mount.
	// untrack() makes the snapshot intent explicit; the page does not auto-update
	// if the parent invalidates (full reload required to see new server state).
	const { proposal, agency, branding } = untrack(() => data);
</script>

<SvelteSeo
	title="{proposal.title} — {agency?.name}"
	description={proposal.executiveSummary
		? proposal.executiveSummary.substring(0, 160)
		: `Proposal from ${agency?.name}`}
	openGraph={{
		type: 'website',
		title: `${proposal.title} — ${agency?.name}`,
		description: proposal.executiveSummary
			? proposal.executiveSummary.substring(0, 160)
			: `Proposal from ${agency?.name}`
	}}
	noindex={true}
	nofollow={true}
/>

<svelte:head>
	<title>{proposal.title} | {agency?.name}</title>
</svelte:head>

{#if proposal.status === 'expired'}
	<div class="flex min-h-screen items-center justify-center bg-base-200">
		<div class="text-center">
			<Clock class="mx-auto h-16 w-16 text-base-content/30" />
			<h1 class="mt-4 text-2xl font-bold">Proposal Expired</h1>
			<p class="text-base-content/60 mt-2">
				This proposal is no longer valid. Please contact {agency?.name} for an updated quote.
			</p>
		</div>
	</div>
{:else}
	<ProposalDocument {data} {form} {branding} previewMode={false} />
{/if}

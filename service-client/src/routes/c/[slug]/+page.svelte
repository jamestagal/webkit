<script lang="ts">
	/**
	 * Public Contract View — thin wrapper.
	 *
	 * Owns only SEO metadata; hands `data` / `form` / `branding` to
	 * ContractDocument, which renders the full branded document and owns
	 * its own state.
	 */
	import type { PageProps, ActionData } from './$types';
	import ContractDocument from '$lib/components/documents/ContractDocument.svelte';

	let { data, form }: PageProps & { form: ActionData } = $props();

	let contract = $derived(data.contract);
	let agency = $derived(data.agency);
	let branding = $derived(data.branding);
</script>

<svelte:head>
	<title>Contract {contract.contractNumber} | {agency?.name || 'Contract'}</title>
</svelte:head>

<ContractDocument {data} {form} {branding} previewMode={false} />

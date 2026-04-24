<script lang="ts">
	/**
	 * Public Quotation View — thin wrapper.
	 *
	 * Owns only SEO metadata and print stylesheet scoping; hands `data` /
	 * `form` / `branding` to QuotationDocument, which renders the full
	 * branded document and owns its own state.
	 */
	import type { PageProps, ActionData } from './$types';
	import SvelteSeo from 'svelte-seo';
	import QuotationDocument from '$lib/components/documents/QuotationDocument.svelte';

	let { data, form }: PageProps & { form: ActionData } = $props();

	let agency = $derived(data.agency);
	let branding = $derived(data.branding);
</script>

<SvelteSeo
	title="Quotation — {agency?.name || 'Quotation'}"
	description="Quotation from {agency?.name || 'Agency'}"
	noindex={true}
	nofollow={true}
/>

<svelte:head>
	<title>Quotation {data.quotation.quotationNumber} | {agency?.name || 'Quotation'}</title>
	<style>
		@media print {
			body * {
				visibility: hidden;
			}
			#quotation-content,
			#quotation-content * {
				visibility: visible;
			}
			#quotation-content {
				position: absolute;
				left: 0;
				top: 0;
				width: 100%;
			}
			.print-hidden {
				display: none !important;
			}
		}
	</style>
</svelte:head>

<QuotationDocument {data} {form} {branding} previewMode={false} />

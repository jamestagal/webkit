<script lang="ts">
	/**
	 * Public Invoice View — thin wrapper.
	 *
	 * Owns only SEO metadata + print stylesheet; hands `data` / `branding`
	 * to InvoiceDocument.
	 */
	import type { PageProps } from './$types';
	import SvelteSeo from 'svelte-seo';
	import InvoiceDocument from '$lib/components/documents/InvoiceDocument.svelte';

	let { data }: PageProps = $props();

	let invoice = $derived(data.invoice);
	let agency = $derived(data.agency);
	let branding = $derived(data.branding);
</script>

<SvelteSeo
	title="Invoice #{invoice.invoiceNumber} — {agency?.name}"
	description="Invoice from {agency?.name}"
	noindex={true}
	nofollow={true}
/>

<svelte:head>
	<title>Invoice {invoice.invoiceNumber} | {agency?.name}</title>
	<style>
		@media print {
			body * {
				visibility: hidden;
			}
			#invoice-content,
			#invoice-content * {
				visibility: visible;
			}
			#invoice-content {
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

<InvoiceDocument {data} {branding} previewMode={false} />

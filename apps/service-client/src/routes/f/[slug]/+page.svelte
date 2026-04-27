<script lang="ts">
	/**
	 * Public Form Page — thin wrapper.
	 *
	 * Owns only SEO metadata; hands `data` / `branding` to
	 * FormDocument, which renders the DynamicForm-branded
	 * surface and owns auto-save + submission state.
	 */
	import SvelteSeo from 'svelte-seo';
	import FormDocument from '$lib/components/documents/FormDocument.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let form = $derived(data.form);
	let agency = $derived(data.agency);
	let branding = $derived(data.branding);
</script>

<SvelteSeo
	title="{form?.name || 'Form'} — {agency?.name}"
	description="Complete this form from {agency?.name}"
	jsonLd={{
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		name: form?.name || 'Form',
		description: form?.description || `Form from ${agency?.name}`
	}}
/>

<svelte:head>
	<title>{form?.name || 'Form'} - {agency?.name}</title>
</svelte:head>

<FormDocument {data} {branding} previewMode={false} />

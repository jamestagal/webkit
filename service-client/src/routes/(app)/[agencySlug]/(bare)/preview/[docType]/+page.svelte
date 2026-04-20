<script lang="ts">
	/**
	 * Branding Preview Page.
	 *
	 * Renders the correct *Document component for `docType`, wired with the
	 * resolved branding + a stub-or-real data payload from the loader. Every
	 * Document is invoked with `previewMode={true}` — interactive CTAs stay
	 * visible but inert, per the design contract documented in the
	 * `refactor(branding): normalise previewMode semantics` commit.
	 *
	 * Phase 2.3 adds a `postMessage` listener here that mutates the
	 * branding state so the parent (branding settings page) can drive
	 * live-preview updates without reloading the iframe. Phase 2.6 handles
	 * the email branch via `srcdoc`.
	 */
	import ProposalDocument from '$lib/components/documents/ProposalDocument.svelte';
	import ContractDocument from '$lib/components/documents/ContractDocument.svelte';
	import InvoiceDocument from '$lib/components/documents/InvoiceDocument.svelte';
	import QuotationDocument from '$lib/components/documents/QuotationDocument.svelte';
	import QuestionnaireDocument from '$lib/components/documents/QuestionnaireDocument.svelte';
	import type {
		EffectiveBranding,
		ProposalEffectiveBranding
	} from '$lib/server/document-branding';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The loader's `branding` is a union across doc types because the switch
	// is evaluated server-side. Each template branch below narrows to the
	// correct branding shape for its Document component.
	let branding = $derived(data.branding);
	let proposalBranding = $derived(branding as ProposalEffectiveBranding);
	let genericBranding = $derived(branding as EffectiveBranding);
</script>

{#if data.docType === 'proposal'}
	<ProposalDocument
		data={{
			proposal: data.proposal,
			agency: data.agency,
			profile: data.profile,
			selectedPackage: data.selectedPackage,
			selectedAddons: data.selectedAddons,
			isPreview: data.isPreview,
			branding: proposalBranding
		}}
		form={null}
		branding={proposalBranding}
		previewMode={true}
	/>
{:else if data.docType === 'contract'}
	<ContractDocument
		data={{
			contract: data.contract,
			agency: data.agency,
			profile: data.profile,
			includedSchedules: data.includedSchedules,
			isPreview: data.isPreview,
			branding: genericBranding
		}}
		form={null}
		branding={genericBranding}
		previewMode={true}
	/>
{:else if data.docType === 'invoice'}
	<InvoiceDocument
		data={{
			invoice: data.invoice,
			lineItems: data.lineItems,
			agency: data.agency,
			profile: data.profile ?? null,
			branding: genericBranding
		}}
		branding={genericBranding}
		previewMode={true}
	/>
{:else if data.docType === 'quotation'}
	<QuotationDocument
		data={{
			quotation: data.quotation,
			sections: data.sections,
			agency: data.agency,
			profile: data.profile ?? null,
			branding: genericBranding
		}}
		form={null}
		branding={genericBranding}
		previewMode={true}
	/>
{:else if data.docType === 'questionnaire'}
	<QuestionnaireDocument
		data={{
			submission: data.submission,
			form: data.form,
			agency: data.agency,
			branding: genericBranding
		}}
		branding={genericBranding}
		previewMode={true}
	/>
{:else if data.docType === 'email'}
	<!-- Email preview is handled by srcdoc in Phase 2.6 -->
	<div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
		<div class="card bg-base-100 shadow-lg max-w-md">
			<div class="card-body text-center">
				<p class="text-base-content/60">Email preview coming in Phase 2.6</p>
			</div>
		</div>
	</div>
{/if}

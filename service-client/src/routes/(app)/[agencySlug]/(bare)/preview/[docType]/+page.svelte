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
	 * postMessage bridge contract (Phase 2.3):
	 *   Incoming message shape : { type: 'branding-update', payload: Partial<branding> }
	 *   Validation             : rejects messages whose event.origin is not the
	 *                            document's own origin; rejects anything without
	 *                            the exact `type` string; rejects payload that
	 *                            isn't a plain object.
	 *   Mutation strategy      : Object.assign(overrideBranding, payload).
	 *                            In-place mutation so Svelte 5's $state proxy
	 *                            notifies downstream `style:--brand-*` directives;
	 *                            a reassignment (`overrideBranding = {...}`) would
	 *                            not trigger the same tracked path.
	 *   Debouncing             : NOT here. The parent is responsible for
	 *                            debouncing (advancedDebounce(150) per the
	 *                            revision doc). The listener processes every
	 *                            inbound message so stuck-open iframes don't
	 *                            drift out of sync with the agency's current
	 *                            branding form state.
	 *
	 * Phase 2.6 will replace the `email` branch with a `srcdoc` iframe
	 * rendering of the rendered email HTML.
	 */
	import { onMount } from 'svelte';
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

	// Mutable overlay seeded from the loader-resolved branding. Parent-posted
	// `branding-update` messages mutate this object in place; the wrapper's
	// `style:--brand-*` directives track it reactively and update every
	// descendant's CSS vars live. Initial render shows the loader's resolved
	// values — no message needed.
	let overrideBranding = $state<ProposalEffectiveBranding | EffectiveBranding>({
		...data.branding
	});

	let proposalBranding = $derived(overrideBranding as ProposalEffectiveBranding);
	let genericBranding = $derived(overrideBranding as EffectiveBranding);

	// Type-narrow incoming postMessage payloads before applying. The parent
	// is trusted (same origin), but the listener still enforces shape so a
	// future cross-origin iframe embedding accidentally pointing at this
	// route can't poison state with arbitrary objects.
	type BrandingUpdateMessage = {
		type: 'branding-update';
		payload: Partial<ProposalEffectiveBranding>;
	};

	function isBrandingUpdate(value: unknown): value is BrandingUpdateMessage {
		if (typeof value !== 'object' || value === null) return false;
		const v = value as { type?: unknown; payload?: unknown };
		if (v.type !== 'branding-update') return false;
		if (typeof v.payload !== 'object' || v.payload === null) return false;
		return true;
	}

	onMount(() => {
		function handleMessage(event: MessageEvent) {
			// Origin check runs first — abort before any payload parsing.
			if (event.origin !== window.location.origin) return;
			if (!isBrandingUpdate(event.data)) return;

			// In-place mutation — re-assignment would replace the $state proxy
			// reference and break the reactivity chain the wrapper relies on.
			Object.assign(overrideBranding, event.data.payload);
		}

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});
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

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateAgencyBranding } from '$lib/api/agency.remote';
	import { updateDocumentBranding } from '$lib/api/document-branding.remote';
	import HeroPaletteCard, {
		type GlobalBrandingFormState
	} from '$lib/components/branding/HeroPaletteCard.svelte';
	import BrandingOverrideCard, {
		type DocBrandingFormState
	} from '$lib/components/branding/BrandingOverrideCard.svelte';
	import type {
		EffectiveBranding,
		ProposalEffectiveBranding
	} from '$lib/server/document-branding';
	import type { DocumentType } from '$lib/server/schema';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const toast = getToast();
	const agencySlug = $derived(page.params.agencySlug ?? '');

	const DEFAULTS = {
		primaryColor: '#4F46E5',
		secondaryColor: '#1E40AF',
		accentColor: '#F59E0B',
		coverBg: '#E3EDF7'
	} as const;

	const DOC_CARDS: { docType: DocumentType; label: string }[] = [
		{ docType: 'proposal', label: 'Proposals' },
		{ docType: 'contract', label: 'Contracts' },
		{ docType: 'invoice', label: 'Invoices' },
		{ docType: 'quotation', label: 'Quotations' },
		{ docType: 'questionnaire', label: 'Questionnaires' },
		{ docType: 'email', label: 'Emails' }
	];

	function initialGlobal(): GlobalBrandingFormState {
		return {
			logoUrl: data.agency?.logoUrl ?? '',
			logoAvatarUrl: data.agency?.logoAvatarUrl ?? '',
			primaryColor: data.agency?.primaryColor ?? '',
			secondaryColor: data.agency?.secondaryColor ?? '',
			accentColor: data.agency?.accentColor ?? '',
			accentGradient: data.agency?.accentGradient ?? ''
		};
	}

	function initialDoc(docType: DocumentType): DocBrandingFormState {
		const o = data.documentBrandings?.[docType];
		return {
			useCustomBranding: o?.useCustomBranding ?? false,
			logoUrl: o?.logoUrl ?? '',
			primaryColor: o?.primaryColor ?? '',
			accentColor: o?.accentColor ?? '',
			accentGradient: o?.accentGradient ?? '',
			coverBgColor: o?.coverBgColor ?? '',
			coverTextColor: o?.coverTextColor ?? '',
			sectionHeadingColor: o?.sectionHeadingColor ?? '',
			ctaButtonColor: o?.ctaButtonColor ?? '',
			ctaButtonTextColor: o?.ctaButtonTextColor ?? '',
			footerBgColor: o?.footerBgColor ?? ''
		};
	}

	let globalForm = $state<GlobalBrandingFormState>(initialGlobal());
	let docForms = $state<Record<DocumentType, DocBrandingFormState>>({
		proposal: initialDoc('proposal'),
		contract: initialDoc('contract'),
		invoice: initialDoc('invoice'),
		quotation: initialDoc('quotation'),
		questionnaire: initialDoc('questionnaire'),
		email: initialDoc('email')
	});

	/**
	 * Globals-only effective branding — no per-doc overrides folded in
	 * (Cowork Flag 1). Used by the hero card's preview tile.
	 */
	const globalsOnly = $derived<EffectiveBranding>({
		logoUrl: globalForm.logoUrl,
		primaryColor: globalForm.primaryColor || DEFAULTS.primaryColor,
		secondaryColor: globalForm.secondaryColor || DEFAULTS.secondaryColor,
		accentColor: globalForm.accentColor || DEFAULTS.accentColor,
		accentGradient:
			globalForm.accentGradient ||
			`linear-gradient(135deg, ${globalForm.primaryColor || DEFAULTS.primaryColor} 0%, ${globalForm.accentColor || DEFAULTS.accentColor} 100%)`
	});

	/**
	 * Per-doc effective branding — mirrors getEffectiveBranding /
	 * getEffectiveProposalBranding from $lib/server/document-branding so
	 * the live preview matches the post-save server render.
	 */
	function computeEffective(docType: DocumentType): EffectiveBranding | ProposalEffectiveBranding {
		const o = docForms[docType];
		const useOverride = o.useCustomBranding;

		const primaryColor =
			(useOverride && o.primaryColor) || globalForm.primaryColor || DEFAULTS.primaryColor;
		const accentColor =
			(useOverride && o.accentColor) || globalForm.accentColor || DEFAULTS.accentColor;
		const logoUrl = (useOverride && o.logoUrl) || globalForm.logoUrl || '';
		const secondaryColor = globalForm.secondaryColor || DEFAULTS.secondaryColor;

		const explicitGradient =
			(useOverride && o.accentGradient) || globalForm.accentGradient || null;
		const accentGradient =
			explicitGradient || `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`;

		const base: EffectiveBranding = {
			logoUrl,
			primaryColor,
			secondaryColor,
			accentColor,
			accentGradient
		};

		if (docType !== 'proposal') return base;

		const agencyCoverBg = globalForm.secondaryColor || DEFAULTS.coverBg;
		return {
			...base,
			coverBgColor: (useOverride && o.coverBgColor) || agencyCoverBg,
			coverTextColor: useOverride ? o.coverTextColor || null : null,
			sectionHeadingColor: useOverride ? o.sectionHeadingColor || null : null,
			ctaButtonColor: useOverride ? o.ctaButtonColor || null : null,
			ctaButtonTextColor: useOverride ? o.ctaButtonTextColor || null : null,
			footerBgColor: (useOverride && o.footerBgColor) || agencyCoverBg
		};
	}

	const effectiveByDocType = $derived<Record<DocumentType, EffectiveBranding | ProposalEffectiveBranding>>({
		proposal: computeEffective('proposal'),
		contract: computeEffective('contract'),
		invoice: computeEffective('invoice'),
		quotation: computeEffective('quotation'),
		questionnaire: computeEffective('questionnaire'),
		email: computeEffective('email')
	});

	async function saveGlobal(next: GlobalBrandingFormState) {
		await updateAgencyBranding({
			logoUrl: next.logoUrl,
			logoAvatarUrl: next.logoAvatarUrl,
			primaryColor: next.primaryColor,
			secondaryColor: next.secondaryColor,
			accentColor: next.accentColor,
			accentGradient: next.accentGradient
		});
		await invalidateAll();
		toast.success('Global branding saved');
	}

	async function saveDoc(docType: DocumentType, next: DocBrandingFormState) {
		const isProposal = docType === 'proposal';
		await updateDocumentBranding({
			documentType: docType,
			useCustomBranding: next.useCustomBranding,
			logoUrl: next.logoUrl || null,
			primaryColor: next.primaryColor || null,
			accentColor: next.accentColor || null,
			accentGradient: next.accentGradient || null,
			coverBgColor: isProposal ? next.coverBgColor || null : undefined,
			coverTextColor: isProposal ? next.coverTextColor || null : undefined,
			sectionHeadingColor: isProposal ? next.sectionHeadingColor || null : undefined,
			ctaButtonColor: isProposal ? next.ctaButtonColor || null : undefined,
			ctaButtonTextColor: isProposal ? next.ctaButtonTextColor || null : undefined,
			footerBgColor: isProposal ? next.footerBgColor || null : undefined
		});
		await invalidateAll();
		const label = docType.charAt(0).toUpperCase() + docType.slice(1);
		toast.success(`${label} branding saved`);
	}
</script>

<div class="mx-auto max-w-5xl space-y-6 p-6">
	<header>
		<h1 class="text-2xl font-bold">Branding</h1>
		<p class="mt-1 text-base-content/70">
			Customize your agency's appearance. Per-document overrides cascade from your global palette.
		</p>
	</header>

	<HeroPaletteCard
		{agencySlug}
		value={globalForm}
		globalsOnlyBranding={globalsOnly}
		onSave={saveGlobal}
	/>

	{#each DOC_CARDS as { docType, label } (docType)}
		<BrandingOverrideCard
			{agencySlug}
			{docType}
			{label}
			value={docForms[docType]}
			effectiveBranding={effectiveByDocType[docType]}
			globalPrimary={globalsOnly.primaryColor}
			onSave={(next) => saveDoc(docType, next)}
		/>
	{/each}
</div>

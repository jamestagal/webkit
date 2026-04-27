<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateAgencyBranding } from '$lib/api/agency.remote';
	import { updateAgencyProfile } from '$lib/api/agency-profile.remote';
	import { updateDocumentBranding } from '$lib/api/document-branding.remote';
	import {
		FileText,
		Mail,
		Receipt,
		ClipboardList,
		Palette
	} from 'lucide-svelte';
	import AgencyDefaultsTab, {
		type GlobalBrandingFormState
	} from '$lib/components/branding/AgencyDefaultsTab.svelte';
	import DocBrandingTab, {
		type DocBrandingFormState
	} from '$lib/components/branding/DocBrandingTab.svelte';
	import StickyDirtySaveBar from '$lib/components/branding/StickyDirtySaveBar.svelte';
	import { createDirtyTracker } from '$lib/components/branding/useDirtyTracker.svelte';
	import type {
		EffectiveBranding,
		ProposalEffectiveBranding
	} from '$lib/server/document-branding';
	import type { DocumentType } from '$lib/server/schema';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const toast = getToast();
	const agencySlug = $derived(page.params.agencySlug ?? '');

	type TabId = 'defaults' | DocumentType;

	const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
		{ id: 'defaults', label: 'Agency Defaults', icon: Palette },
		{ id: 'proposal', label: 'Proposals', icon: FileText },
		{ id: 'contract', label: 'Contracts', icon: FileText },
		{ id: 'invoice', label: 'Invoices', icon: Receipt },
		{ id: 'quotation', label: 'Quotations', icon: Receipt },
		{ id: 'form', label: 'Forms', icon: ClipboardList },
		{ id: 'email', label: 'Emails', icon: Mail }
	];

	const DEFAULTS = {
		primaryColor: '#4F46E5',
		secondaryColor: '#1E40AF',
		accentColor: '#F59E0B',
		coverBg: '#E3EDF7'
	} as const;

	function initialGlobal(): GlobalBrandingFormState {
		return {
			logoUrl: data.agency?.logoUrl ?? '',
			logoAvatarUrl: data.agency?.logoAvatarUrl ?? '',
			primaryColor: data.agency?.primaryColor ?? '',
			secondaryColor: data.agency?.secondaryColor ?? '',
			accentColor: data.agency?.accentColor ?? '',
			accentGradient: data.agency?.accentGradient ?? '',
			tagline: data.profile?.tagline ?? '',
			brandFont: data.profile?.brandFont ?? '',
			socialLinkedin: data.profile?.socialLinkedin ?? '',
			socialFacebook: data.profile?.socialFacebook ?? '',
			socialInstagram: data.profile?.socialInstagram ?? '',
			socialTwitter: data.profile?.socialTwitter ?? ''
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

	let activeTab = $state<TabId>('defaults');
	let saving = $state(false);
	let pendingTabSwitch = $state<TabId | null>(null);

	let globalForm = $state<GlobalBrandingFormState>(initialGlobal());
	let docForms = $state<Record<DocumentType, DocBrandingFormState>>({
		proposal: initialDoc('proposal'),
		contract: initialDoc('contract'),
		invoice: initialDoc('invoice'),
		quotation: initialDoc('quotation'),
		form: initialDoc('form'),
		email: initialDoc('email')
	});

	const trackers = {
		defaults: createDirtyTracker(() => globalForm),
		proposal: createDirtyTracker(() => docForms.proposal),
		contract: createDirtyTracker(() => docForms.contract),
		invoice: createDirtyTracker(() => docForms.invoice),
		quotation: createDirtyTracker(() => docForms.quotation),
		form: createDirtyTracker(() => docForms.form),
		email: createDirtyTracker(() => docForms.email)
	};

	const TAB_BY_ID: Record<TabId, (typeof TABS)[number]> = TABS.reduce(
		(acc, t) => {
			acc[t.id] = t;
			return acc;
		},
		{} as Record<TabId, (typeof TABS)[number]>
	);
	const activeTabMeta = $derived(TAB_BY_ID[activeTab]);
	const activeIsDirty = $derived(trackers[activeTab].isDirty);

	const globalsOnly = $derived<EffectiveBranding>({
		logoUrl: globalForm.logoUrl,
		primaryColor: globalForm.primaryColor || DEFAULTS.primaryColor,
		secondaryColor: globalForm.secondaryColor || DEFAULTS.secondaryColor,
		accentColor: globalForm.accentColor || DEFAULTS.accentColor,
		accentGradient:
			globalForm.accentGradient ||
			`linear-gradient(135deg, ${globalForm.primaryColor || DEFAULTS.primaryColor} 0%, ${globalForm.accentColor || DEFAULTS.accentColor} 100%)`
	});

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
		form: computeEffective('form'),
		email: computeEffective('email')
	});

	function attemptSwitch(next: TabId) {
		if (next === activeTab) return;
		if (activeIsDirty) {
			pendingTabSwitch = next;
		} else {
			activeTab = next;
		}
	}

	function discardActive() {
		const baseline = JSON.parse(trackers[activeTab].baseline);
		if (activeTab === 'defaults') {
			Object.assign(globalForm, baseline);
		} else {
			Object.assign(docForms[activeTab], baseline);
		}
	}

	function discardAndSwitch() {
		discardActive();
		if (pendingTabSwitch) {
			activeTab = pendingTabSwitch;
			pendingTabSwitch = null;
		}
	}

	async function saveActive() {
		saving = true;
		try {
			if (activeTab === 'defaults') {
				// PR1.5: profile + branding save in parallel via the unified
				// sticky bar (item 4 reinterpretation per appraisal A1). The
				// OLD page had two separate save buttons (Save Profile / Save
				// Logo & Colors); v2 IA uses one sticky-bar save per active
				// tab, so both backend updates fire together. Partial failure
				// surfaces via the catch — toast reports whichever rejected.
				await Promise.all([
					updateAgencyProfile({
						tagline: globalForm.tagline,
						brandFont: globalForm.brandFont,
						socialLinkedin: globalForm.socialLinkedin,
						socialFacebook: globalForm.socialFacebook,
						socialInstagram: globalForm.socialInstagram,
						socialTwitter: globalForm.socialTwitter
					}),
					updateAgencyBranding({
						logoUrl: globalForm.logoUrl,
						logoAvatarUrl: globalForm.logoAvatarUrl,
						primaryColor: globalForm.primaryColor,
						secondaryColor: globalForm.secondaryColor,
						accentColor: globalForm.accentColor,
						accentGradient: globalForm.accentGradient
					})
				]);
			} else {
				const docType = activeTab;
				const next = docForms[docType];
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
			}
			await invalidateAll();
			trackers[activeTab].reset();
			toast.success(`${activeTabMeta.label} branding saved`);
		} catch (err) {
			toast.error('Save failed', err instanceof Error ? err.message : 'Unknown error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="mx-auto max-w-5xl space-y-6 p-6 pb-24">
	<header>
		<h1 class="text-2xl font-bold">Branding</h1>
		<p class="mt-1 text-sm text-base-content/70">
			Customize your agency's appearance. Per-document overrides cascade from your global palette.
		</p>
	</header>

	<div class="tabs tabs-bordered overflow-x-auto" role="tablist">
		{#each TABS as tab (tab.id)}
			{@const Icon = tab.icon}
			{@const dirty = trackers[tab.id].isDirty}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === tab.id}
				class="tab gap-2"
				class:tab-active={activeTab === tab.id}
				onclick={() => attemptSwitch(tab.id)}
			>
				<Icon class="h-4 w-4" />
				{tab.label}
				{#if dirty}
					<span
						class="inline-block h-1.5 w-1.5 rounded-full bg-warning"
						aria-label="Unsaved changes"
					></span>
				{/if}
			</button>
		{/each}
	</div>

	<div>
		{#if activeTab === 'defaults'}
			<AgencyDefaultsTab value={globalForm} />
		{:else}
			<DocBrandingTab
				{agencySlug}
				docType={activeTab}
				label={activeTabMeta.label}
				value={docForms[activeTab]}
				effectiveBranding={effectiveByDocType[activeTab]}
				globalsBranding={globalsOnly}
			/>
		{/if}
	</div>
</div>

<StickyDirtySaveBar
	visible={activeIsDirty}
	{saving}
	saveLabel="Save {activeTabMeta.label}"
	onSave={saveActive}
	onDiscard={discardActive}
/>

{#if pendingTabSwitch}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold">Discard unsaved changes?</h3>
			<p class="py-2 text-sm">
				You have unsaved changes on <strong>{activeTabMeta.label}</strong>. Switching tabs will
				discard them.
			</p>
			<div class="modal-action">
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => (pendingTabSwitch = null)}>
					Cancel
				</button>
				<button type="button" class="btn btn-warning btn-sm" onclick={discardAndSwitch}>
					Discard & switch
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop"
			onclick={() => (pendingTabSwitch = null)}
			aria-label="Close"
		></button>
	</div>
{/if}

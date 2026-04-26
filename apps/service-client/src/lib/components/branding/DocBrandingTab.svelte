<!--
	Per-document branding tab — LEFT/RIGHT split per the
	GridCardLayout-01 mockup (PR1.5 item 12).

	LEFT panel (`InheritedPaletteColumn`): read-only display of the
	inherited Global Palette (Primary / Secondary / Accent). Makes the
	cascade-from-globals storytelling visually obvious.

	RIGHT panel: editable per-doc override grid. NO gradient cell here —
	gradient is an agency-global concept (PR1.5 item 11). Existing
	`accentGradient` field on DocBrandingFormState is preserved (vestigial)
	so the server contract is unchanged; the UI just doesn't surface it.
-->
<script lang="ts">
	import type { DocumentType } from '$lib/server/schema';
	import type {
		EffectiveBranding,
		ProposalEffectiveBranding
	} from '$lib/server/document-branding';
	import ColorOverrideRow from './ColorOverrideRow.svelte';
	import InheritedPaletteColumn from './InheritedPaletteColumn.svelte';
	import LogoOverrideField from './LogoOverrideField.svelte';
	import BrandingPreviewFrame from './BrandingPreviewFrame.svelte';

	export type DocBrandingFormState = {
		useCustomBranding: boolean;
		logoUrl: string;
		primaryColor: string;
		accentColor: string;
		// Vestigial post-PR1.5 — gradient UI removed from per-doc tabs
		// (item 11). Field kept on the form state to avoid server-contract
		// churn; existing DB values pass through unchanged on save.
		accentGradient: string;
		coverBgColor: string;
		coverTextColor: string;
		sectionHeadingColor: string;
		ctaButtonColor: string;
		ctaButtonTextColor: string;
		footerBgColor: string;
	};

	type Props = {
		agencySlug: string;
		docType: DocumentType;
		label: string;
		value: DocBrandingFormState;
		effectiveBranding: EffectiveBranding | ProposalEffectiveBranding;
		globalsBranding: EffectiveBranding;
	};

	let {
		agencySlug,
		docType,
		label,
		value,
		effectiveBranding,
		globalsBranding
	}: Props = $props();

	const isProposal = $derived(docType === 'proposal');
	const isActive = $derived(value.useCustomBranding);
</script>

<section class="space-y-5">
	<header class="flex items-start justify-between gap-4">
		<div>
			<h2 class="text-lg font-semibold">{label} Branding</h2>
			<p class="text-sm text-base-content/60">
				{#if isActive}
					Override branding for {label.toLowerCase()} only.
				{:else}
					Using agency defaults — toggle on to customize.
				{/if}
			</p>
		</div>
		<label class="label cursor-pointer gap-2">
			<span class="label-text text-sm">Use custom branding</span>
			<input
				type="checkbox"
				class="toggle toggle-primary toggle-sm"
				bind:checked={value.useCustomBranding}
			/>
		</label>
	</header>

	<!-- LEFT/RIGHT split (item 12). Single wide card wraps both panels —
	     mirrors the GridCardLayout-01 mockup's "one card, internal
	     LEFT/RIGHT divider" treatment. Stacks below xl breakpoint;
	     internal `xl:border-l` provides the divider on wide viewports. -->
	<div
		class="flex flex-col gap-6 rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm xl:flex-row xl:gap-8"
	>
		<div class="xl:w-1/3">
			<InheritedPaletteColumn
				primaryColor={globalsBranding.primaryColor}
				secondaryColor={globalsBranding.secondaryColor}
				accentColor={globalsBranding.accentColor}
			/>
		</div>

		<div class="space-y-4 xl:w-2/3 xl:border-l xl:border-base-300 xl:pl-8">
			<header class="space-y-1">
				<h3 class="text-sm font-semibold">{label} Overrides</h3>
				<p class="text-xs text-base-content/60">
					Empty fields cascade from the global palette on the left.
				</p>
			</header>

			<div class="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-3">
				<ColorOverrideRow
					label="Primary"
					value={value.primaryColor}
					onChange={(v) => (value.primaryColor = v)}
					disabled={!isActive}
				/>
				<ColorOverrideRow
					label="Accent"
					value={value.accentColor}
					onChange={(v) => (value.accentColor = v)}
					disabled={!isActive}
				/>
				{#if isProposal}
					<ColorOverrideRow
						label="Cover BG"
						value={value.coverBgColor}
						onChange={(v) => (value.coverBgColor = v)}
						disabled={!isActive}
					/>
					<ColorOverrideRow
						label="Cover Text"
						value={value.coverTextColor}
						onChange={(v) => (value.coverTextColor = v)}
						disabled={!isActive}
					/>
					<ColorOverrideRow
						label="Section Heading"
						value={value.sectionHeadingColor}
						onChange={(v) => (value.sectionHeadingColor = v)}
						disabled={!isActive}
					/>
					<ColorOverrideRow
						label="CTA Button"
						value={value.ctaButtonColor}
						onChange={(v) => (value.ctaButtonColor = v)}
						disabled={!isActive}
					/>
					<ColorOverrideRow
						label="CTA Text"
						value={value.ctaButtonTextColor}
						onChange={(v) => (value.ctaButtonTextColor = v)}
						disabled={!isActive}
					/>
					<ColorOverrideRow
						label="Footer BG"
						value={value.footerBgColor}
						onChange={(v) => (value.footerBgColor = v)}
						disabled={!isActive}
					/>
				{/if}
			</div>

			<LogoOverrideField
				label="Logo Override"
				value={value.logoUrl}
				onChange={(v) => (value.logoUrl = v)}
				description="Optional. Falls back to agency logo when empty."
				disabled={!isActive}
			/>
		</div>
	</div>

	<BrandingPreviewFrame
		{agencySlug}
		{docType}
		branding={effectiveBranding}
		title="{label} preview"
	/>
</section>

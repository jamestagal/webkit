<script lang="ts">
	import type { DocumentType } from '$lib/server/schema';
	import type {
		EffectiveBranding,
		ProposalEffectiveBranding
	} from '$lib/server/document-branding';
	import ColorOverrideRow from './ColorOverrideRow.svelte';
	import GradientOverrideRow from './GradientOverrideRow.svelte';
	import LogoOverrideField from './LogoOverrideField.svelte';
	import BrandingPreviewFrame from './BrandingPreviewFrame.svelte';

	export type DocBrandingFormState = {
		useCustomBranding: boolean;
		logoUrl: string;
		primaryColor: string;
		accentColor: string;
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
	};

	let { agencySlug, docType, label, value, effectiveBranding }: Props = $props();

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

	<div class="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
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
		<GradientOverrideRow
			label="Accent Gradient"
			value={value.accentGradient}
			onChange={(v) => (value.accentGradient = v)}
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

	<BrandingPreviewFrame
		{agencySlug}
		{docType}
		branding={effectiveBranding}
		title="{label} preview"
	/>
</section>

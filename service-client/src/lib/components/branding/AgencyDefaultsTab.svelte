<!--
	Agency Defaults tab content — global palette + logos + preview.

	The internal preview MUST use globals-only branding (the agency's
	primary/secondary/accent/accentGradient/logoUrl directly). Mixing in
	per-doc overrides would break the "this is what your global brand looks
	like" semantic. See branding-workspace-v2 plan, Cowork appraisal Flag 1.
-->
<script lang="ts">
	import type { EffectiveBranding } from '$lib/server/document-branding';
	import ColorOverrideRow from './ColorOverrideRow.svelte';
	import GradientOverrideRow from './GradientOverrideRow.svelte';
	import LogoOverrideField from './LogoOverrideField.svelte';
	import BrandingPreviewFrame from './BrandingPreviewFrame.svelte';

	export type GlobalBrandingFormState = {
		logoUrl: string;
		logoAvatarUrl: string;
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
		accentGradient: string;
		// Agency profile fields (PR1.5 — restored from OLD page).
		// Persisted via updateAgencyProfile, not updateAgencyBranding.
		tagline: string;
		brandFont: string;
		socialLinkedin: string;
		socialFacebook: string;
		socialInstagram: string;
		socialTwitter: string;
	};

	type Props = {
		agencySlug: string;
		value: GlobalBrandingFormState;
		globalsOnlyBranding: EffectiveBranding;
	};

	let { agencySlug, value, globalsOnlyBranding }: Props = $props();
</script>

<section class="space-y-5">
	<header class="flex items-baseline justify-between gap-4">
		<div>
			<h2 class="text-lg font-semibold">Global Palette</h2>
			<p class="text-sm text-base-content/60">
				The source-of-truth for your agency's brand. Per-document overrides cascade from here.
			</p>
		</div>
	</header>

	<div class="grid grid-cols-2 gap-2 md:grid-cols-4">
		<ColorOverrideRow
			label="Primary"
			value={value.primaryColor}
			onChange={(v) => (value.primaryColor = v)}
		/>
		<ColorOverrideRow
			label="Secondary"
			value={value.secondaryColor}
			onChange={(v) => (value.secondaryColor = v)}
		/>
		<ColorOverrideRow
			label="Accent"
			value={value.accentColor}
			onChange={(v) => (value.accentColor = v)}
		/>
		<GradientOverrideRow
			label="Accent Gradient"
			value={value.accentGradient}
			onChange={(v) => (value.accentGradient = v)}
		/>
	</div>

	<div class="space-y-2">
		<h3 class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Logos</h3>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<LogoOverrideField
				label="Horizontal Logo"
				value={value.logoUrl}
				onChange={(v) => (value.logoUrl = v)}
				description="Used in document headers."
			/>
			<LogoOverrideField
				label="Avatar Logo"
				value={value.logoAvatarUrl}
				onChange={(v) => (value.logoAvatarUrl = v)}
				description="Used in nav and small UI."
				maxBytes={1 * 1024 * 1024}
			/>
		</div>
	</div>

	<BrandingPreviewFrame
		{agencySlug}
		docType="proposal"
		branding={globalsOnlyBranding}
		title="Global branding preview"
	/>
</section>

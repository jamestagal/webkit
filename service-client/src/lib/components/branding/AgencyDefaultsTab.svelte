<!--
	Agency Defaults tab — agency profile + logos + global palette + preview.

	The internal preview MUST use globals-only branding (the agency's
	primary/secondary/accent/accentGradient/logoUrl directly). Mixing in
	per-doc overrides would break the "this is what your global brand looks
	like" semantic. See branding-workspace-v2 plan, Cowork appraisal Flag 1.

	Profile fields (tagline, brandFont, social*) persist via
	updateAgencyProfile; logo + color fields via updateAgencyBranding. The
	parent +page.svelte's saveActive dispatches both via Promise.all on the
	unified sticky save bar (PR1.5 A1).
-->
<script lang="ts">
	import type { EffectiveBranding } from '$lib/server/document-branding';
	import { Info } from 'lucide-svelte';
	import ColorOverrideRow from './ColorOverrideRow.svelte';
	import ColorPreviewTiles from './ColorPreviewTiles.svelte';
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

	const fontOptions = [
		{ value: '', label: 'Default (System)' },
		{ value: 'Inter', label: 'Inter' },
		{ value: 'Roboto', label: 'Roboto' },
		{ value: 'Open Sans', label: 'Open Sans' },
		{ value: 'Lato', label: 'Lato' },
		{ value: 'Montserrat', label: 'Montserrat' },
		{ value: 'Poppins', label: 'Poppins' },
		{ value: 'Raleway', label: 'Raleway' },
		{ value: 'Playfair Display', label: 'Playfair Display' },
		{ value: 'Source Sans Pro', label: 'Source Sans Pro' }
	];
</script>

<section class="space-y-6">
	<p class="text-sm text-base-content/60">
		The source-of-truth for your agency's brand. Per-document overrides cascade from here.
	</p>

	<!-- Agency Profile (items 1-3: Tagline / Typography / Social Links) -->
	<div class="space-y-3">
		<h3 class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
			Agency Profile
		</h3>

		<div class="grid gap-3 md:grid-cols-2">
			<label class="form-control w-full">
				<span class="label py-1">
					<span class="label-text flex items-center gap-1 text-xs font-medium">
						Tagline
						<span class="tooltip tooltip-top" data-tip="Appears on proposals and documents.">
							<Info class="h-3 w-3 text-base-content/40" />
						</span>
					</span>
				</span>
				<input
					type="text"
					class="input input-bordered input-sm w-full"
					placeholder="Building digital experiences that matter"
					bind:value={value.tagline}
				/>
			</label>

			<label class="form-control w-full">
				<span class="label py-1">
					<span class="label-text flex items-center gap-1 text-xs font-medium">
						Brand Font
						<span
							class="tooltip tooltip-top"
							data-tip="Font for proposals, contracts, and invoices."
						>
							<Info class="h-3 w-3 text-base-content/40" />
						</span>
					</span>
				</span>
				<select class="select select-bordered select-sm w-full" bind:value={value.brandFont}>
					{#each fontOptions as font (font.value)}
						<option value={font.value}>{font.label}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="space-y-1">
			<span class="text-[10px] font-medium uppercase tracking-wider text-base-content/50">
				Social Links — connect your social media profiles
			</span>
			<div class="grid gap-2 md:grid-cols-2">
				<label class="input input-bordered input-sm flex items-center gap-1">
					<span class="whitespace-nowrap text-xs text-base-content/50">linkedin.com/company/</span>
					<input
						type="text"
						class="min-w-0 flex-1 bg-transparent outline-none"
						placeholder="your-company"
						bind:value={value.socialLinkedin}
					/>
				</label>

				<label class="input input-bordered input-sm flex items-center gap-1">
					<span class="whitespace-nowrap text-xs text-base-content/50">facebook.com/</span>
					<input
						type="text"
						class="min-w-0 flex-1 bg-transparent outline-none"
						placeholder="your-page"
						bind:value={value.socialFacebook}
					/>
				</label>

				<label class="input input-bordered input-sm flex items-center gap-1">
					<span class="whitespace-nowrap text-xs text-base-content/50">instagram.com/</span>
					<input
						type="text"
						class="min-w-0 flex-1 bg-transparent outline-none"
						placeholder="your-handle"
						bind:value={value.socialInstagram}
					/>
				</label>

				<label class="input input-bordered input-sm flex items-center gap-1">
					<span class="whitespace-nowrap text-xs text-base-content/50">x.com/</span>
					<input
						type="text"
						class="min-w-0 flex-1 bg-transparent outline-none"
						placeholder="your-handle"
						bind:value={value.socialTwitter}
					/>
				</label>
			</div>
		</div>
	</div>

	<!-- Logos (items 5-6) -->
	<div class="space-y-2">
		<h3 class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">Logos</h3>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<LogoOverrideField
				label="Horizontal Logo"
				value={value.logoUrl}
				onChange={(v) => (value.logoUrl = v)}
				tooltip="Used in: Proposals, Contracts, Questionnaires, Invoices, Email headers, PDF documents"
			/>
			<LogoOverrideField
				label="Avatar Logo"
				value={value.logoAvatarUrl}
				onChange={(v) => (value.logoAvatarUrl = v)}
				tooltip="Used in: Sidebar navigation, Agency switcher, Mobile menu"
				maxBytes={1 * 1024 * 1024}
			/>
		</div>
	</div>

	<!-- Brand Colors (items 7-10) -->
	<div class="space-y-3">
		<h3 class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
			Brand Colors
		</h3>

		<div class="grid grid-cols-1 gap-2 md:grid-cols-3">
			<ColorOverrideRow
				label="Primary"
				value={value.primaryColor}
				onChange={(v) => (value.primaryColor = v)}
				tooltip="Used in: Email headers, CTA buttons, fallback text"
			/>
			<ColorOverrideRow
				label="Secondary"
				value={value.secondaryColor}
				onChange={(v) => (value.secondaryColor = v)}
				tooltip="Used in: Proposal cover background"
			/>
			<ColorOverrideRow
				label="Accent"
				value={value.accentColor}
				onChange={(v) => (value.accentColor = v)}
				tooltip="Used in: PDF borders, section highlights, pricing cards"
			/>
		</div>

		<GradientOverrideRow
			label="Accent Gradient"
			value={value.accentGradient}
			onChange={(v) => (value.accentGradient = v)}
			placeholder="linear-gradient(180deg, rgba(247,1,120,1) 0%, rgba(160,8,156,1) 51%, rgba(99,13,178,1) 100%)"
			tooltip="CSS gradient for premium elements. Use CSS gradient syntax — leave empty to fall back to the solid accent."
		/>

		<ColorPreviewTiles
			primaryColor={value.primaryColor}
			secondaryColor={value.secondaryColor}
			accentColor={value.accentColor}
			accentGradient={value.accentGradient}
		/>
	</div>

	<BrandingPreviewFrame
		{agencySlug}
		docType="proposal"
		branding={globalsOnlyBranding}
		title="Global branding preview"
	/>
</section>

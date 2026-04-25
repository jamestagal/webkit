<!--
	Hero card for global agency branding.

	The internal preview MUST use globals-only branding (the agency's
	primary/secondary/accent/accentGradient/logoUrl directly) — NOT the
	resolver output of getEffectiveProposalBranding(agencyId), which folds
	in proposal-level overrides. The hero represents the global brand
	identity; mixing in proposal overrides confuses agencies who set them
	and breaks the "this is what your global brand looks like" semantic.
	See branding-workspace-v2 plan, Cowork appraisal Flag 1 (2026-04-25).
-->
<script lang="ts">
	import { getToast } from '$lib/ui/toast_store.svelte';
	import ColorOverrideRow from './ColorOverrideRow.svelte';
	import LogoOverrideField from './LogoOverrideField.svelte';
	import BrandingPreviewFrame from './BrandingPreviewFrame.svelte';
	import StickyDirtySaveBar from './StickyDirtySaveBar.svelte';
	import { createDirtyTracker } from './useDirtyTracker.svelte';

	export type GlobalBrandingFormState = {
		logoUrl: string;
		logoAvatarUrl: string;
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
		accentGradient: string;
	};

	type Props = {
		agencySlug: string;
		value: GlobalBrandingFormState;
		onSave: (next: GlobalBrandingFormState) => Promise<void>;
		frame?: HTMLIFrameElement | undefined;
	};

	let { agencySlug, value, onSave, frame = $bindable() }: Props = $props();

	const toast = getToast();
	const tracker = createDirtyTracker(() => value);
	let saving = $state(false);

	async function handleSave() {
		saving = true;
		try {
			await onSave(value);
			tracker.reset();
		} catch (err) {
			toast.error('Save failed', err instanceof Error ? err.message : 'Unknown error');
		} finally {
			saving = false;
		}
	}

	function handleDiscard() {
		Object.assign(value, JSON.parse(tracker.baseline));
	}
</script>

<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
	<header class="flex items-center justify-between gap-4 border-b border-base-200 px-5 py-4">
		<div>
			<h2 class="text-lg font-semibold">Global Palette</h2>
			<p class="text-sm text-base-content/60">
				The source-of-truth for your agency's brand. Per-document overrides cascade from here.
			</p>
		</div>
	</header>

	<div class="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
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
		<ColorOverrideRow
			label="Accent Gradient"
			value={value.accentGradient}
			onChange={(v) => (value.accentGradient = v)}
			description="Optional. Falls back to a primary→accent gradient when empty."
		/>
	</div>

	<div
		class="grid grid-cols-1 gap-4 border-t border-base-200 bg-base-200/40 p-5 md:grid-cols-[2fr_1fr_1fr]"
	>
		<BrandingPreviewFrame
			{agencySlug}
			docType="proposal"
			bind:frame
			title="Global branding preview"
		/>
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

	<StickyDirtySaveBar
		visible={tracker.isDirty}
		{saving}
		saveLabel="Save Global Branding"
		onSave={handleSave}
		onDiscard={handleDiscard}
	/>
</div>

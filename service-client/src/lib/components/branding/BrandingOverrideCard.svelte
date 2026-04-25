<script lang="ts">
	import type { DocumentType } from '$lib/server/schema';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { ChevronRight } from 'lucide-svelte';
	import ColorOverrideRow from './ColorOverrideRow.svelte';
	import LogoOverrideField from './LogoOverrideField.svelte';
	import BrandingPreviewFrame from './BrandingPreviewFrame.svelte';
	import StickyDirtySaveBar from './StickyDirtySaveBar.svelte';
	import { createDirtyTracker } from './useDirtyTracker.svelte';

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
		globalPrimary: string;
		onSave: (next: DocBrandingFormState) => Promise<void>;
		frame?: HTMLIFrameElement | undefined;
	};

	let {
		agencySlug,
		docType,
		label,
		value,
		globalPrimary,
		onSave,
		frame = $bindable()
	}: Props = $props();

	const toast = getToast();
	const tracker = createDirtyTracker(() => value);
	let saving = $state(false);

	const isProposal = $derived(docType === 'proposal');

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

	function activate() {
		value.useCustomBranding = true;
	}
</script>

<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
	{#if !value.useCustomBranding}
		<button
			type="button"
			onclick={activate}
			class="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-base-200"
		>
			<span
				class="block h-4 w-4 shrink-0 rounded-full ring-1 ring-base-300"
				style:background-color={globalPrimary}
			></span>
			<span class="font-semibold">{label} Branding</span>
			<span class="text-sm text-base-content/60">Using agency defaults</span>
			<span class="ml-auto flex items-center gap-1 text-sm font-medium text-primary">
				Customize
				<ChevronRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
			</span>
		</button>
	{:else}
		<header class="flex items-center justify-between gap-4 border-b border-base-200 px-5 py-4">
			<div class="flex items-center gap-3">
				<h3 class="text-lg font-semibold">{label} Branding</h3>
				<span
					class="rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success"
				>
					Active
				</span>
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

		<div class="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
			<ColorOverrideRow
				label="Primary Color"
				value={value.primaryColor}
				onChange={(v) => (value.primaryColor = v)}
			/>
			<ColorOverrideRow
				label="Accent Color"
				value={value.accentColor}
				onChange={(v) => (value.accentColor = v)}
			/>
			{#if isProposal}
				<ColorOverrideRow
					label="Cover Background"
					value={value.coverBgColor}
					onChange={(v) => (value.coverBgColor = v)}
				/>
				<ColorOverrideRow
					label="Cover Text"
					value={value.coverTextColor}
					onChange={(v) => (value.coverTextColor = v)}
				/>
				<ColorOverrideRow
					label="Section Heading"
					value={value.sectionHeadingColor}
					onChange={(v) => (value.sectionHeadingColor = v)}
				/>
				<ColorOverrideRow
					label="CTA Button"
					value={value.ctaButtonColor}
					onChange={(v) => (value.ctaButtonColor = v)}
				/>
				<ColorOverrideRow
					label="CTA Text"
					value={value.ctaButtonTextColor}
					onChange={(v) => (value.ctaButtonTextColor = v)}
				/>
				<ColorOverrideRow
					label="Footer Background"
					value={value.footerBgColor}
					onChange={(v) => (value.footerBgColor = v)}
				/>
			{/if}
		</div>

		<div
			class="grid grid-cols-1 gap-4 border-t border-base-200 bg-base-200/40 p-5 md:grid-cols-[2fr_1fr]"
		>
			<BrandingPreviewFrame {agencySlug} {docType} bind:frame title="{label} preview" />
			<LogoOverrideField
				label="Logo Override"
				value={value.logoUrl}
				onChange={(v) => (value.logoUrl = v)}
				description="Optional. Falls back to agency logo when empty."
			/>
		</div>

		<StickyDirtySaveBar
			visible={tracker.isDirty}
			{saving}
			saveLabel="Save {label} Branding"
			onSave={handleSave}
			onDiscard={handleDiscard}
		/>
	{/if}
</div>

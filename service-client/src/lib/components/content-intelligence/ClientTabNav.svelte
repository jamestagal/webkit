<script lang="ts">
	import { page } from '$app/state';
	import { ChevronDown, X } from 'lucide-svelte';
	import { alpha } from '$lib/types/content-intelligence';
	import type { NavTab, NavTabId, NavGroupId } from '$lib/types/content-intelligence';

	interface Props {
		agencySlug: string;
		clientId: string;
		primaryColor: string;
	}

	let { agencySlug, clientId, primaryColor }: Props = $props();

	// TODO: flip when Local SEO Phase 2 ships
	const GBP_ENABLED = false;
	// TODO: flip when SEO Content Generation ships
	const ARTICLES_ENABLED = false;

	let base = $derived(`/${agencySlug}/content/${clientId}`);
	let pathname = $derived(page.url.pathname);

	let activeTabId = $derived.by<NavTabId>(() => {
		if (pathname === base) return 'overview';
		if (pathname.startsWith(`${base}/audit`)) return 'audit';
		if (pathname.startsWith(`${base}/brand`)) return 'brand';
		if (pathname.startsWith(`${base}/pages`)) return 'pages';
		if (pathname.startsWith(`${base}/reports`)) return 'reports';
		if (pathname.startsWith(`${base}/copy`)) return 'copy';
		if (pathname.startsWith(`${base}/social`)) return 'social';
		return 'overview';
	});

	let activeGroup = $derived.by<NavGroupId | null>(() => {
		if (['audit', 'brand', 'gbp', 'pages', 'reports'].includes(activeTabId)) return 'analysis';
		if (['copy', 'articles', 'social'].includes(activeTabId)) return 'content';
		return null;
	});

	let overviewTab: NavTab = $derived({
		id: 'overview',
		label: 'Overview',
		href: base
	});

	let analysisTabs = $derived<NavTab[]>([
		{
			id: 'audit',
			label: 'SEO Audit',
			href: `${base}/audit`,
			group: 'analysis'
		},
		{
			id: 'brand',
			label: 'Brand Voice',
			href: `${base}/brand`,
			group: 'analysis'
		},
		{
			id: 'gbp',
			label: 'Google Business',
			href: GBP_ENABLED ? `${base}/gbp` : undefined,
			disabledReason: 'Coming in Local SEO Phase 2',
			group: 'analysis'
		},
		{
			id: 'pages',
			label: 'Pages',
			href: `${base}/pages`,
			group: 'analysis'
		},
		{
			id: 'reports',
			label: 'Reports',
			href: `${base}/reports`,
			group: 'analysis'
		}
	]);

	let contentTabs = $derived<NavTab[]>([
		{
			id: 'copy',
			label: 'Page Copy',
			href: `${base}/copy`,
			group: 'content'
		},
		{
			id: 'articles',
			label: 'SEO Articles',
			href: ARTICLES_ENABLED ? `${base}/articles` : undefined,
			isNew: true,
			disabledReason: 'Coming with SEO Article Generation',
			group: 'content'
		},
		{
			id: 'social',
			label: 'Social Posts',
			href: `${base}/social`,
			group: 'content'
		}
	]);

	let activeTabLabel = $derived.by(() => {
		if (activeTabId === 'overview') return overviewTab.label;
		return (
			[...analysisTabs, ...contentTabs].find((t) => t.id === activeTabId)?.label ?? 'Overview'
		);
	});

	let navPrimary = $derived(primaryColor || '#155eef');
	let navPrimarySoft = $derived(alpha(navPrimary, 12));

	// Bottom-sheet state
	let sheetEl: HTMLDialogElement;
	let triggerEl: HTMLButtonElement | undefined = $state();
	let sheetOpen = $state(false);

	function openSheet() {
		sheetOpen = true;
		sheetEl.classList.add('modal-open');
		sheetEl.showModal();
	}

	function closeSheet() {
		sheetEl.close();
	}

	function onSheetClose() {
		sheetOpen = false;
		sheetEl.classList.remove('modal-open');
		triggerEl?.focus();
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === sheetEl) closeSheet();
	}

	function onDisabledClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
	}
</script>

<!-- Desktop nav (lg+): card surface wrapping three regions -->
<nav
	aria-label="Content Intelligence"
	class="hidden lg:flex items-center gap-0 rounded-2xl border border-base-200 bg-base-100 shadow-sm p-2"
	style="--nav-primary: {navPrimary}; --nav-primary-soft: {navPrimarySoft}; --nav-ring: color-mix(in srgb, {navPrimary} 40%, transparent)"
>
	<!-- Overview (standalone, same pill styling as sub-tabs) -->
	<div class="flex items-end px-3">
		<a
			href={overviewTab.href}
			aria-current={activeTabId === 'overview' ? 'page' : undefined}
			class="px-3.5 py-1.5 text-sm rounded-lg transition-[background-color,box-shadow,color] duration-200 whitespace-nowrap {activeTabId ===
			'overview'
				? 'font-semibold text-base-content'
				: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
			style={activeTabId === 'overview'
				? 'background-color: var(--nav-primary-soft); box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.06), 0 0 0 1px var(--nav-ring);'
				: undefined}
		>
			{overviewTab.label}
		</a>
	</div>

	<div class="w-px bg-base-300 self-stretch" aria-hidden="true"></div>

	<div role="group" aria-labelledby="nav-group-analysis" class="flex flex-col px-3 py-2 rounded-xl bg-base-200/60">
		<span
			id="nav-group-analysis"
			aria-hidden="true"
			class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-1 pb-1 cursor-default select-none transition-colors duration-200 {activeGroup ===
			'analysis'
				? 'text-base-content/65'
				: 'text-base-content/40'}"
		>
			<span class="w-1 h-1 rounded-full bg-[#a855f7]" aria-hidden="true"></span>
			Website Analysis
		</span>
		<div class="flex items-end gap-0.5">
			{#each analysisTabs as tab (tab.id)}
				{@const isActive = activeTabId === tab.id}
				{@const isDisabled = tab.href === undefined}
				{#if isDisabled}
					<a
						href="#"
						aria-disabled="true"
						tabindex={-1}
						onclick={onDisabledClick}
						title={tab.disabledReason}
						class="px-3.5 py-1.5 text-sm text-base-content/30 rounded-lg cursor-not-allowed select-none whitespace-nowrap"
					>
						{tab.label}
						{#if tab.isNew}
							<span
								class="ml-1.5 text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full"
							>
								New
							</span>
						{/if}
					</a>
				{:else}
					<a
						href={tab.href}
						aria-current={isActive ? 'page' : undefined}
						class="px-3.5 py-1.5 text-sm rounded-lg transition-[background-color,box-shadow,color] duration-200 whitespace-nowrap {isActive
							? 'font-semibold text-base-content'
							: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
						style={isActive
							? 'background-color: var(--nav-primary-soft); box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.06), 0 0 0 1px var(--nav-ring);'
							: undefined}
					>
						{tab.label}
						{#if tab.isNew}
							<span
								class="ml-1.5 text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full"
							>
								New
							</span>
						{/if}
					</a>
				{/if}
			{/each}
		</div>
	</div>

	<div class="w-px bg-base-300 self-stretch" aria-hidden="true"></div>

	<div role="group" aria-labelledby="nav-group-content" class="flex flex-col px-3 py-2 rounded-xl bg-base-200/60">
		<span
			id="nav-group-content"
			aria-hidden="true"
			class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-1 pb-1 cursor-default select-none transition-colors duration-200 {activeGroup ===
			'content'
				? 'text-base-content/65'
				: 'text-base-content/40'}"
		>
			<span class="w-1 h-1 rounded-full bg-[#ec4899]" aria-hidden="true"></span>
			Content Generation
		</span>
		<div class="flex items-end gap-0.5">
			{#each contentTabs as tab (tab.id)}
				{@const isActive = activeTabId === tab.id}
				{@const isDisabled = tab.href === undefined}
				{#if isDisabled}
					<a
						href="#"
						aria-disabled="true"
						tabindex={-1}
						onclick={onDisabledClick}
						title={tab.disabledReason}
						class="px-3.5 py-1.5 text-sm text-base-content/30 rounded-lg cursor-not-allowed select-none whitespace-nowrap"
					>
						{tab.label}
						{#if tab.isNew}
							<span
								class="ml-1.5 text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full"
							>
								New
							</span>
						{/if}
					</a>
				{:else}
					<a
						href={tab.href}
						aria-current={isActive ? 'page' : undefined}
						class="px-3.5 py-1.5 text-sm rounded-lg transition-[background-color,box-shadow,color] duration-200 whitespace-nowrap {isActive
							? 'font-semibold text-base-content'
							: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
						style={isActive
							? 'background-color: var(--nav-primary-soft); box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.06), 0 0 0 1px var(--nav-ring);'
							: undefined}
					>
						{tab.label}
						{#if tab.isNew}
							<span
								class="ml-1.5 text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full"
							>
								New
							</span>
						{/if}
					</a>
				{/if}
			{/each}
		</div>
	</div>
</nav>

<!-- Mobile trigger (< lg) -->
<button
	bind:this={triggerEl}
	type="button"
	class="lg:hidden btn btn-ghost border border-base-200 w-full justify-between font-normal"
	onclick={openSheet}
	aria-haspopup="dialog"
	aria-expanded={sheetOpen}
>
	<span class="text-sm text-base-content/60">
		Current: <strong class="text-base-content">{activeTabLabel}</strong>
	</span>
	<ChevronDown class="h-4 w-4" />
</button>

<!-- Mobile bottom-sheet -->
<dialog
	bind:this={sheetEl}
	class="modal modal-bottom"
	onclose={onSheetClose}
	onclick={onBackdropClick}
	aria-label="Client sections"
>
	<div
		class="modal-box bg-base-100 rounded-t-2xl rounded-b-none max-h-[80vh] p-4"
		style="--nav-primary: {navPrimary}; --nav-primary-soft: {navPrimarySoft}"
	>
		<div class="flex items-center justify-between mb-3">
			<span class="text-sm font-semibold">Navigate</span>
			<button
				type="button"
				class="btn btn-ghost btn-sm btn-circle"
				onclick={closeSheet}
				aria-label="Close"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<a
			href={overviewTab.href}
			onclick={closeSheet}
			aria-current={activeTabId === 'overview' ? 'page' : undefined}
			class="block px-3 py-2.5 rounded-lg text-sm {activeTabId === 'overview'
				? 'font-semibold text-base-content'
				: 'text-base-content/70 hover:bg-base-200'}"
			style={activeTabId === 'overview'
				? 'background-color: var(--nav-primary-soft, transparent)'
				: undefined}
		>
			{overviewTab.label}
		</a>

		<div role="group" aria-labelledby="m-group-analysis" class="mt-3">
			<span
				id="m-group-analysis"
				aria-hidden="true"
				class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-content/40 px-3 pb-1"
			>
				<span class="w-1 h-1 rounded-full bg-[#a855f7]" aria-hidden="true"></span>
				Website Analysis
			</span>
			{#each analysisTabs as tab (tab.id)}
				{@const isActive = activeTabId === tab.id}
				{@const isDisabled = tab.href === undefined}
				{#if isDisabled}
					<a
						href="#"
						aria-disabled="true"
						tabindex={-1}
						onclick={onDisabledClick}
						title={tab.disabledReason}
						class="block px-3 py-2.5 rounded-lg text-sm text-base-content/30 cursor-not-allowed select-none"
					>
						{tab.label}
						{#if tab.isNew}
							<span
								class="ml-1.5 text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full"
							>
								New
							</span>
						{/if}
					</a>
				{:else}
					<a
						href={tab.href}
						onclick={closeSheet}
						aria-current={isActive ? 'page' : undefined}
						class="block px-3 py-2.5 rounded-lg text-sm {isActive
							? 'font-semibold text-base-content'
							: 'text-base-content/70 hover:bg-base-200'}"
						style={isActive ? 'background-color: var(--nav-primary-soft, transparent)' : undefined}
					>
						{tab.label}
					</a>
				{/if}
			{/each}
		</div>

		<div role="group" aria-labelledby="m-group-content" class="mt-3">
			<span
				id="m-group-content"
				aria-hidden="true"
				class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-content/40 px-3 pb-1"
			>
				<span class="w-1 h-1 rounded-full bg-[#ec4899]" aria-hidden="true"></span>
				Content Generation
			</span>
			{#each contentTabs as tab (tab.id)}
				{@const isActive = activeTabId === tab.id}
				{@const isDisabled = tab.href === undefined}
				{#if isDisabled}
					<a
						href="#"
						aria-disabled="true"
						tabindex={-1}
						onclick={onDisabledClick}
						title={tab.disabledReason}
						class="block px-3 py-2.5 rounded-lg text-sm text-base-content/30 cursor-not-allowed select-none"
					>
						{tab.label}
						{#if tab.isNew}
							<span
								class="ml-1.5 text-[10px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full"
							>
								New
							</span>
						{/if}
					</a>
				{:else}
					<a
						href={tab.href}
						onclick={closeSheet}
						aria-current={isActive ? 'page' : undefined}
						class="block px-3 py-2.5 rounded-lg text-sm {isActive
							? 'font-semibold text-base-content'
							: 'text-base-content/70 hover:bg-base-200'}"
						style={isActive ? 'background-color: var(--nav-primary-soft, transparent)' : undefined}
					>
						{tab.label}
					</a>
				{/if}
			{/each}
		</div>
	</div>
</dialog>

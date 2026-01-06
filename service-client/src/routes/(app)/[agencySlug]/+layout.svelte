<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import {
		House,
		File,
		LogOut,
		MessageCircle,
		ClipboardList,
		FileText,
		Receipt,
		Settings,
		Users
	} from 'lucide-svelte';
	import { env } from '$env/dynamic/public';
	import { setAgencyConfig } from '$lib/stores/agency-config.svelte';
	import AgencySwitcher from '$lib/components/AgencySwitcher.svelte';

	let { children, data }: { children: Snippet; data: import('./$types').LayoutData } = $props();

	// Build current agency object for switcher
	let currentAgencyForSwitcher = $derived({
		id: data.agency.id,
		name: data.agency.name,
		slug: data.agency.slug,
		logoUrl: data.agency.logoUrl,
		primaryColor: data.agency.primaryColor,
		role: data.membership.role
	});

	// Set agency config context for child components
	$effect(() => {
		setAgencyConfig(data.agencyConfig);
	});

	let current = $derived(page.url.pathname);
	let agencySlug = $derived(data.agency.slug);
	let canAdmin = $derived(data.membership.role === 'owner' || data.membership.role === 'admin');

	// Navigation items scoped to agency
	let nav = $derived([
		{ label: 'Dashboard', url: `/${agencySlug}`, icon: House },
		{ label: 'Consultation', url: `/${agencySlug}/consultation`, icon: MessageCircle },
		{ label: 'My Consultations', url: `/${agencySlug}/consultation/history`, icon: ClipboardList },
		{ label: 'Proposals', url: `/${agencySlug}/proposals`, icon: FileText },
		{ label: 'Contracts', url: `/${agencySlug}/contracts`, icon: File },
		{ label: 'Invoices', url: `/${agencySlug}/invoices`, icon: Receipt }
	]);

	// Admin navigation (only shown to owner/admin)
	let adminNav = $derived([
		{ label: 'Settings', url: `/${agencySlug}/settings`, icon: Settings },
		{ label: 'Members', url: `/${agencySlug}/settings/members`, icon: Users }
	]);

	function showModal(): undefined {
		const modal = document.getElementById('sidebar') as HTMLDialogElement;
		if (modal) {
			modal.showModal();
		}
		return undefined;
	}
</script>

<div id="content" class="h-full">
	<!-- Desktop menu -->
	<div
		class="lg:bg-base-300 hidden !overflow-visible lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-20 lg:flex-col lg:overflow-y-auto lg:pb-4"
	>
		<div class="flex grow flex-col">
			<!-- Agency Logo or Default -->
			<a href="/{agencySlug}" class="mt-4 flex h-8 shrink-0 items-center justify-center">
				{#if data.agency.logoUrl}
					<img class="h-full" src={data.agency.logoUrl} alt={data.agency.name} />
				{:else}
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold"
						style="background-color: {data.agency.primaryColor}"
					>
						{data.agency.name.charAt(0).toUpperCase()}
					</div>
				{/if}
			</a>
			<nav class="mt-8 flex flex-1 flex-col">
				<ul role="list" class="flex flex-1 flex-col items-center space-y-1">
					{#each nav as item (item.url)}
						<li>
							<div class="tooltip tooltip-right" data-tip={item.label}>
								<a
									href={item.url}
									class="group hover:bg-base-100 flex cursor-pointer gap-x-3 rounded-md p-3 text-sm/6 font-semibold hover:opacity-80
                                            {current === item.url ? 'bg-base-100' : ''}"
								>
									<item.icon class="h-6 w-6" />
									<span class="sr-only">{item.label}</span>
								</a>
							</div>
						</li>
					{/each}

					<!-- Admin section -->
					{#if canAdmin}
						<li class="!mt-4 w-full">
							<div class="border-base-100 mx-3 border-t"></div>
						</li>
						{#each adminNav as item (item.url)}
							<li>
								<div class="tooltip tooltip-right" data-tip={item.label}>
									<a
										href={item.url}
										class="group hover:bg-base-100 flex cursor-pointer gap-x-3 rounded-md p-3 text-sm/6 font-semibold hover:opacity-80
                                            {current.startsWith(item.url) ? 'bg-base-100' : ''}"
									>
										<item.icon class="h-6 w-6" />
										<span class="sr-only">{item.label}</span>
									</a>
								</div>
							</li>
						{/each}
					{/if}

					<li class="!mt-auto">
						<div class="tooltip tooltip-right" data-tip="Logout">
							<form
								action={env.PUBLIC_CORE_URL + '/logout'}
								method="post"
								class="group hover:bg-base-100 flex cursor-pointer gap-x-3 rounded-md text-sm/6 font-semibold hover:opacity-80"
							>
								<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
								<button class="cursor-pointer p-3">
									<LogOut class="h-6 w-6" />
									<span class="sr-only">Logout</span>
								</button>
							</form>
						</div>
					</li>
				</ul>
			</nav>
		</div>
	</div>

	<!-- Mobile menu -->
	<div class="bg-base-300 sticky top-0 z-30 flex items-center gap-x-4 px-4 py-3 shadow-sm sm:px-6 lg:hidden">
		<button
			type="button"
			class="-m-2.5 cursor-pointer p-2.5 hover:opacity-60 lg:hidden"
			onclick={() => showModal()}
		>
			<span class="sr-only">Open sidebar</span>
			<svg
				class="size-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				aria-hidden="true"
				data-slot="icon"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
				></path>
			</svg>
		</button>
		<div class="flex-1"></div>
		<AgencySwitcher
			currentAgency={currentAgencyForSwitcher}
			agencies={data.userAgencies}
		/>
	</div>

	<!-- Sidebar -->
	<dialog id="sidebar" class="modal modal-start">
		<div class="modal-box w-full max-w-sm">
			<div class="relative flex-1 px-4 sm:px-6">
				<nav class="flex flex-1 flex-col">
					<ul role="list" class="-mx-2 flex-1 space-y-1">
						{#each nav as item (item.url)}
							<li>
								<a
									href={item.url}
									class="group hover:bg-base-200 flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold hover:opacity-80
                                    {current === item.url ? 'bg-base-200' : ''}"
								>
									<item.icon class="h-6 w-6" />
									{item.label}
								</a>
							</li>
						{/each}

						<!-- Admin section -->
						{#if canAdmin}
							<li class="!mt-4">
								<div class="border-base-200 border-t pt-4 text-xs font-medium uppercase text-gray-500">
									Admin
								</div>
							</li>
							{#each adminNav as item (item.url)}
								<li>
									<a
										href={item.url}
										class="group hover:bg-base-200 flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold hover:opacity-80
                                        {current.startsWith(item.url) ? 'bg-base-200' : ''}"
									>
										<item.icon class="h-6 w-6" />
										{item.label}
									</a>
								</li>
							{/each}
						{/if}

						<li class="!mt-4">
							<form
								action={env.PUBLIC_CORE_URL + '/logout'}
								method="post"
								class="group hover:bg-base-200 flex gap-x-3 rounded-md text-sm/6 font-semibold hover:opacity-80"
							>
								<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
								<button class="flex cursor-pointer gap-x-3 p-2">
									<LogOut class="h-6 w-6" />
									Logout
								</button>
							</form>
						</li>
					</ul>
				</nav>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>

	<main class="min-h-full lg:pl-20">
		<!-- Desktop header with agency switcher -->
		<div class="hidden lg:flex items-center justify-between border-b border-base-300 bg-base-100 px-8 py-3">
			<div class="flex items-center gap-3">
				<h1 class="text-lg font-semibold">{data.agency.name}</h1>
				{#if data.membership.displayName}
					<span class="text-sm text-base-content/60">
						Welcome, {data.membership.displayName}
					</span>
				{/if}
			</div>
			<AgencySwitcher
				currentAgency={currentAgencyForSwitcher}
				agencies={data.userAgencies}
			/>
		</div>
		<div class="px-4 py-10 sm:px-6 lg:px-8 xl:px-12 lg:py-6 max-w-[1600px]">
			{@render children()}
		</div>
	</main>
</div>

<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { Building2, Package, PlusSquare, Users, Palette, FileText, CreditCard, Sparkles } from 'lucide-svelte';

	let { children, data }: { children: Snippet; data: import('./$types').LayoutData } = $props();

	let current = $derived(page.url.pathname);
	let agencySlug = $derived(data.agency.slug);

	// Settings navigation items
	let settingsNav = $derived([
		{
			label: 'Agency Profile',
			url: `/${agencySlug}/settings/profile`,
			icon: Building2,
			description: 'Business details, address, banking'
		},
		{
			label: 'Branding',
			url: `/${agencySlug}/settings/branding`,
			icon: Palette,
			description: 'Logo, colors, social links'
		},
		{
			label: 'Packages',
			url: `/${agencySlug}/settings/packages`,
			icon: Package,
			description: 'Pricing tiers and features'
		},
		{
			label: 'Add-ons',
			url: `/${agencySlug}/settings/addons`,
			icon: PlusSquare,
			description: 'Optional services'
		},
		{
			label: 'Contracts',
			url: `/${agencySlug}/settings/contracts`,
			icon: FileText,
			description: 'Contract templates & terms'
		},
		{
			label: 'Members',
			url: `/${agencySlug}/settings/members`,
			icon: Users,
			description: 'Team management'
		},
		{
			label: 'Payments',
			url: `/${agencySlug}/settings/payments`,
			icon: CreditCard,
			description: 'Stripe Connect & online payments'
		},
		{
			label: 'Demo Data',
			url: `/${agencySlug}/settings/demo`,
			icon: Sparkles,
			description: 'Load or clear sample data'
		}
	]);

	// Check if on main settings page (no sub-route)
	let isSettingsIndex = $derived(current === `/${agencySlug}/settings`);
</script>

{#if isSettingsIndex}
	<!-- Settings index page with navigation cards -->
	<div>
		<div class="mb-6">
			<h1 class="text-2xl font-bold">Settings</h1>
			<p class="text-base-content/70 mt-1">Manage your agency configuration</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each settingsNav as item (item.url)}
				<a
					href={item.url}
					class="card bg-base-100 hover:bg-base-200 transition-colors border border-base-300"
				>
					<div class="card-body">
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
							>
								<item.icon class="h-5 w-5" />
							</div>
							<div>
								<h2 class="card-title text-base">{item.label}</h2>
								<p class="text-sm text-base-content/60">{item.description}</p>
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
{:else}
	<!-- Sub-page with sidebar navigation -->
	<div class="flex flex-col lg:flex-row gap-6">
		<!-- Sidebar navigation (desktop) -->
		<aside class="hidden lg:block w-64 flex-shrink-0">
			<div class="sticky top-6">
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Settings
				</h2>
				<nav class="space-y-1">
					{#each settingsNav as item (item.url)}
						<a
							href={item.url}
							class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
								{current.startsWith(item.url)
								? 'bg-primary/10 text-primary font-medium'
								: 'hover:bg-base-200 text-base-content/80'}"
						>
							<item.icon class="h-4 w-4" />
							{item.label}
						</a>
					{/each}
				</nav>
			</div>
		</aside>

		<!-- Mobile navigation -->
		<div class="lg:hidden">
			<div class="flex gap-2 overflow-x-auto pb-2">
				{#each settingsNav as item (item.url)}
					<a
						href={item.url}
						class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap
							{current.startsWith(item.url)
							? 'bg-primary text-primary-content'
							: 'bg-base-200 hover:bg-base-300'}"
					>
						<item.icon class="h-4 w-4" />
						{item.label}
					</a>
				{/each}
			</div>
		</div>

		<!-- Main content -->
		<main class="flex-1 min-w-0">
			{@render children()}
		</main>
	</div>
{/if}

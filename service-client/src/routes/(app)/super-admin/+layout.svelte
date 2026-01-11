<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { LayoutDashboard, Building2, Users, ScrollText, Shield, LogOut } from 'lucide-svelte';
	import { stopImpersonation } from '$lib/api/super-admin.remote';
	import { goto, invalidateAll } from '$app/navigation';

	let { children, data }: { children: Snippet; data: import('./$types').LayoutData } = $props();

	let current = $derived(page.url.pathname);

	// Navigation items
	const nav = [
		{ label: 'Dashboard', url: '/super-admin', icon: LayoutDashboard, exact: true },
		{ label: 'Agencies', url: '/super-admin/agencies', icon: Building2 },
		{ label: 'Users', url: '/super-admin/users', icon: Users },
		{ label: 'Audit Log', url: '/super-admin/audit-log', icon: ScrollText }
	];

	function isActive(item: (typeof nav)[0]): boolean {
		if (item.exact) {
			return current === item.url;
		}
		return current.startsWith(item.url);
	}

	async function handleStopImpersonation() {
		await stopImpersonation();
		await invalidateAll();
		await goto('/super-admin');
	}
</script>

<!-- Super Admin Warning Banner -->
<div class="bg-error text-error-content px-4 py-2 text-center text-sm font-medium">
	<div class="flex items-center justify-center gap-2">
		<Shield class="h-4 w-4" />
		<span>Super Admin Mode</span>
		{#if data.isImpersonating}
			<span class="mx-2">|</span>
			<span>Currently impersonating agency</span>
			<button onclick={handleStopImpersonation} class="btn btn-xs btn-ghost ml-2 gap-1">
				<LogOut class="h-3 w-3" />
				Exit
			</button>
		{/if}
	</div>
</div>

<div class="flex min-h-[calc(100vh-40px)]">
	<!-- Sidebar -->
	<aside class="w-64 border-r border-base-300 bg-base-100 p-4">
		<div class="mb-6">
			<h1 class="text-xl font-bold text-error">Super Admin</h1>
			<p class="text-sm text-base-content/60">{data.superAdmin.email}</p>
		</div>

		<nav class="space-y-1">
			{#each nav as item (item.url)}
				{@const NavIcon = item.icon}
				<a
					href={item.url}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
						{isActive(item)
						? 'bg-error/10 font-medium text-error'
						: 'text-base-content/70 hover:bg-base-200'}"
				>
					<NavIcon class="h-4 w-4" />
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="mt-8 border-t border-base-300 pt-4">
			<a href="/" class="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/70">
				<LogOut class="h-4 w-4" />
				Exit Super Admin
			</a>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="flex-1 overflow-auto p-6">
		{@render children()}
	</main>
</div>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { page } from "$app/state";
	import { ArrowLeft } from "lucide-svelte";
	import type { LayoutData } from "./$types";

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);
	let current = $derived(page.url.pathname);

	let tabs = $derived([
		{
			label: "Pages",
			href: `/${agencySlug}/content/${clientId}/pages`,
			active: current.includes("/pages"),
		},
		{
			label: "Brand",
			href: `/${agencySlug}/content/${clientId}/brand`,
			active: current.includes("/brand"),
		},
		{
			label: "Audit",
			href: `/${agencySlug}/content/${clientId}/audit`,
			active: current.includes("/audit"),
		},
		{
			label: "Copy",
			href: `/${agencySlug}/content/${clientId}/copy`,
			active: current.includes("/copy"),
		},
	]);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a href="/{agencySlug}/content" class="btn btn-ghost btn-sm btn-circle">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<h1 class="text-2xl font-bold">{data.client.businessName}</h1>
	</div>

	<!-- Tabs -->
	<div role="tablist" class="tabs tabs-bordered">
		{#each tabs as tab (tab.label)}
			<a
				href={tab.href}
				role="tab"
				class="tab"
				class:tab-active={tab.active}
			>
				{tab.label}
			</a>
		{/each}
	</div>

	<!-- Content -->
	{@render children()}
</div>

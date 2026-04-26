<script lang="ts">
	import type { Snippet } from "svelte";
	import { page } from "$app/state";
	import { ArrowLeft } from "lucide-svelte";
	import ClientTabNav from "$lib/components/content-intelligence/ClientTabNav.svelte";
	import type { LayoutData } from "./$types";

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let agencySlug = $derived(page.params.agencySlug!);
	let clientId = $derived(page.params.clientId!);
	let primaryColor = $derived(data.agency?.primaryColor ?? '#155eef');
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
	<ClientTabNav {agencySlug} {clientId} {primaryColor} />

	<!-- Content -->
	{@render children()}
</div>

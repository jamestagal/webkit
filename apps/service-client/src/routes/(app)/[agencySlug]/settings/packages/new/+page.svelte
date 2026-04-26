<script lang="ts">
	import PackageForm from '$lib/components/settings/PackageForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">New Package</h1>
		<p class="text-base-content/70 mt-1">Create a new pricing package</p>
	</div>

	<PackageForm {agencySlug} />
</div>

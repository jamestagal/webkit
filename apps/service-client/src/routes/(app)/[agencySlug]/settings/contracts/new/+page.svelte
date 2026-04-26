<script lang="ts">
	import ContractTemplateForm from '$lib/components/contracts/ContractTemplateForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">New Contract Template</h1>
		<p class="text-base-content/70 mt-1">Create a new contract template with your terms and conditions</p>
	</div>

	<ContractTemplateForm {agencySlug} />
</div>

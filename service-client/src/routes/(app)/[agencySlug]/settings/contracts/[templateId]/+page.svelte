<script lang="ts">
	import ContractTemplateForm from '$lib/components/contracts/ContractTemplateForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Edit Contract Template</h1>
		<p class="text-base-content/70 mt-1">Update your contract template settings and terms</p>
	</div>

	<ContractTemplateForm {agencySlug} template={data.template} />
</div>

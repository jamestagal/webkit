<script lang="ts">
	import ContractTemplateForm from '$lib/components/contracts/ContractTemplateForm.svelte';
	import { FileText, ListChecks } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
</script>

<div class="space-y-6">
	<div>
		<div class="flex items-center gap-2 text-sm text-base-content/60 mb-1">
			<a href="/{agencySlug}/settings/contracts" class="hover:text-primary">
				Contract Templates
			</a>
			<span>/</span>
			<span>{data.template.name}</span>
		</div>
		<h1 class="text-2xl font-bold">Edit Contract Template</h1>
		<p class="text-base-content/70 mt-1">Update your contract template settings and terms</p>
	</div>

	<!-- Tab Navigation -->
	<div class="tabs tabs-boxed bg-base-200 w-fit">
		<a
			href="/{agencySlug}/settings/contracts/{data.template.id}"
			class="tab tab-active"
		>
			<FileText class="h-4 w-4 mr-2" />
			Template Settings
		</a>
		<a
			href="/{agencySlug}/settings/contracts/{data.template.id}/schedules"
			class="tab"
		>
			<ListChecks class="h-4 w-4 mr-2" />
			Schedule Sections
		</a>
	</div>

	<ContractTemplateForm {agencySlug} template={data.template} />
</div>

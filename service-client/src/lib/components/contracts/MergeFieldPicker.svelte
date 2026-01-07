<script lang="ts">
	import { Code, ChevronDown } from 'lucide-svelte';

	let { onInsert }: { onInsert: (field: string) => void } = $props();

	let isOpen = $state(false);

	// Available merge fields grouped by category
	const mergeFieldGroups = [
		{
			label: 'Agency',
			fields: [
				{ field: 'agency.business_name', label: 'Business Name' },
				{ field: 'agency.trading_name', label: 'Trading Name' },
				{ field: 'agency.abn', label: 'ABN' },
				{ field: 'agency.acn', label: 'ACN' },
				{ field: 'agency.email', label: 'Email' },
				{ field: 'agency.phone', label: 'Phone' },
				{ field: 'agency.full_address', label: 'Full Address' },
				{ field: 'agency.website', label: 'Website' }
			]
		},
		{
			label: 'Client',
			fields: [
				{ field: 'client.business_name', label: 'Business Name' },
				{ field: 'client.contact_person', label: 'Contact Person' },
				{ field: 'client.email', label: 'Email' },
				{ field: 'client.phone', label: 'Phone' },
				{ field: 'client.industry', label: 'Industry' }
			]
		},
		{
			label: 'Contract',
			fields: [
				{ field: 'contract.number', label: 'Contract Number' },
				{ field: 'contract.date', label: 'Contract Date' },
				{ field: 'contract.valid_until', label: 'Valid Until' },
				{ field: 'contract.total_price', label: 'Total Price' },
				{ field: 'contract.payment_terms', label: 'Payment Terms' },
				{ field: 'contract.commencement_date', label: 'Commencement Date' },
				{ field: 'contract.completion_date', label: 'Completion Date' },
				{ field: 'contract.services_description', label: 'Services Description' },
				{ field: 'contract.special_conditions', label: 'Special Conditions' }
			]
		},
		{
			label: 'Proposal',
			fields: [
				{ field: 'proposal.number', label: 'Proposal Number' },
				{ field: 'proposal.package_name', label: 'Package Name' },
				{ field: 'proposal.setup_fee', label: 'Setup Fee' },
				{ field: 'proposal.monthly_price', label: 'Monthly Price' },
				{ field: 'proposal.total', label: 'Total' }
			]
		},
		{
			label: 'Computed',
			fields: [
				{ field: 'computed.current_date', label: 'Current Date' },
				{ field: 'computed.current_year', label: 'Current Year' }
			]
		}
	];

	function handleSelect(field: string) {
		onInsert(field);
		isOpen = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="dropdown dropdown-end"
	onclick={(e) => e.stopPropagation()}
>
	<button
		type="button"
		class="btn btn-sm btn-ghost gap-2"
		onclick={() => (isOpen = !isOpen)}
	>
		<Code class="h-4 w-4" />
		Insert Field
		<ChevronDown class="h-3 w-3" />
	</button>

	{#if isOpen}
		<div
			class="dropdown-content z-10 menu bg-base-100 rounded-box w-72 shadow-lg border border-base-300 mt-1 max-h-80 overflow-y-auto"
		>
			{#each mergeFieldGroups as group}
				<li class="menu-title">
					<span class="text-xs uppercase tracking-wider">{group.label}</span>
				</li>
				{#each group.fields as item}
					<li>
						<button
							type="button"
							class="flex justify-between items-center"
							onclick={() => handleSelect(item.field)}
						>
							<span class="text-sm">{item.label}</span>
							<code class="text-xs bg-base-200 px-1 rounded">
								{`{{${item.field}}}`}
							</code>
						</button>
					</li>
				{/each}
			{/each}
		</div>
	{/if}
</div>

<svelte:window onclick={() => { isOpen = false; }} />

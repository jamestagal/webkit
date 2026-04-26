<script lang="ts">
	import { Code, ChevronDown, Search } from 'lucide-svelte';

	let { onInsert }: { onInsert: (field: string) => void } = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');

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

	// Filter groups based on search query
	let filteredGroups = $derived(
		searchQuery.trim()
			? mergeFieldGroups
					.map((group) => ({
						...group,
						fields: group.fields.filter(
							(item) =>
								item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
								item.field.toLowerCase().includes(searchQuery.toLowerCase())
						)
					}))
					.filter((group) => group.fields.length > 0)
			: mergeFieldGroups
	);

	function handleSelect(field: string) {
		onInsert(field);
		isOpen = false;
		searchQuery = '';
	}

	function handleToggle() {
		isOpen = !isOpen;
		if (!isOpen) {
			searchQuery = '';
		}
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
		onclick={handleToggle}
	>
		<Code class="h-4 w-4" />
		Insert Field
		<ChevronDown class="h-3 w-3 transition-transform {isOpen ? 'rotate-180' : ''}" />
	</button>

	{#if isOpen}
		<div
			class="dropdown-content z-50 bg-base-100 rounded-lg w-96 shadow-xl border border-base-300 mt-1"
		>
			<!-- Search Input -->
			<div class="p-3 border-b border-base-300">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search fields..."
						class="input input-sm input-bordered w-full pl-9"
						onclick={(e) => e.stopPropagation()}
					/>
				</div>
			</div>

			<!-- Scrollable Field List -->
			<div class="max-h-96 overflow-y-auto p-2">
				{#each filteredGroups as group}
					<div class="mb-3 last:mb-0">
						<div class="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-base-content/50 bg-base-200/50 rounded">
							{group.label}
						</div>
						<ul class="mt-1 space-y-0.5">
							{#each group.fields as item}
								<li>
									<button
										type="button"
										class="w-full flex justify-between items-center px-3 py-2 rounded-md hover:bg-base-200 transition-colors text-left"
										onclick={() => handleSelect(item.field)}
									>
										<span class="text-sm font-medium">{item.label}</span>
										<code class="text-xs bg-base-300/50 text-base-content/70 px-2 py-0.5 rounded font-mono">
											{`{{${item.field}}}`}
										</code>
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
				{#if filteredGroups.length === 0}
					<div class="px-3 py-6 text-center text-sm text-base-content/50">
						No fields match "{searchQuery}"
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<svelte:window onclick={() => { isOpen = false; searchQuery = ''; }} />

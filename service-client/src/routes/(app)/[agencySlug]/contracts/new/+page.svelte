<script lang="ts">
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { createContractFromProposal } from '$lib/api/contracts.remote';
	import { FileText, ArrowLeft, ArrowRight, CheckCircle, Star, UserCircle } from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);

	// Pre-fill from clientId URL param (Quick Create from Client Hub)
	const prefillClientId = data.prefillClientId;
	const prefillClientName = data.prefillClientName;

	// Sort proposals: those matching prefillClientId first
	const sortedProposals = prefillClientId
		? [...data.proposals].sort((a, b) => {
				const aMatch = a.clientId === prefillClientId ? 0 : 1;
				const bMatch = b.clientId === prefillClientId ? 0 : 1;
				return aMatch - bMatch;
			})
		: data.proposals;

	// Form state
	let selectedProposalId = $state<string | null>(null);
	let selectedTemplateId = $state<string | null>(null);
	let isSubmitting = $state(false);

	// Set default template if exists
	$effect(() => {
		const defaultTemplate = data.templates.find((t) => t.isDefault);
		if (defaultTemplate && !selectedTemplateId) {
			selectedTemplateId = defaultTemplate.id;
		}
	});

	let selectedProposal = $derived(
		sortedProposals.find((p) => p.id === selectedProposalId) || null
	);

	async function handleSubmit() {
		if (!selectedProposalId) {
			toast.error('Please select a proposal');
			return;
		}

		isSubmitting = true;

		try {
			const contract = await createContractFromProposal({
				proposalId: selectedProposalId,
				templateId: selectedTemplateId || undefined
			});

			toast.success('Contract created');

			if (contract) {
				goto(`/${agencySlug}/contracts/${contract.id}`);
			} else {
				goto(`/${agencySlug}/contracts`);
			}
		} catch (err) {
			toast.error('Failed to create contract', err instanceof Error ? err.message : '');
		} finally {
			isSubmitting = false;
		}
	}

	function formatCurrency(value: string | number) {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD'
		}).format(num);
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold">Generate Contract</h1>
		<p class="text-base-content/70 mt-1">
			Create a new contract from an accepted proposal
		</p>
	</div>

	<!-- Client Context Banner (from Quick Create) -->
	{#if prefillClientName}
		<div class="alert bg-primary/10 border-primary/20">
			<UserCircle class="h-5 w-5 text-primary" />
			<span>Creating contract for <strong>{prefillClientName}</strong></span>
		</div>
	{/if}

	{#if sortedProposals.length === 0}
		<!-- No accepted proposals -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning mb-4"
				>
					<FileText class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No accepted proposals</h3>
				<p class="text-base-content/60 max-w-sm">
					You need an accepted proposal to generate a contract. Once a client accepts a proposal, you can create a contract from it.
				</p>
				<a href="/{agencySlug}/proposals" class="btn btn-primary mt-4">
					View Proposals
				</a>
			</div>
		</div>
	{:else if data.templates.length === 0}
		<!-- No contract templates -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning mb-4"
				>
					<FileText class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No contract templates</h3>
				<p class="text-base-content/60 max-w-sm">
					You need to create a contract template before generating contracts. Templates define your terms and conditions.
				</p>
				<a href="/{agencySlug}/settings/contracts/new" class="btn btn-primary mt-4">
					Create Template
				</a>
			</div>
		</div>
	{:else}
		<!-- Step 1: Select Proposal -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-lg">Step 1: Select Proposal</h2>
				<p class="text-sm text-base-content/60">
					Choose the accepted proposal to generate a contract from
				</p>

				<div class="grid gap-3 mt-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each sortedProposals as proposal (proposal.id)}
						<button
							type="button"
							class="card border transition-all text-left
								{selectedProposalId === proposal.id
								? 'border-primary bg-primary/5 ring-2 ring-primary'
								: 'border-base-300 hover:border-base-400'}"
							onclick={() => (selectedProposalId = proposal.id)}
						>
							<div class="card-body p-4">
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<span class="font-semibold">{proposal.proposalNumber}</span>
										<p class="text-sm text-base-content/70 mt-1 truncate">
											{proposal.clientBusinessName || 'No client'}
										</p>
									</div>
									{#if selectedProposalId === proposal.id}
										<CheckCircle class="h-5 w-5 text-primary flex-shrink-0" />
									{/if}
								</div>
								<div class="flex items-center gap-4 text-xs text-base-content/60 mt-2">
									<span>Accepted {formatDate(proposal.acceptedAt)}</span>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Step 2: Select Template -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-lg">Step 2: Select Template</h2>
				<p class="text-sm text-base-content/60">
					Choose the contract template to use for this contract
				</p>

				<div class="grid gap-3 mt-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.templates as template (template.id)}
						<button
							type="button"
							class="card border transition-all text-left
								{selectedTemplateId === template.id
								? 'border-primary bg-primary/5 ring-2 ring-primary'
								: 'border-base-300 hover:border-base-400'}"
							onclick={() => (selectedTemplateId = template.id)}
						>
							<div class="card-body p-4">
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-semibold">{template.name}</span>
											{#if template.isDefault}
												<span class="badge badge-primary badge-sm">
													<Star class="h-3 w-3 mr-1" />
													Default
												</span>
											{/if}
										</div>
										<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
											{template.description || 'No description'}
										</p>
									</div>
									{#if selectedTemplateId === template.id}
										<CheckCircle class="h-5 w-5 text-primary flex-shrink-0" />
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Summary & Actions -->
		{#if selectedProposal}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Summary</h2>

					<div class="grid gap-4 sm:grid-cols-2 mt-2">
						<div>
							<span class="text-sm text-base-content/60">Proposal</span>
							<p class="font-medium">{selectedProposal.proposalNumber}</p>
						</div>
						<div>
							<span class="text-sm text-base-content/60">Client</span>
							<p class="font-medium">
								{selectedProposal.clientBusinessName || 'No client'}
							</p>
						</div>
						<div>
							<span class="text-sm text-base-content/60">Contact</span>
							<p class="font-medium">
								{selectedProposal.clientContactName || '-'}
							</p>
						</div>
						<div>
							<span class="text-sm text-base-content/60">Template</span>
							<p class="font-medium">
								{data.templates.find((t) => t.id === selectedTemplateId)?.name || 'Default'}
							</p>
						</div>
					</div>

					<div class="alert alert-info mt-4">
						<div>
							<p class="text-sm">
								A contract will be generated with data auto-populated from the proposal. You can edit the contract details before sending it to the client.
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex justify-between items-center">
			<a href="/{agencySlug}/contracts" class="btn btn-ghost">
				<ArrowLeft class="h-4 w-4" />
				Cancel
			</a>

			<button
				type="button"
				class="btn btn-primary"
				disabled={!selectedProposalId || isSubmitting}
				onclick={handleSubmit}
			>
				{#if isSubmitting}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<ArrowRight class="h-4 w-4" />
				{/if}
				Generate Contract
			</button>
		</div>
	{/if}
</div>

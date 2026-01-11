<script lang="ts">
	/**
	 * Proposals List Page
	 *
	 * Displays all proposals for the agency with status filtering,
	 * search, and quick actions (view, edit, duplicate, delete).
	 */

	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { getProposals, deleteProposal, duplicateProposal } from '$lib/api/proposals.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { FEATURES } from '$lib/config/features';
	import { Plus, Eye, Pencil, Copy, Trash2, Send, ExternalLink } from 'lucide-svelte';
	import type { ProposalStatus } from '$lib/server/schema';

	const feature = FEATURES.proposals;

	const toast = getToast();
	const agencySlug = page.params.agencySlug;

	// State
	let statusFilter = $state<ProposalStatus | 'all'>('all');
	let isLoading = $state(false);

	// Load all proposals (client-side filtering handles status filter)
	const proposals = await getProposals({});

	// Derived: filtered proposals (client-side filter for quick switching)
	let filteredProposals = $derived(
		statusFilter === 'all'
			? proposals
			: proposals.filter((p) => p.status === statusFilter)
	);

	// Derived: status counts for filter tabs
	let statusCounts = $derived({
		all: proposals.length,
		draft: proposals.filter((p) => p.status === 'draft').length,
		ready: proposals.filter((p) => p.status === 'ready').length,
		sent: proposals.filter((p) => p.status === 'sent').length,
		viewed: proposals.filter((p) => p.status === 'viewed').length,
		accepted: proposals.filter((p) => p.status === 'accepted').length,
		revision_requested: proposals.filter((p) => p.status === 'revision_requested').length
	});

	function formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		const d = new Date(date);
		return d.toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function getStatusBadge(status: string): { class: string; label: string } {
		switch (status) {
			case 'draft':
				return { class: 'badge-ghost', label: 'Draft' };
			case 'ready':
				return { class: 'badge-warning', label: 'Ready' };
			case 'sent':
				return { class: 'badge-info', label: 'Sent' };
			case 'viewed':
				return { class: 'badge-primary', label: 'Viewed' };
			case 'accepted':
				return { class: 'badge-success', label: 'Accepted' };
			case 'declined':
				return { class: 'badge-error', label: 'Declined' };
			case 'revision_requested':
				return { class: 'badge-warning badge-outline', label: 'Revision Requested' };
			case 'expired':
				return { class: 'badge-neutral', label: 'Expired' };
			default:
				return { class: 'badge-ghost', label: status };
		}
	}

	function createProposal() {
		goto(`/${agencySlug}/proposals/new`);
	}

	function editProposal(id: string) {
		goto(`/${agencySlug}/proposals/${id}`);
	}

	function viewPublicProposal(slug: string) {
		window.open(`/p/${slug}`, '_blank');
	}

	async function handleDuplicate(id: string) {
		isLoading = true;
		try {
			const newProposal = await duplicateProposal(id);
			toast.success('Proposal duplicated');
			if (newProposal) {
				goto(`/${agencySlug}/proposals/${newProposal.id}`);
			}
		} catch (err) {
			toast.error('Failed to duplicate', err instanceof Error ? err.message : 'Unknown error');
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete(id: string, title: string) {
		if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
			return;
		}

		isLoading = true;
		try {
			await deleteProposal(id);
			toast.success('Proposal deleted');
			await invalidateAll();
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : 'Unknown error');
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Proposals | Webkit</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
				style="background-color: {feature.colorLight}; color: {feature.color}"
			>
				<feature.icon class="h-6 w-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">{feature.title}</h1>
				<p class="text-base-content/70 mt-1">{feature.description}</p>
			</div>
		</div>
		<button type="button" class="btn btn-primary" onclick={createProposal}>
			<Plus class="h-4 w-4" />
			New Proposal
		</button>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'all')}
		>
			All ({statusCounts.all})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'draft' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'draft')}
		>
			Drafts ({statusCounts.draft})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'ready' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'ready')}
		>
			Ready ({statusCounts.ready})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'sent' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'sent')}
		>
			Sent ({statusCounts.sent})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'viewed' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'viewed')}
		>
			Viewed ({statusCounts.viewed})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'accepted' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'accepted')}
		>
			Accepted ({statusCounts.accepted})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'revision_requested' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'revision_requested')}
		>
			Revisions ({statusCounts.revision_requested})
		</button>
	</div>

	<!-- Proposals List -->
	{#if filteredProposals.length === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body items-center py-16 text-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full"
					style="background-color: {feature.colorLight}; color: {feature.color}"
				>
					<feature.icon class="h-8 w-8" />
				</div>
				<h3 class="mt-4 text-lg font-semibold">No proposals yet</h3>
				<p class="text-base-content/60 mt-1">
					{statusFilter === 'all'
						? 'Create your first proposal to get started.'
						: `No ${statusFilter} proposals found.`}
				</p>
				{#if statusFilter === 'all'}
					<button type="button" class="btn btn-primary mt-4" onclick={createProposal}>
						<Plus class="h-4 w-4" />
						Create Proposal
					</button>
				{/if}
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			{#each filteredProposals as proposal}
				{@const statusBadge = getStatusBadge(proposal.status)}
				<div class="card bg-base-100 shadow transition-shadow hover:shadow-md">
					<div class="card-body">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<!-- Info -->
							<div class="flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="text-lg font-semibold">{proposal.title}</h3>
									<span class="badge {statusBadge.class}">{statusBadge.label}</span>
									{#if proposal.viewCount && proposal.viewCount > 0}
										<span class="badge badge-ghost gap-1">
											<Eye class="h-3 w-3" />
											{proposal.viewCount}
										</span>
									{/if}
								</div>

								<p class="text-base-content/70 mt-1">
									{proposal.proposalNumber} &bull;
									{proposal.clientBusinessName || 'No client'}
								</p>

								<div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-base-content/60">
									<span>
										<strong>Created:</strong>
										{formatDate(proposal.createdAt)}
									</span>
									{#if proposal.sentAt}
										<span>
											<strong>Sent:</strong>
											{formatDate(proposal.sentAt)}
										</span>
									{/if}
									{#if proposal.validUntil}
										<span>
											<strong>Valid until:</strong>
											{formatDate(proposal.validUntil)}
										</span>
									{/if}
								</div>
							</div>

							<!-- Actions -->
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => editProposal(proposal.id)}
									title="Edit proposal"
								>
									<Pencil class="h-4 w-4" />
								</button>

								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => viewPublicProposal(proposal.slug)}
									title="Preview proposal"
								>
									<ExternalLink class="h-4 w-4" />
								</button>

								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => handleDuplicate(proposal.id)}
									disabled={isLoading}
									title="Duplicate proposal"
								>
									<Copy class="h-4 w-4" />
								</button>

								<button
									type="button"
									class="btn btn-ghost btn-sm text-error"
									onclick={() => handleDelete(proposal.id, proposal.title)}
									disabled={isLoading}
									title="Delete proposal"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

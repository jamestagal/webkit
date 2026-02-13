<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { deleteQuotation, duplicateQuotation, sendQuotation } from '$lib/api/quotations.remote';
	import { FEATURES } from '$lib/config/features';
	import SendEmailModal from '$lib/components/shared/SendEmailModal.svelte';
	import {
		Plus,
		MoreVertical,
		Send,
		Eye,
		Trash2,
		Copy,
		ExternalLink,
		CheckCircle,
		Clock,
		AlertCircle,
		FileText,
		XCircle
	} from 'lucide-svelte';
	import { formatCurrency, formatDate } from '$lib/utils/formatting';
	import type { PageProps } from './$types';

	const feature = FEATURES.quotations;
	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);

	// Filter state
	let statusFilter = $state<string | null>(null);

	// Send email modal state
	let sendModalOpen = $state(false);
	let sendingEmail = $state(false);
	let selectedQuotation = $state<{
		id: string;
		slug: string;
		clientEmail: string;
		clientBusinessName: string;
	} | null>(null);

	// Confirm modal state
	let confirmModal = $state<{
		title: string;
		message: string;
		actionLabel: string;
		actionClass: string;
		onConfirm: () => Promise<void>;
	} | null>(null);
	let isConfirming = $state(false);

	async function handleConfirm() {
		if (!confirmModal) return;
		isConfirming = true;
		try {
			await confirmModal.onConfirm();
			confirmModal = null;
		} finally {
			isConfirming = false;
		}
	}

	// Filtered quotations
	let filteredQuotations = $derived(() => {
		if (!statusFilter) return data.quotations;
		if (statusFilter === 'awaiting') {
			return data.quotations.filter((q) => ['sent', 'viewed'].includes(q.effectiveStatus));
		}
		return data.quotations.filter((q) => q.effectiveStatus === statusFilter);
	});

	// Status counts
	let statusCounts = $derived({
		draft: data.quotations.filter((q) => q.effectiveStatus === 'draft').length,
		awaiting: data.quotations.filter((q) => ['sent', 'viewed'].includes(q.effectiveStatus))
			.length,
		accepted: data.quotations.filter((q) => q.effectiveStatus === 'accepted').length,
		expired: data.quotations.filter((q) => q.effectiveStatus === 'expired').length
	});

	function openSendModal(quotation: {
		id: string;
		slug: string;
		clientEmail: string;
		clientBusinessName: string;
	}) {
		selectedQuotation = quotation;
		sendModalOpen = true;
	}

	async function confirmSendEmail() {
		if (!selectedQuotation) return;
		sendingEmail = true;

		try {
			await sendQuotation(selectedQuotation.id);
			await invalidateAll();
			sendModalOpen = false;
			toast.success('Quotation sent', `Status updated to sent`);
		} catch (err) {
			toast.error('Failed to send', err instanceof Error ? err.message : '');
		} finally {
			sendingEmail = false;
		}
	}

	function handleDelete(quotationId: string) {
		confirmModal = {
			title: 'Delete Quotation',
			message:
				'Are you sure you want to delete this quotation? This action cannot be undone.',
			actionLabel: 'Delete',
			actionClass: 'btn-error',
			onConfirm: async () => {
				await deleteQuotation(quotationId);
				await invalidateAll();
				toast.success('Quotation deleted');
			}
		};
	}

	async function handleDuplicate(quotationId: string) {
		try {
			await duplicateQuotation(quotationId);
			await invalidateAll();
			toast.success('Quotation duplicated');
		} catch (err) {
			toast.error('Failed to duplicate', err instanceof Error ? err.message : '');
		}
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'draft':
				return { class: 'badge-ghost', icon: Clock, label: 'Draft' };
			case 'sent':
				return { class: 'badge-info', icon: Send, label: 'Sent' };
			case 'viewed':
				return { class: 'badge-warning', icon: Eye, label: 'Viewed' };
			case 'accepted':
				return { class: 'badge-success', icon: CheckCircle, label: 'Accepted' };
			case 'declined':
				return { class: 'badge-error', icon: XCircle, label: 'Declined' };
			case 'expired':
				return { class: 'badge-neutral', icon: AlertCircle, label: 'Expired' };
			default:
				return { class: 'badge-ghost', icon: Clock, label: status };
		}
	}

	function copyPublicUrl(slug: string) {
		const url = `${window.location.origin}/q/${slug}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
		<a href="/{agencySlug}/quotations/new" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			New Quotation
		</a>
	</div>

	<!-- Stats Cards -->
	{#if data.stats}
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="stat bg-base-100 rounded-lg border border-base-300 p-4">
				<div class="stat-title text-xs">Draft</div>
				<div class="stat-value text-lg">{data.stats.draftCount}</div>
				<div class="stat-desc text-xs">{formatCurrency(data.stats.draftTotal)}</div>
			</div>
			<div class="stat bg-base-100 rounded-lg border border-base-300 p-4">
				<div class="stat-title text-xs">Awaiting Response</div>
				<div class="stat-value text-lg text-warning">{data.stats.awaitingCount}</div>
				<div class="stat-desc text-xs">{formatCurrency(data.stats.awaitingTotal)}</div>
			</div>
			<div class="stat bg-base-100 rounded-lg border border-base-300 p-4">
				<div class="stat-title text-xs">Accepted</div>
				<div class="stat-value text-lg text-success">{data.stats.acceptedCount}</div>
				<div class="stat-desc text-xs">{formatCurrency(data.stats.acceptedTotal)}</div>
			</div>
			<div class="stat bg-base-100 rounded-lg border border-base-300 p-4">
				<div class="stat-title text-xs">Expired</div>
				<div class="stat-value text-lg text-error">{data.stats.expiredCount}</div>
				<div class="stat-desc text-xs">{formatCurrency(data.stats.expiredTotal)}</div>
			</div>
		</div>
	{/if}

	<!-- Status Filters -->
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="btn btn-sm {!statusFilter ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = null)}
		>
			All ({data.quotations.length})
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
			class="btn btn-sm {statusFilter === 'awaiting' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'awaiting')}
		>
			Awaiting ({statusCounts.awaiting})
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
			class="btn btn-sm {statusFilter === 'expired' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'expired')}
		>
			Expired ({statusCounts.expired})
		</button>
	</div>

	{#if data.quotations.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
					style="background-color: {feature.colorLight}; color: {feature.color}"
				>
					<feature.icon class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No quotations yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create your first quotation to start quoting clients for your services.
				</p>
				<a href="/{agencySlug}/quotations/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create Quotation
				</a>
			</div>
		</div>
	{:else if filteredQuotations().length === 0}
		<!-- No matches -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-8">
				<p class="text-base-content/60">No quotations match the selected filter</p>
				<button
					type="button"
					class="btn btn-ghost btn-sm mt-2"
					onclick={() => (statusFilter = null)}
				>
					Clear filter
				</button>
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each filteredQuotations() as quotation (quotation.id)}
				{@const statusInfo = getStatusBadge(quotation.effectiveStatus)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<a
									href="/{agencySlug}/quotations/{quotation.id}"
									class="font-semibold text-primary hover:underline"
								>
									{quotation.quotationNumber}
								</a>
								<p class="text-sm font-medium truncate">
									{quotation.clientBusinessName}
								</p>
								{#if quotation.siteAddress}
									<p class="text-xs text-base-content/60 truncate">
										{quotation.siteAddress}
									</p>
								{/if}
							</div>
							<span class="badge {statusInfo.class} badge-sm">
								{statusInfo.label}
							</span>
						</div>
						<div class="flex items-center justify-between mt-2 pt-2 border-t border-base-200">
							<span class="font-semibold">{formatCurrency(parseFloat(quotation.total))}</span>
							<span class="text-xs text-base-content/60">
								{formatDate(quotation.createdAt)}
							</span>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>#</th>
						<th>Client</th>
						<th>Site</th>
						<th>Total</th>
						<th>Status</th>
						<th>Created</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredQuotations() as quotation (quotation.id)}
						{@const statusInfo = getStatusBadge(quotation.effectiveStatus)}
						<tr class="hover">
							<td>
								<a
									href="/{agencySlug}/quotations/{quotation.id}"
									class="font-medium text-primary hover:underline"
								>
									{quotation.quotationNumber}
								</a>
								{#if quotation.quotationName}
									<div class="text-xs text-base-content/60">{quotation.quotationName}</div>
								{/if}
							</td>
							<td>
								<div class="font-medium">{quotation.clientBusinessName}</div>
								<div class="text-sm text-base-content/60">{quotation.clientEmail}</div>
							</td>
							<td>
								{#if quotation.siteAddress}
									<span class="text-sm">{quotation.siteAddress}</span>
								{:else}
									<span class="text-base-content/40">—</span>
								{/if}
							</td>
							<td class="font-semibold">{formatCurrency(parseFloat(quotation.total))}</td>
							<td>
								<span class="badge {statusInfo.class} badge-sm gap-1">
									<svelte:component this={statusInfo.icon} class="h-3 w-3" />
									{statusInfo.label}
								</span>
							</td>
							<td class="text-sm text-base-content/70">
								{formatDate(quotation.createdAt)}
							</td>
							<td class="text-right">
								<div class="dropdown dropdown-end">
									<button
										type="button"
										tabindex="0"
										class="btn btn-ghost btn-sm btn-square"
									>
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul
										class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300"
									>
										<li>
											<a href="/{agencySlug}/quotations/{quotation.id}">
												<FileText class="h-4 w-4" />
												{quotation.effectiveStatus === 'draft' ? 'Edit' : 'View'}
											</a>
										</li>
										{#if quotation.effectiveStatus === 'draft'}
											<li>
												<button
													type="button"
													onclick={() =>
														openSendModal({
															id: quotation.id,
															slug: quotation.slug,
															clientEmail: quotation.clientEmail,
															clientBusinessName: quotation.clientBusinessName
														})}
												>
													<Send class="h-4 w-4" />
													Send
												</button>
											</li>
										{/if}
										{#if ['sent', 'viewed'].includes(quotation.effectiveStatus)}
											<li>
												<button
													type="button"
													onclick={() =>
														openSendModal({
															id: quotation.id,
															slug: quotation.slug,
															clientEmail: quotation.clientEmail,
															clientBusinessName: quotation.clientBusinessName
														})}
												>
													<Send class="h-4 w-4" />
													Resend
												</button>
											</li>
											<li>
												<button
													type="button"
													onclick={() => copyPublicUrl(quotation.slug)}
												>
													<ExternalLink class="h-4 w-4" />
													Copy Link
												</button>
											</li>
										{/if}
										<li>
											<button
												type="button"
												onclick={() => handleDuplicate(quotation.id)}
											>
												<Copy class="h-4 w-4" />
												Duplicate
											</button>
										</li>
										{#if quotation.effectiveStatus === 'draft'}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button
													type="button"
													class="text-error"
													onclick={() => handleDelete(quotation.id)}
												>
													<Trash2 class="h-4 w-4" />
													Delete
												</button>
											</li>
										{/if}
									</ul>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Send Email Modal -->
<SendEmailModal
	open={sendModalOpen}
	title="Send Quotation"
	documentType="quotation"
	recipientEmail={selectedQuotation?.clientEmail || ''}
	recipientName={selectedQuotation?.clientBusinessName}
	loading={sendingEmail}
	onConfirm={confirmSendEmail}
	onCancel={() => (sendModalOpen = false)}
/>

<!-- Confirm Modal -->
{#if confirmModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">{confirmModal.title}</h3>
			<p class="py-4">{confirmModal.message}</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (confirmModal = null)}
					disabled={isConfirming}
				>
					Cancel
				</button>
				<button
					class="btn {confirmModal.actionClass}"
					onclick={handleConfirm}
					disabled={isConfirming}
				>
					{#if isConfirming}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					{confirmModal.actionLabel}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (confirmModal = null)}></div>
	</div>
{/if}

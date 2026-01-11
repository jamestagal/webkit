<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { deleteContract, updateContractStatus } from '$lib/api/contracts.remote';
	import { sendContractEmail } from '$lib/api/email.remote';
	import { FEATURES } from '$lib/config/features';
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
		RefreshCw
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const feature = FEATURES.contracts;
	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);

	// Filter state
	let statusFilter = $state<string | null>(null);

	// Filtered contracts
	let filteredContracts = $derived(() => {
		if (!statusFilter) return data.contracts;
		return data.contracts.filter((c) => c.status === statusFilter);
	});

	// Status counts
	let statusCounts = $derived({
		draft: data.contracts.filter((c) => c.status === 'draft').length,
		sent: data.contracts.filter((c) => c.status === 'sent' || c.status === 'viewed').length,
		signed: data.contracts.filter((c) => c.status === 'signed' || c.status === 'completed')
			.length
	});

	async function handleSend(contractId: string, clientEmail: string) {
		if (!confirm(`Send this contract to ${clientEmail}?`)) return;

		try {
			const result = await sendContractEmail({ contractId });
			await invalidateAll();
			if (result.success) {
				toast.success('Contract sent', `Email delivered to ${clientEmail}`);
			} else {
				toast.error('Failed to send contract', result.error || 'Unknown error');
			}
		} catch (err) {
			toast.error('Failed to send contract', err instanceof Error ? err.message : '');
		}
	}

	async function handleResend(contractId: string, clientEmail: string) {
		if (!confirm(`Resend this contract to ${clientEmail}?`)) return;

		try {
			const result = await sendContractEmail({ contractId });
			await invalidateAll();
			if (result.success) {
				toast.success('Contract resent', `Email delivered to ${clientEmail}`);
			} else {
				toast.error('Failed to resend contract', result.error || 'Unknown error');
			}
		} catch (err) {
			toast.error('Failed to resend contract', err instanceof Error ? err.message : '');
		}
	}

	async function handleDelete(contractId: string) {
		if (!confirm('Are you sure you want to delete this contract?')) {
			return;
		}

		try {
			await deleteContract(contractId);
			await invalidateAll();
			toast.success('Contract deleted');
		} catch (err) {
			toast.error('Failed to delete contract', err instanceof Error ? err.message : '');
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
			case 'signed':
				return { class: 'badge-success', icon: CheckCircle, label: 'Signed' };
			case 'completed':
				return { class: 'badge-success', icon: CheckCircle, label: 'Completed' };
			case 'expired':
				return { class: 'badge-error', icon: AlertCircle, label: 'Expired' };
			case 'terminated':
				return { class: 'badge-error', icon: AlertCircle, label: 'Terminated' };
			default:
				return { class: 'badge-ghost', icon: Clock, label: status };
		}
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatCurrency(value: string | number) {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD'
		}).format(num);
	}

	function getPublicUrl(slug: string) {
		return `/c/${slug}`;
	}

	function copyPublicUrl(slug: string) {
		const url = `${window.location.origin}/c/${slug}`;
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
		<a href="/{agencySlug}/contracts/new" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			New Contract
		</a>
	</div>

	<!-- Status Filters -->
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="btn btn-sm {!statusFilter ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = null)}
		>
			All ({data.contracts.length})
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
			class="btn btn-sm {statusFilter === 'sent' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'sent')}
		>
			Sent ({statusCounts.sent})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'signed' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'signed')}
		>
			Signed ({statusCounts.signed})
		</button>
	</div>

	{#if data.contracts.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
					style="background-color: {feature.colorLight}; color: {feature.color}"
				>
					<feature.icon class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No contracts yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Generate your first contract from an accepted proposal to start sending agreements to clients.
				</p>
				<a href="/{agencySlug}/contracts/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create Contract
				</a>
			</div>
		</div>
	{:else if filteredContracts().length === 0}
		<!-- No matches -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-8">
				<p class="text-base-content/60">No contracts match the selected filter</p>
				<button type="button" class="btn btn-ghost btn-sm mt-2" onclick={() => (statusFilter = null)}>
					Clear filter
				</button>
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each filteredContracts() as contract (contract.id)}
				{@const statusInfo = getStatusBadge(contract.status)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-2">
							<a href="/{agencySlug}/contracts/{contract.id}" class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-medium">{contract.contractNumber}</span>
									<div class="badge {statusInfo.class} badge-sm gap-1">
										<statusInfo.icon class="h-3 w-3" />
										{statusInfo.label}
									</div>
								</div>
								<p class="text-sm text-base-content/70 mt-1 truncate">
									{contract.clientBusinessName || 'No client'}
								</p>
							</a>
							<div class="flex items-start gap-2">
								<div class="text-right shrink-0">
									<div class="font-semibold">{formatCurrency(contract.totalPrice)}</div>
									<div class="text-xs text-base-content/60">v{contract.version}</div>
								</div>
								<div class="dropdown dropdown-end">
									<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
										<li>
											<a href="/{agencySlug}/contracts/{contract.id}">
												<Eye class="h-4 w-4" />
												View / Edit
											</a>
										</li>
										{#if contract.status === 'draft'}
											<li>
												<button type="button" onclick={() => handleSend(contract.id, contract.clientEmail)}>
													<Send class="h-4 w-4" />
													Send to Client
												</button>
											</li>
										{/if}
										{#if ['sent', 'viewed'].includes(contract.status)}
											<li>
												<button type="button" onclick={() => handleResend(contract.id, contract.clientEmail)}>
													<RefreshCw class="h-4 w-4" />
													Resend Email
												</button>
											</li>
										{/if}
										{#if ['sent', 'viewed', 'signed', 'completed'].includes(contract.status)}
											<li>
												<a href={getPublicUrl(contract.slug)} target="_blank">
													<ExternalLink class="h-4 w-4" />
													View Public Page
												</a>
											</li>
											<li>
												<button type="button" onclick={() => copyPublicUrl(contract.slug)}>
													<Copy class="h-4 w-4" />
													Copy Link
												</button>
											</li>
										{/if}
										{#if !['signed', 'completed'].includes(contract.status)}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button type="button" class="text-error" onclick={() => handleDelete(contract.id)}>
													<Trash2 class="h-4 w-4" />
													Delete
												</button>
											</li>
										{/if}
									</ul>
								</div>
							</div>
						</div>
						<a href="/{agencySlug}/contracts/{contract.id}" class="block">
							<div class="flex items-center justify-between mt-2 pt-2 border-t border-base-200 text-sm text-base-content/60">
								<span>Created {formatDate(contract.createdAt)}</span>
								{#if contract.viewCount > 0}
									<span>{contract.viewCount} view{contract.viewCount > 1 ? 's' : ''}</span>
								{/if}
							</div>
						</a>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block overflow-visible">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Contract</th>
						<th>Client</th>
						<th>Value</th>
						<th>Status</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredContracts() as contract (contract.id)}
						{@const statusInfo = getStatusBadge(contract.status)}
						<tr class="hover">
							<td>
								<div class="flex flex-col">
									<span class="font-medium">{contract.contractNumber}</span>
									<span class="text-sm text-base-content/60">v{contract.version}</span>
								</div>
							</td>
							<td>
								<div class="flex flex-col">
									<span>{contract.clientBusinessName || 'No client'}</span>
									<span class="text-sm text-base-content/60">
										{contract.clientContactName || '-'}
									</span>
								</div>
							</td>
							<td>
								<span class="font-medium">
									{formatCurrency(contract.totalPrice)}
								</span>
							</td>
							<td>
								<div class="badge {statusInfo.class} gap-1">
									<statusInfo.icon class="h-3 w-3" />
									{statusInfo.label}
								</div>
								{#if contract.viewCount > 0}
									<div class="text-xs text-base-content/60 mt-1">
										{contract.viewCount} view{contract.viewCount > 1 ? 's' : ''}
									</div>
								{/if}
							</td>
							<td>
								<span class="text-sm">{formatDate(contract.createdAt)}</span>
							</td>
							<td>
								<div class="dropdown dropdown-end">
									<button
										type="button"
										tabindex="0"
										class="btn btn-ghost btn-sm btn-square"
									>
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul
										class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
									>
										<li>
											<a href="/{agencySlug}/contracts/{contract.id}">
												<Eye class="h-4 w-4" />
												View / Edit
											</a>
										</li>
										{#if contract.status === 'draft'}
											<li>
												<button
													type="button"
													onclick={() => handleSend(contract.id, contract.clientEmail)}
												>
													<Send class="h-4 w-4" />
													Send to Client
												</button>
											</li>
										{/if}
										{#if ['sent', 'viewed'].includes(contract.status)}
											<li>
												<button
													type="button"
													onclick={() => handleResend(contract.id, contract.clientEmail)}
												>
													<RefreshCw class="h-4 w-4" />
													Resend Email
												</button>
											</li>
										{/if}
										{#if ['sent', 'viewed', 'signed', 'completed'].includes(contract.status)}
											<li>
												<a href={getPublicUrl(contract.slug)} target="_blank">
													<ExternalLink class="h-4 w-4" />
													View Public Page
												</a>
											</li>
											<li>
												<button
													type="button"
													onclick={() => copyPublicUrl(contract.slug)}
												>
													<Copy class="h-4 w-4" />
													Copy Link
												</button>
											</li>
										{/if}
										{#if !['signed', 'completed'].includes(contract.status)}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button
													type="button"
													class="text-error"
													onclick={() => handleDelete(contract.id)}
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

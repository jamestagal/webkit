<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { resendEmail } from '$lib/api/email.remote';
	import {
		Mail,
		CheckCircle,
		Clock,
		AlertCircle,
		RefreshCw,
		Send,
		XCircle,
		FileText,
		Receipt,
		File,
		ExternalLink
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let resending = $state<string | null>(null);

	// Filter state
	let statusFilter = $state<string | null>(null);
	let typeFilter = $state<string | null>(null);

	// Filtered emails
	let filteredEmails = $derived(() => {
		let result = data.emailLogs;
		if (statusFilter) {
			result = result.filter((e) => e.status === statusFilter);
		}
		if (typeFilter) {
			result = result.filter((e) => e.emailType === typeFilter);
		}
		return result;
	});

	// Status counts
	let statusCounts = $derived({
		sent: data.emailLogs.filter((e) => e.status === 'sent').length,
		delivered: data.emailLogs.filter((e) => e.status === 'delivered').length,
		opened: data.emailLogs.filter((e) => e.status === 'opened').length,
		failed: data.emailLogs.filter((e) => ['failed', 'bounced'].includes(e.status)).length
	});

	async function handleResend(emailId: string) {
		resending = emailId;
		try {
			const result = await resendEmail({ emailLogId: emailId });
			if (result.success) {
				toast.success('Email resent successfully');
				await invalidateAll();
			} else {
				toast.error('Failed to resend email', result.error || '');
			}
		} catch (err) {
			toast.error('Failed to resend email', err instanceof Error ? err.message : '');
		} finally {
			resending = null;
		}
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'sent':
				return { class: 'badge-info', icon: Send, label: 'Sent' };
			case 'delivered':
				return { class: 'badge-success', icon: CheckCircle, label: 'Delivered' };
			case 'opened':
				return { class: 'badge-success', icon: CheckCircle, label: 'Opened' };
			case 'bounced':
				return { class: 'badge-error', icon: XCircle, label: 'Bounced' };
			case 'failed':
				return { class: 'badge-error', icon: AlertCircle, label: 'Failed' };
			default:
				return { class: 'badge-ghost', icon: Clock, label: 'Pending' };
		}
	}

	function getTypeInfo(emailType: string) {
		switch (emailType) {
			case 'proposal_sent':
				return { icon: FileText, label: 'Proposal', color: 'text-primary' };
			case 'invoice_sent':
				return { icon: Receipt, label: 'Invoice', color: 'text-warning' };
			case 'contract_sent':
				return { icon: File, label: 'Contract', color: 'text-info' };
			default:
				return { icon: Mail, label: emailType, color: 'text-base-content' };
		}
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getEntityLink(email: typeof data.emailLogs[0]) {
		if (email.proposalId) {
			return `/${agencySlug}/proposals/${email.proposalId}`;
		}
		if (email.invoiceId) {
			return `/${agencySlug}/invoices/${email.invoiceId}`;
		}
		if (email.contractId) {
			return `/${agencySlug}/contracts/${email.contractId}`;
		}
		return null;
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Email History</h1>
			<p class="text-base-content/70 mt-1">View all sent emails for proposals, invoices, and contracts</p>
		</div>
		<button type="button" class="btn btn-ghost btn-sm" onclick={() => invalidateAll()}>
			<RefreshCw class="h-4 w-4" />
			Refresh
		</button>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg bg-info/10">
						<Send class="h-5 w-5 text-info" />
					</div>
					<div>
						<p class="text-2xl font-bold">{statusCounts.sent}</p>
						<p class="text-xs text-base-content/60">Sent</p>
					</div>
				</div>
			</div>
		</div>
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg bg-success/10">
						<CheckCircle class="h-5 w-5 text-success" />
					</div>
					<div>
						<p class="text-2xl font-bold">{statusCounts.delivered}</p>
						<p class="text-xs text-base-content/60">Delivered</p>
					</div>
				</div>
			</div>
		</div>
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg bg-success/10">
						<Mail class="h-5 w-5 text-success" />
					</div>
					<div>
						<p class="text-2xl font-bold">{statusCounts.opened}</p>
						<p class="text-xs text-base-content/60">Opened</p>
					</div>
				</div>
			</div>
		</div>
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-4">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg bg-error/10">
						<AlertCircle class="h-5 w-5 text-error" />
					</div>
					<div>
						<p class="text-2xl font-bold">{statusCounts.failed}</p>
						<p class="text-xs text-base-content/60">Failed</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap gap-2">
		<div class="join">
			<button
				type="button"
				class="join-item btn btn-sm {statusFilter === null ? 'btn-active' : ''}"
				onclick={() => (statusFilter = null)}
			>
				All
			</button>
			<button
				type="button"
				class="join-item btn btn-sm {statusFilter === 'sent' ? 'btn-active' : ''}"
				onclick={() => (statusFilter = 'sent')}
			>
				Sent
			</button>
			<button
				type="button"
				class="join-item btn btn-sm {statusFilter === 'delivered' ? 'btn-active' : ''}"
				onclick={() => (statusFilter = 'delivered')}
			>
				Delivered
			</button>
			<button
				type="button"
				class="join-item btn btn-sm {statusFilter === 'failed' ? 'btn-active' : ''}"
				onclick={() => (statusFilter = 'failed')}
			>
				Failed
			</button>
		</div>

		<div class="join">
			<button
				type="button"
				class="join-item btn btn-sm {typeFilter === null ? 'btn-active' : ''}"
				onclick={() => (typeFilter = null)}
			>
				All Types
			</button>
			<button
				type="button"
				class="join-item btn btn-sm {typeFilter === 'proposal_sent' ? 'btn-active' : ''}"
				onclick={() => (typeFilter = 'proposal_sent')}
			>
				Proposals
			</button>
			<button
				type="button"
				class="join-item btn btn-sm {typeFilter === 'invoice_sent' ? 'btn-active' : ''}"
				onclick={() => (typeFilter = 'invoice_sent')}
			>
				Invoices
			</button>
			<button
				type="button"
				class="join-item btn btn-sm {typeFilter === 'contract_sent' ? 'btn-active' : ''}"
				onclick={() => (typeFilter = 'contract_sent')}
			>
				Contracts
			</button>
		</div>
	</div>

	<!-- Email List -->
	{#if filteredEmails().length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<Mail class="h-12 w-12 text-base-content/30 mb-4" />
				<h2 class="text-lg font-medium">No emails found</h2>
				<p class="text-base-content/60">
					{#if statusFilter || typeFilter}
						Try adjusting your filters
					{:else}
						Emails will appear here when you send proposals, invoices, or contracts
					{/if}
				</p>
			</div>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table bg-base-100">
				<thead>
					<tr>
						<th>Status</th>
						<th>Type</th>
						<th>Recipient</th>
						<th>Subject</th>
						<th>Sent</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredEmails() as email (email.id)}
						{@const status = getStatusBadge(email.status)}
						{@const typeInfo = getTypeInfo(email.emailType)}
						{@const entityLink = getEntityLink(email)}
						<tr class="hover">
							<td>
								<div class="badge {status.class} gap-1">
									<status.icon class="h-3 w-3" />
									{status.label}
								</div>
							</td>
							<td>
								<div class="flex items-center gap-2 {typeInfo.color}">
									<typeInfo.icon class="h-4 w-4" />
									{typeInfo.label}
								</div>
							</td>
							<td>
								<div class="flex flex-col">
									<span class="font-medium text-sm truncate max-w-[200px]">
										{email.recipientName || email.recipientEmail}
									</span>
									{#if email.recipientName}
										<span class="text-xs text-base-content/60 truncate max-w-[200px]">
											{email.recipientEmail}
										</span>
									{/if}
								</div>
							</td>
							<td>
								<span class="text-sm truncate max-w-[250px] block">{email.subject}</span>
								{#if email.errorMessage}
									<span class="text-xs text-error">{email.errorMessage}</span>
								{/if}
							</td>
							<td class="text-sm text-base-content/70">
								{formatDate(email.sentAt || email.createdAt)}
							</td>
							<td>
								<div class="flex items-center gap-1">
									{#if entityLink}
										<a href={entityLink} class="btn btn-ghost btn-xs" title="View document">
											<ExternalLink class="h-3 w-3" />
										</a>
									{/if}
									{#if email.status === 'failed' || email.status === 'bounced'}
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											onclick={() => handleResend(email.id)}
											disabled={resending === email.id}
											title="Retry"
										>
											{#if resending === email.id}
												<span class="loading loading-spinner loading-xs"></span>
											{:else}
												<RefreshCw class="h-3 w-3" />
											{/if}
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

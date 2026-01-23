<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { deleteInvoice, cancelInvoice } from '$lib/api/invoices.remote';
	import { sendInvoiceEmail, sendInvoiceReminder } from '$lib/api/email.remote';
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
		DollarSign,
		Download,
		XCircle,
		Banknote,
		Bell,
		RefreshCw
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const feature = FEATURES.invoices;
	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);

	// Filter state
	let statusFilter = $state<string | null>(null);

	// Send email modal state
	let sendModalOpen = $state(false);
	let sendingEmail = $state(false);
	let selectedInvoice = $state<{ id: string; clientEmail: string; clientBusinessName: string | null } | null>(null);
	let emailAction = $state<'send' | 'resend' | 'reminder'>('send');

	// Filtered invoices
	let filteredInvoices = $derived(() => {
		if (!statusFilter) return data.invoices;
		if (statusFilter === 'awaiting') {
			return data.invoices.filter((i) => ['sent', 'viewed', 'overdue'].includes(i.status));
		}
		return data.invoices.filter((i) => i.status === statusFilter);
	});

	// Status counts
	let statusCounts = $derived({
		draft: data.invoices.filter((i) => i.status === 'draft').length,
		awaiting: data.invoices.filter((i) => ['sent', 'viewed', 'overdue'].includes(i.status)).length,
		paid: data.invoices.filter((i) => i.status === 'paid').length
	});

	function openSendModal(invoice: { id: string; clientEmail: string; clientBusinessName: string | null }, action: 'send' | 'resend' | 'reminder') {
		selectedInvoice = invoice;
		emailAction = action;
		sendModalOpen = true;
	}

	async function confirmSendEmail() {
		if (!selectedInvoice) return;
		sendingEmail = true;

		try {
			let result;
			if (emailAction === 'reminder') {
				result = await sendInvoiceReminder({ invoiceId: selectedInvoice.id });
			} else {
				result = await sendInvoiceEmail({ invoiceId: selectedInvoice.id });
			}
			await invalidateAll();
			sendModalOpen = false;

			if (result.success) {
				const messages = {
					send: ['Invoice sent', `Email delivered to ${selectedInvoice.clientEmail}`],
					resend: ['Invoice resent', `Email delivered to ${selectedInvoice.clientEmail}`],
					reminder: ['Reminder sent', `Payment reminder delivered to ${selectedInvoice.clientEmail}`]
				};
				toast.success(messages[emailAction][0], messages[emailAction][1]);
			} else {
				toast.error(`Failed to ${emailAction === 'reminder' ? 'send reminder' : 'send invoice'}`, result.error || 'Unknown error');
			}
		} catch (err) {
			toast.error('Failed to send', err instanceof Error ? err.message : '');
		} finally {
			sendingEmail = false;
		}
	}

	async function handleDelete(invoiceId: string) {
		if (!confirm('Are you sure you want to delete this invoice?')) {
			return;
		}

		try {
			await deleteInvoice(invoiceId);
			await invalidateAll();
			toast.success('Invoice deleted');
		} catch (err) {
			toast.error('Failed to delete invoice', err instanceof Error ? err.message : '');
		}
	}

	async function handleCancel(invoiceId: string) {
		if (!confirm('Are you sure you want to cancel this invoice?')) {
			return;
		}

		try {
			await cancelInvoice({ invoiceId });
			await invalidateAll();
			toast.success('Invoice cancelled');
		} catch (err) {
			toast.error('Failed to cancel invoice', err instanceof Error ? err.message : '');
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
			case 'paid':
				return { class: 'badge-success', icon: CheckCircle, label: 'Paid' };
			case 'overdue':
				return { class: 'badge-error', icon: AlertCircle, label: 'Overdue' };
			case 'cancelled':
				return { class: 'badge-neutral', icon: XCircle, label: 'Cancelled' };
			case 'refunded':
				return { class: 'badge-neutral', icon: Banknote, label: 'Refunded' };
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
		return `/i/${slug}`;
	}

	function copyPublicUrl(slug: string) {
		const url = `${window.location.origin}/i/${slug}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
	}

	function downloadPdf(invoiceId: string) {
		window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
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
		<a href="/{agencySlug}/invoices/new" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			New Invoice
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
				<div class="stat-title text-xs">Awaiting Payment</div>
				<div class="stat-value text-lg text-warning">{data.stats.awaitingCount}</div>
				<div class="stat-desc text-xs">{formatCurrency(data.stats.awaitingTotal)}</div>
			</div>
			<div class="stat bg-base-100 rounded-lg border border-base-300 p-4">
				<div class="stat-title text-xs">Overdue</div>
				<div class="stat-value text-lg text-error">{data.stats.overdueCount}</div>
				<div class="stat-desc text-xs">{formatCurrency(data.stats.overdueTotal)}</div>
			</div>
			<div class="stat bg-base-100 rounded-lg border border-base-300 p-4">
				<div class="stat-title text-xs">Paid (This Month)</div>
				<div class="stat-value text-lg text-success">{data.stats.paidCount}</div>
				<div class="stat-desc text-xs">{formatCurrency(data.stats.paidTotal)}</div>
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
			All ({data.invoices.length})
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
			class="btn btn-sm {statusFilter === 'paid' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'paid')}
		>
			Paid ({statusCounts.paid})
		</button>
	</div>

	{#if data.invoices.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
					style="background-color: {feature.colorLight}; color: {feature.color}"
				>
					<feature.icon class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No invoices yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create your first invoice to start billing clients for your services.
				</p>
				<a href="/{agencySlug}/invoices/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create Invoice
				</a>
			</div>
		</div>
	{:else if filteredInvoices().length === 0}
		<!-- No matches -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-8">
				<p class="text-base-content/60">No invoices match the selected filter</p>
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
			{#each filteredInvoices() as invoice (invoice.id)}
				{@const statusInfo = getStatusBadge(invoice.status)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-2">
							<a href="/{agencySlug}/invoices/{invoice.id}" class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-medium font-mono">{invoice.invoiceNumber}</span>
									<div class="badge {statusInfo.class} badge-sm gap-1">
										<statusInfo.icon class="h-3 w-3" />
										{statusInfo.label}
									</div>
								</div>
								<p class="text-sm text-base-content/70 mt-1 truncate">
									{#if invoice.clientId}
										<a
											href="/{agencySlug}/clients/{invoice.clientId}"
											class="link link-hover"
											title="View client hub"
											onclick={(e) => e.stopPropagation()}
										>
											{invoice.clientBusinessName || 'No client'}
										</a>
									{:else}
										{invoice.clientBusinessName || 'No client'}
									{/if}
								</p>
							</a>
							<div class="flex items-start gap-2">
								<div class="text-right shrink-0">
									<div class="font-semibold">{formatCurrency(invoice.total)}</div>
									{#if parseFloat(invoice.gstAmount as string) > 0}
										<div class="text-xs text-base-content/60">inc. GST</div>
									{/if}
								</div>
								<div class="dropdown dropdown-end">
									<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-56 border border-base-300">
										<li>
											<a href="/{agencySlug}/invoices/{invoice.id}">
												<Eye class="h-4 w-4" />
												View / Edit
											</a>
										</li>
										<li>
											<button type="button" onclick={() => downloadPdf(invoice.id)}>
												<Download class="h-4 w-4" />
												Download PDF
											</button>
										</li>
										{#if invoice.status === 'draft'}
											<li>
												<button type="button" onclick={() => openSendModal({ id: invoice.id, clientEmail: invoice.clientEmail, clientBusinessName: invoice.clientBusinessName }, 'send')}>
													<Send class="h-4 w-4" />
													Send to Client
												</button>
											</li>
										{/if}
										{#if ['sent', 'viewed', 'overdue'].includes(invoice.status)}
											<li>
												<button type="button" onclick={() => openSendModal({ id: invoice.id, clientEmail: invoice.clientEmail, clientBusinessName: invoice.clientBusinessName }, 'resend')}>
													<RefreshCw class="h-4 w-4" />
													Resend Email
												</button>
											</li>
											<li>
												<button type="button" onclick={() => openSendModal({ id: invoice.id, clientEmail: invoice.clientEmail, clientBusinessName: invoice.clientBusinessName }, 'reminder')}>
													<Bell class="h-4 w-4" />
													Send Reminder
												</button>
											</li>
										{/if}
										{#if !['draft', 'cancelled', 'refunded'].includes(invoice.status)}
											<li>
												<a href={getPublicUrl(invoice.slug)} target="_blank">
													<ExternalLink class="h-4 w-4" />
													View Public Page
												</a>
											</li>
											<li>
												<button type="button" onclick={() => copyPublicUrl(invoice.slug)}>
													<Copy class="h-4 w-4" />
													Copy Link
												</button>
											</li>
										{/if}
										{#if !['paid', 'cancelled', 'refunded'].includes(invoice.status)}
											<li class="border-t border-base-300 mt-1 pt-1">
												{#if invoice.status === 'draft'}
													<button type="button" class="text-error" onclick={() => handleDelete(invoice.id)}>
														<Trash2 class="h-4 w-4" />
														Delete
													</button>
												{:else}
													<button type="button" class="text-error" onclick={() => handleCancel(invoice.id)}>
														<XCircle class="h-4 w-4" />
														Cancel Invoice
													</button>
												{/if}
											</li>
										{/if}
									</ul>
								</div>
							</div>
						</div>
						<a href="/{agencySlug}/invoices/{invoice.id}" class="block">
							<div class="flex items-center justify-between mt-2 pt-2 border-t border-base-200 text-sm text-base-content/60">
								<span>Issued {formatDate(invoice.issueDate)}</span>
								<span>Due {formatDate(invoice.dueDate)}</span>
							</div>
							{#if invoice.viewCount > 0 && invoice.status !== 'draft'}
								<div class="text-xs text-base-content/50 mt-1">
									{invoice.viewCount} view{invoice.viewCount > 1 ? 's' : ''}
								</div>
							{/if}
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
						<th>Invoice</th>
						<th>Client</th>
						<th>Amount</th>
						<th>Status</th>
						<th>Due Date</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredInvoices() as invoice (invoice.id)}
						{@const statusInfo = getStatusBadge(invoice.status)}
						<tr class="hover">
							<td>
								<div class="flex flex-col">
									<span class="font-medium font-mono">{invoice.invoiceNumber}</span>
									<span class="text-sm text-base-content/60">
										{formatDate(invoice.issueDate)}
									</span>
								</div>
							</td>
							<td>
								<div class="flex flex-col">
									{#if invoice.clientId}
										<a
											href="/{agencySlug}/clients/{invoice.clientId}"
											class="link link-hover"
											title="View client hub"
										>
											{invoice.clientBusinessName || 'No client'}
										</a>
									{:else}
										<span>{invoice.clientBusinessName || 'No client'}</span>
									{/if}
									<span class="text-sm text-base-content/60">
										{invoice.clientEmail || '-'}
									</span>
								</div>
							</td>
							<td>
								<span class="font-medium">
									{formatCurrency(invoice.total)}
								</span>
								{#if parseFloat(invoice.gstAmount as string) > 0}
									<div class="text-xs text-base-content/60">
										inc. GST {formatCurrency(invoice.gstAmount)}
									</div>
								{/if}
							</td>
							<td>
								<div class="badge {statusInfo.class} gap-1">
									<statusInfo.icon class="h-3 w-3" />
									{statusInfo.label}
								</div>
								{#if invoice.viewCount > 0 && invoice.status !== 'draft'}
									<div class="text-xs text-base-content/60 mt-1">
										{invoice.viewCount} view{invoice.viewCount > 1 ? 's' : ''}
									</div>
								{/if}
							</td>
							<td>
								<span class="text-sm">{formatDate(invoice.dueDate)}</span>
							</td>
							<td>
								<div class="dropdown dropdown-end">
									<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul
										class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-56 border border-base-300"
									>
										<li>
											<a href="/{agencySlug}/invoices/{invoice.id}">
												<Eye class="h-4 w-4" />
												View / Edit
											</a>
										</li>
										<li>
											<button type="button" onclick={() => downloadPdf(invoice.id)}>
												<Download class="h-4 w-4" />
												Download PDF
											</button>
										</li>
										{#if invoice.status === 'draft'}
											<li>
												<button type="button" onclick={() => openSendModal({ id: invoice.id, clientEmail: invoice.clientEmail, clientBusinessName: invoice.clientBusinessName }, 'send')}>
													<Send class="h-4 w-4" />
													Send to Client
												</button>
											</li>
										{/if}
										{#if invoice.status === 'paid'}
											<li>
												<a href="/{agencySlug}/invoices/{invoice.id}">
													<DollarSign class="h-4 w-4" />
													View Payment
												</a>
											</li>
										{/if}
										{#if ['sent', 'viewed', 'overdue'].includes(invoice.status)}
											<li>
												<a href="/{agencySlug}/invoices/{invoice.id}">
													<DollarSign class="h-4 w-4" />
													Record Payment
												</a>
											</li>
											<li>
												<button type="button" onclick={() => openSendModal({ id: invoice.id, clientEmail: invoice.clientEmail, clientBusinessName: invoice.clientBusinessName }, 'resend')}>
													<RefreshCw class="h-4 w-4" />
													Resend Email
												</button>
											</li>
											<li>
												<button type="button" onclick={() => openSendModal({ id: invoice.id, clientEmail: invoice.clientEmail, clientBusinessName: invoice.clientBusinessName }, 'reminder')}>
													<Bell class="h-4 w-4" />
													Send Reminder
												</button>
											</li>
										{/if}
										{#if !['draft', 'cancelled', 'refunded'].includes(invoice.status)}
											<li>
												<a href={getPublicUrl(invoice.slug)} target="_blank">
													<ExternalLink class="h-4 w-4" />
													View Public Page
												</a>
											</li>
											<li>
												<button type="button" onclick={() => copyPublicUrl(invoice.slug)}>
													<Copy class="h-4 w-4" />
													Copy Link
												</button>
											</li>
										{/if}
										{#if !['paid', 'cancelled', 'refunded'].includes(invoice.status)}
											<li class="border-t border-base-300 mt-1 pt-1">
												{#if invoice.status === 'draft'}
													<button
														type="button"
														class="text-error"
														onclick={() => handleDelete(invoice.id)}
													>
														<Trash2 class="h-4 w-4" />
														Delete
													</button>
												{:else}
													<button
														type="button"
														class="text-error"
														onclick={() => handleCancel(invoice.id)}
													>
														<XCircle class="h-4 w-4" />
														Cancel Invoice
													</button>
												{/if}
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
	title={emailAction === 'send' ? 'Send Invoice' : emailAction === 'resend' ? 'Resend Invoice' : 'Send Payment Reminder'}
	documentType={emailAction === 'reminder' ? 'payment reminder' : 'invoice'}
	recipientEmail={selectedInvoice?.clientEmail || ''}
	recipientName={selectedInvoice?.clientBusinessName}
	loading={sendingEmail}
	onConfirm={confirmSendEmail}
	onCancel={() => sendModalOpen = false}
/>

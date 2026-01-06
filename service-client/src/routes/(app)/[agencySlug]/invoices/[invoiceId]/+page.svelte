<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		updateInvoice,
		deleteInvoice,
		recordPayment,
		cancelInvoice,
		duplicateInvoice
	} from '$lib/api/invoices.remote';
	import { sendInvoiceEmail } from '$lib/api/email.remote';
	import EmailHistory from '$lib/components/emails/EmailHistory.svelte';
	import {
		ArrowLeft,
		Edit,
		Send,
		Download,
		Trash2,
		ExternalLink,
		Copy,
		CheckCircle,
		Clock,
		AlertCircle,
		XCircle,
		Banknote,
		Eye,
		DollarSign,
		Loader2,
		Plus,
		Save
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let invoice = $derived(data.invoice);
	let lineItems = $derived(data.lineItems || []);

	let isEditing = $state(false);
	let saving = $state(false);
	let sending = $state(false);
	let showPaymentModal = $state(false);

	// Edit form state - Client details
	let editClientBusinessName = $state('');
	let editClientContactName = $state('');
	let editClientEmail = $state('');
	let editClientPhone = $state('');
	let editClientAddress = $state('');
	let editClientAbn = $state('');

	// Edit form state - Dates & Terms
	let editIssueDate = $state('');
	let editDueDate = $state('');
	let editPaymentTerms = $state('NET_14');
	let editPaymentTermsCustom = $state('');

	// Edit form state - Financials
	let editDiscountAmount = $state('0.00');
	let editDiscountDescription = $state('');

	// Edit form state - Notes
	let editNotes = $state('');
	let editPublicNotes = $state('');

	// Edit form state - Line items
	type EditLineItem = {
		id?: string | undefined;
		description: string;
		quantity: string;
		unitPrice: string;
		isTaxable: boolean;
		category?: string | undefined;
	};
	let editLineItems = $state<EditLineItem[]>([]);

	// Calculated totals for edit mode
	let editSubtotal = $derived(() => {
		return editLineItems.reduce((sum, item) => {
			return sum + parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0');
		}, 0);
	});

	let editGstAmount = $derived(() => {
		const taxableAmount = editLineItems
			.filter((item) => item.isTaxable)
			.reduce((sum, item) => sum + parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0'), 0);
		const gstRate = parseFloat(invoice.gstRate as string) / 100;
		return invoice.gstRegistered ? taxableAmount * gstRate : 0;
	});

	let editTotal = $derived(() => {
		return editSubtotal() - parseFloat(editDiscountAmount || '0') + editGstAmount();
	});

	// Payment form state
	let paymentMethod = $state<'bank_transfer' | 'card' | 'cash' | 'other'>('bank_transfer');
	let paymentReference = $state('');
	let paymentNotes = $state('');
	let paidAt = $state(new Date().toISOString().split('T')[0]);

	function formatDateForInput(date: Date | string | null): string {
		if (!date) return '';
		return new Date(date).toISOString().split('T')[0] ?? '';
	}

	function startEditing() {
		// Client details
		editClientBusinessName = invoice.clientBusinessName;
		editClientContactName = invoice.clientContactName;
		editClientEmail = invoice.clientEmail;
		editClientPhone = invoice.clientPhone;
		editClientAddress = invoice.clientAddress;
		editClientAbn = invoice.clientAbn || '';

		// Dates & Terms
		editIssueDate = formatDateForInput(invoice.issueDate);
		editDueDate = formatDateForInput(invoice.dueDate);
		editPaymentTerms = invoice.paymentTerms;
		editPaymentTermsCustom = invoice.paymentTermsCustom || '';

		// Financials
		editDiscountAmount = invoice.discountAmount?.toString() || '0.00';
		editDiscountDescription = invoice.discountDescription || '';

		// Notes
		editNotes = invoice.notes;
		editPublicNotes = invoice.publicNotes;

		// Line items
		editLineItems = lineItems.map((item) => ({
			id: item.id,
			description: item.description,
			quantity: item.quantity?.toString() || '1',
			unitPrice: item.unitPrice?.toString() || '0',
			isTaxable: item.isTaxable ?? true,
			category: item.category || undefined
		}));

		isEditing = true;
	}

	function addLineItem() {
		editLineItems = [
			...editLineItems,
			{ description: '', quantity: '1', unitPrice: '0', isTaxable: true }
		];
	}

	function removeLineItem(index: number) {
		editLineItems = editLineItems.filter((_, i) => i !== index);
	}

	async function handleSave() {
		// Validate line items
		const validLineItems = editLineItems.filter((item) => item.description.trim() !== '');
		if (validLineItems.length === 0) {
			toast.error('At least one line item is required');
			return;
		}

		saving = true;
		try {
			await updateInvoice({
				invoiceId: invoice.id,
				// Client details
				clientBusinessName: editClientBusinessName,
				clientContactName: editClientContactName,
				clientEmail: editClientEmail,
				clientPhone: editClientPhone,
				clientAddress: editClientAddress,
				clientAbn: editClientAbn,
				// Dates & Terms
				issueDate: editIssueDate,
				dueDate: editDueDate,
				paymentTerms: editPaymentTerms,
				paymentTermsCustom: editPaymentTermsCustom,
				// Financials
				discountAmount: editDiscountAmount,
				discountDescription: editDiscountDescription,
				// Notes
				notes: editNotes,
				publicNotes: editPublicNotes,
				// Line items
				lineItems: validLineItems.map((item) => ({
					description: item.description,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					isTaxable: item.isTaxable,
					category: item.category
				}))
			});
			await invalidateAll();
			isEditing = false;
			toast.success('Invoice updated');
		} catch (err) {
			toast.error('Failed to update invoice', err instanceof Error ? err.message : '');
		} finally {
			saving = false;
		}
	}

	async function handleSend() {
		if (!confirm(`Send this invoice to ${invoice.clientEmail}?`)) return;

		sending = true;
		try {
			const result = await sendInvoiceEmail({ invoiceId: invoice.id });
			await invalidateAll();
			if (result.success) {
				toast.success('Invoice sent', `Email delivered to ${invoice.clientEmail}`);
			} else {
				toast.error('Failed to send invoice', result.error || 'Unknown error');
			}
		} catch (err) {
			toast.error('Failed to send invoice', err instanceof Error ? err.message : '');
		} finally {
			sending = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this invoice?')) return;

		try {
			await deleteInvoice(invoice.id);
			toast.success('Invoice deleted');
			await goto(`/${agencySlug}/invoices`);
		} catch (err) {
			toast.error('Failed to delete invoice', err instanceof Error ? err.message : '');
		}
	}

	async function handleCancel() {
		if (!confirm('Are you sure you want to cancel this invoice?')) return;

		try {
			await cancelInvoice({ invoiceId: invoice.id });
			await invalidateAll();
			toast.success('Invoice cancelled');
		} catch (err) {
			toast.error('Failed to cancel invoice', err instanceof Error ? err.message : '');
		}
	}

	async function handleDuplicate() {
		try {
			const newInvoice = await duplicateInvoice(invoice.id);
			toast.success('Invoice duplicated');
			await goto(`/${agencySlug}/invoices/${newInvoice.id}`);
		} catch (err) {
			toast.error('Failed to duplicate invoice', err instanceof Error ? err.message : '');
		}
	}

	async function handleRecordPayment() {
		saving = true;
		try {
			await recordPayment({
				invoiceId: invoice.id,
				paymentMethod,
				paymentReference,
				paymentNotes,
				paidAt
			});
			await invalidateAll();
			showPaymentModal = false;
			toast.success('Payment recorded');
		} catch (err) {
			toast.error('Failed to record payment', err instanceof Error ? err.message : '');
		} finally {
			saving = false;
		}
	}

	function downloadPdf() {
		window.open(`/api/invoices/${invoice.id}/pdf`, '_blank');
	}

	function copyPublicUrl() {
		const url = `${window.location.origin}/i/${invoice.slug}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
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
			month: 'long',
			year: 'numeric'
		});
	}

	function formatCurrency(value: string | number | null) {
		const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD'
		}).format(num);
	}

	let statusInfo = $derived(getStatusBadge(invoice.status));
</script>

<!-- Payment Modal -->
{#if showPaymentModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Record Payment</h3>
			<p class="py-2 text-base-content/70">Record a payment for invoice {invoice.invoiceNumber}</p>

			<div class="space-y-4 mt-4">
				<div class="form-control">
					<label class="label" for="paymentMethod">
						<span class="label-text">Payment Method</span>
					</label>
					<select id="paymentMethod" class="select select-bordered" bind:value={paymentMethod}>
						<option value="bank_transfer">Bank Transfer</option>
						<option value="card">Card</option>
						<option value="cash">Cash</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div class="form-control">
					<label class="label" for="paidAt">
						<span class="label-text">Payment Date</span>
					</label>
					<input type="date" id="paidAt" class="input input-bordered" bind:value={paidAt} />
				</div>
				<div class="form-control">
					<label class="label" for="paymentReference">
						<span class="label-text">Reference</span>
					</label>
					<input
						type="text"
						id="paymentReference"
						class="input input-bordered"
						placeholder="Transaction ID, check number, etc."
						bind:value={paymentReference}
					/>
				</div>
				<div class="form-control">
					<label class="label" for="paymentNotes">
						<span class="label-text">Notes</span>
					</label>
					<textarea
						id="paymentNotes"
						class="textarea textarea-bordered"
						rows="2"
						bind:value={paymentNotes}
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => (showPaymentModal = false)}>
					Cancel
				</button>
				<button type="button" class="btn btn-primary" onclick={handleRecordPayment} disabled={saving}>
					{#if saving}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Record Payment
				</button>
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={() => (showPaymentModal = false)}></div>
	</div>
{/if}

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex items-center gap-4">
			<a href="/{agencySlug}/invoices" class="btn btn-ghost btn-sm btn-square">
				<ArrowLeft class="h-4 w-4" />
			</a>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold font-mono">{invoice.invoiceNumber}</h1>
					<div class="badge {statusInfo.class} gap-1">
						<statusInfo.icon class="h-3 w-3" />
						{statusInfo.label}
					</div>
				</div>
				<p class="text-base-content/70">
					{invoice.clientBusinessName}
				</p>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<button type="button" class="btn btn-outline btn-sm" onclick={downloadPdf}>
				<Download class="h-4 w-4" />
				PDF
			</button>

			{#if !['paid', 'cancelled', 'refunded'].includes(invoice.status) && !isEditing}
				<button type="button" class="btn btn-outline btn-sm" onclick={startEditing}>
					<Edit class="h-4 w-4" />
					Edit
				</button>
			{/if}

			{#if invoice.status === 'draft'}
				<button type="button" class="btn btn-primary btn-sm" onclick={handleSend} disabled={sending}>
					{#if sending}
						<Loader2 class="h-4 w-4 animate-spin" />
						Sending...
					{:else}
						<Send class="h-4 w-4" />
						Send
					{/if}
				</button>
			{/if}

			{#if ['sent', 'viewed', 'overdue'].includes(invoice.status)}
				<button type="button" class="btn btn-success btn-sm" onclick={() => (showPaymentModal = true)}>
					<DollarSign class="h-4 w-4" />
					Record Payment
				</button>
				<a href="/i/{invoice.slug}" target="_blank" class="btn btn-outline btn-sm">
					<ExternalLink class="h-4 w-4" />
					View
				</a>
				<button type="button" class="btn btn-outline btn-sm" onclick={copyPublicUrl}>
					<Copy class="h-4 w-4" />
					Copy Link
				</button>
			{/if}

			{#if invoice.status === 'paid'}
				<a href="/i/{invoice.slug}" target="_blank" class="btn btn-outline btn-sm">
					<ExternalLink class="h-4 w-4" />
					View
				</a>
			{/if}

			<div class="dropdown dropdown-end">
				<button type="button" tabindex="0" class="btn btn-ghost btn-sm">More</button>
				<ul class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300">
					<li>
						<button type="button" onclick={handleDuplicate}>
							<Plus class="h-4 w-4" />
							Duplicate
						</button>
					</li>
					{#if !['paid', 'cancelled', 'refunded'].includes(invoice.status)}
						<li class="border-t border-base-300 mt-1 pt-1">
							{#if invoice.status === 'draft'}
								<button type="button" class="text-error" onclick={handleDelete}>
									<Trash2 class="h-4 w-4" />
									Delete
								</button>
							{:else}
								<button type="button" class="text-error" onclick={handleCancel}>
									<XCircle class="h-4 w-4" />
									Cancel
								</button>
							{/if}
						</li>
					{/if}
				</ul>
			</div>
		</div>
	</div>

	{#if isEditing}
		<!-- Edit Mode -->
		<form onsubmit={handleSave} class="space-y-6">
			<!-- Client Details -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Client Details</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="form-control">
							<label class="label" for="edit-clientBusinessName">
								<span class="label-text">Business Name <span class="text-error">*</span></span>
							</label>
							<input
								type="text"
								id="edit-clientBusinessName"
								class="input input-bordered"
								bind:value={editClientBusinessName}
								required
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-clientContactName">
								<span class="label-text">Contact Name</span>
							</label>
							<input
								type="text"
								id="edit-clientContactName"
								class="input input-bordered"
								bind:value={editClientContactName}
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-clientEmail">
								<span class="label-text">Email <span class="text-error">*</span></span>
							</label>
							<input
								type="email"
								id="edit-clientEmail"
								class="input input-bordered"
								bind:value={editClientEmail}
								required
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-clientPhone">
								<span class="label-text">Phone</span>
							</label>
							<input
								type="tel"
								id="edit-clientPhone"
								class="input input-bordered"
								bind:value={editClientPhone}
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-clientAddress">
								<span class="label-text">Address</span>
							</label>
							<textarea
								id="edit-clientAddress"
								class="textarea textarea-bordered"
								rows="2"
								bind:value={editClientAddress}
							></textarea>
						</div>
						<div class="form-control">
							<label class="label" for="edit-clientAbn">
								<span class="label-text">ABN</span>
							</label>
							<input
								type="text"
								id="edit-clientAbn"
								class="input input-bordered"
								bind:value={editClientAbn}
								placeholder="XX XXX XXX XXX"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Dates & Payment Terms -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Dates & Payment Terms</h2>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="form-control">
							<label class="label" for="edit-issueDate">
								<span class="label-text">Issue Date <span class="text-error">*</span></span>
							</label>
							<input
								type="date"
								id="edit-issueDate"
								class="input input-bordered"
								bind:value={editIssueDate}
								required
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-dueDate">
								<span class="label-text">Due Date <span class="text-error">*</span></span>
							</label>
							<input
								type="date"
								id="edit-dueDate"
								class="input input-bordered"
								bind:value={editDueDate}
								required
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-paymentTerms">
								<span class="label-text">Payment Terms</span>
							</label>
							<select
								id="edit-paymentTerms"
								class="select select-bordered"
								bind:value={editPaymentTerms}
							>
								<option value="DUE_ON_RECEIPT">Due on Receipt</option>
								<option value="NET_7">Net 7</option>
								<option value="NET_14">Net 14</option>
								<option value="NET_30">Net 30</option>
								<option value="NET_60">Net 60</option>
								<option value="CUSTOM">Custom</option>
							</select>
						</div>
						{#if editPaymentTerms === 'CUSTOM'}
							<div class="form-control md:col-span-3">
								<label class="label" for="edit-paymentTermsCustom">
									<span class="label-text">Custom Payment Terms</span>
								</label>
								<input
									type="text"
									id="edit-paymentTermsCustom"
									class="input input-bordered"
									bind:value={editPaymentTermsCustom}
									placeholder="e.g., 50% upfront, 50% on completion"
								/>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Line Items -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center justify-between">
						<h2 class="card-title text-lg">Line Items</h2>
						<button type="button" class="btn btn-sm btn-outline" onclick={addLineItem}>
							<Plus class="h-4 w-4" />
							Add Item
						</button>
					</div>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th class="w-[40%]">Description</th>
									<th class="w-20">Qty</th>
									<th class="w-28">Unit Price</th>
									<th class="w-24">Taxable</th>
									<th class="w-28 text-right">Amount</th>
									<th class="w-12"></th>
								</tr>
							</thead>
							<tbody>
								{#each editLineItems as item, index (index)}
									<tr>
										<td>
											<input
												type="text"
												class="input input-bordered input-sm w-full"
												bind:value={item.description}
												placeholder="Item description"
												required
											/>
										</td>
										<td>
											<input
												type="number"
												class="input input-bordered input-sm w-full"
												bind:value={item.quantity}
												min="0.01"
												step="0.01"
											/>
										</td>
										<td>
											<input
												type="number"
												class="input input-bordered input-sm w-full"
												bind:value={item.unitPrice}
												min="0"
												step="0.01"
											/>
										</td>
										<td>
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												bind:checked={item.isTaxable}
											/>
										</td>
										<td class="text-right font-medium">
											{formatCurrency(
												parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0')
											)}
										</td>
										<td>
											<button
												type="button"
												class="btn btn-ghost btn-sm btn-square text-error"
												onclick={() => removeLineItem(index)}
												disabled={editLineItems.length <= 1}
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if editLineItems.length === 0}
						<div class="text-center py-4 text-base-content/60">
							No line items. Click "Add Item" to add one.
						</div>
					{/if}
				</div>
			</div>

			<!-- Financials -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Discount & Totals</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div class="space-y-4">
							<div class="form-control">
								<label class="label" for="edit-discountAmount">
									<span class="label-text">Discount Amount</span>
								</label>
								<div class="input-group">
									<span class="bg-base-200 px-3 flex items-center">$</span>
									<input
										type="number"
										id="edit-discountAmount"
										class="input input-bordered flex-1"
										bind:value={editDiscountAmount}
										min="0"
										step="0.01"
									/>
								</div>
							</div>
							<div class="form-control">
								<label class="label" for="edit-discountDescription">
									<span class="label-text">Discount Description</span>
								</label>
								<input
									type="text"
									id="edit-discountDescription"
									class="input input-bordered"
									bind:value={editDiscountDescription}
									placeholder="e.g., Early payment discount"
								/>
							</div>
						</div>
						<div class="bg-base-200/50 rounded-lg p-4 space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-base-content/70">Subtotal</span>
								<span>{formatCurrency(editSubtotal())}</span>
							</div>
							{#if parseFloat(editDiscountAmount || '0') > 0}
								<div class="flex justify-between text-sm text-success">
									<span>Discount</span>
									<span>-{formatCurrency(parseFloat(editDiscountAmount || '0'))}</span>
								</div>
							{/if}
							{#if invoice.gstRegistered}
								<div class="flex justify-between text-sm">
									<span class="text-base-content/70">GST ({invoice.gstRate}%)</span>
									<span>{formatCurrency(editGstAmount())}</span>
								</div>
							{/if}
							<div class="flex justify-between font-bold text-lg border-t border-base-300 pt-2">
								<span>Total</span>
								<span>{formatCurrency(editTotal())}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Notes -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Notes</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="form-control">
							<label class="label" for="edit-notes">
								<span class="label-text">Internal Notes</span>
							</label>
							<textarea
								id="edit-notes"
								class="textarea textarea-bordered"
								rows="3"
								bind:value={editNotes}
								placeholder="Notes only visible to your team"
							></textarea>
						</div>
						<div class="form-control">
							<label class="label" for="edit-publicNotes">
								<span class="label-text">Public Notes</span>
							</label>
							<textarea
								id="edit-publicNotes"
								class="textarea textarea-bordered"
								rows="3"
								bind:value={editPublicNotes}
								placeholder="Notes visible on the invoice"
							></textarea>
						</div>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-4">
				<button type="button" class="btn btn-ghost" onclick={() => (isEditing = false)}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{#if saving}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					<Save class="h-4 w-4" />
					Save Changes
				</button>
			</div>
		</form>
	{:else}
		<!-- View Mode - Invoice Preview -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<!-- Header -->
				<div class="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-base-300">
					<div>
						<h2 class="text-3xl font-bold">INVOICE</h2>
						<p class="text-base-content/60 mt-1 font-mono"># {invoice.invoiceNumber}</p>
					</div>
					<div class="sm:text-right">
						<div class="badge {statusInfo.class} badge-lg gap-1">
							<statusInfo.icon class="h-4 w-4" />
							{statusInfo.label}
						</div>
					</div>
				</div>

				<!-- Addresses -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-base-300">
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							From
						</h3>
						<div class="text-sm space-y-1">
							<p class="font-semibold">{data.agency.name}</p>
							{#if data.profile?.addressLine1}
								<p>{data.profile.addressLine1}</p>
							{/if}
							{#if data.profile?.city || data.profile?.state || data.profile?.postcode}
								<p>
									{[data.profile?.city, data.profile?.state, data.profile?.postcode]
										.filter(Boolean)
										.join(' ')}
								</p>
							{/if}
							{#if data.agency.email}
								<p>{data.agency.email}</p>
							{/if}
							{#if data.profile?.abn}
								<p>ABN: {data.profile.abn}</p>
							{/if}
						</div>
					</div>
					<div class="sm:text-right">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							Bill To
						</h3>
						<div class="text-sm space-y-1">
							<p class="font-semibold">{invoice.clientBusinessName}</p>
							{#if invoice.clientContactName}
								<p>{invoice.clientContactName}</p>
							{/if}
							{#if invoice.clientAddress}
								<p>{invoice.clientAddress}</p>
							{/if}
							{#if invoice.clientEmail}
								<p>{invoice.clientEmail}</p>
							{/if}
							{#if invoice.clientAbn}
								<p>ABN: {invoice.clientAbn}</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Dates -->
				<div class="grid grid-cols-3 gap-4 py-6 bg-base-200/50 rounded-lg px-4 -mx-4">
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
							Issue Date
						</h3>
						<p class="font-medium">{formatDate(invoice.issueDate)}</p>
					</div>
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
							Due Date
						</h3>
						<p class="font-medium">{formatDate(invoice.dueDate)}</p>
					</div>
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
							Payment Terms
						</h3>
						<p class="font-medium">
							{invoice.paymentTerms === 'CUSTOM'
								? invoice.paymentTermsCustom
								: invoice.paymentTerms.replace('_', ' ')}
						</p>
					</div>
				</div>

				<!-- Line Items -->
				<div class="overflow-x-auto my-6">
					<table class="table">
						<thead>
							<tr class="bg-base-200">
								<th>Description</th>
								<th class="text-center">Qty</th>
								<th class="text-right">Unit Price</th>
								<th class="text-right">Amount</th>
							</tr>
						</thead>
						<tbody>
							{#each lineItems as item}
								<tr>
									<td>
										<div class="font-medium">{item.description}</div>
										{#if item.category}
											<div class="text-xs text-base-content/60">{item.category}</div>
										{/if}
									</td>
									<td class="text-center">{parseFloat(item.quantity as string).toFixed(2)}</td>
									<td class="text-right">{formatCurrency(item.unitPrice)}</td>
									<td class="text-right font-medium">
										{formatCurrency(item.amount)}
										{#if !item.isTaxable}
											<span class="text-xs text-base-content/60">(No GST)</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Totals -->
				<div class="flex justify-end">
					<div class="w-full max-w-xs space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-base-content/70">Subtotal</span>
							<span>{formatCurrency(invoice.subtotal)}</span>
						</div>
						{#if parseFloat(invoice.discountAmount as string) > 0}
							<div class="flex justify-between text-sm text-success">
								<span>
									Discount{invoice.discountDescription
										? ` (${invoice.discountDescription})`
										: ''}
								</span>
								<span>-{formatCurrency(invoice.discountAmount)}</span>
							</div>
						{/if}
						{#if invoice.gstRegistered && parseFloat(invoice.gstAmount as string) > 0}
							<div class="flex justify-between text-sm">
								<span class="text-base-content/70">GST ({invoice.gstRate}%)</span>
								<span>{formatCurrency(invoice.gstAmount)}</span>
							</div>
						{/if}
						<div class="flex justify-between font-bold text-lg border-t border-base-300 pt-2">
							<span>Total</span>
							<span>{formatCurrency(invoice.total)}</span>
						</div>
						{#if invoice.status === 'paid' && invoice.paidAt}
							<div class="bg-success/10 text-success text-center py-2 px-3 rounded-lg font-medium">
								Paid on {formatDate(invoice.paidAt)}
							</div>
						{/if}
					</div>
				</div>

				<!-- Payment Details -->
				{#if invoice.status !== 'paid' && (data.profile?.bankName || data.profile?.bsb || data.profile?.accountNumber)}
					<div class="mt-8 pt-6 border-t border-base-300">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							Payment Details
						</h3>
						<div class="bg-base-200/50 p-4 rounded-lg">
							<div class="grid grid-cols-2 gap-2 text-sm">
								{#if data.profile?.bankName}
									<span class="text-base-content/70">Bank</span>
									<span class="font-medium">{data.profile.bankName}</span>
								{/if}
								{#if data.profile?.accountName}
									<span class="text-base-content/70">Account Name</span>
									<span class="font-medium">{data.profile.accountName}</span>
								{/if}
								{#if data.profile?.bsb}
									<span class="text-base-content/70">BSB</span>
									<span class="font-mono font-medium">{data.profile.bsb}</span>
								{/if}
								{#if data.profile?.accountNumber}
									<span class="text-base-content/70">Account Number</span>
									<span class="font-mono font-medium">{data.profile.accountNumber}</span>
								{/if}
								<span class="text-base-content/70">Reference</span>
								<span class="font-mono font-medium">{invoice.invoiceNumber}</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Payment Info (if paid) -->
				{#if invoice.status === 'paid'}
					<div class="mt-8 pt-6 border-t border-base-300">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							Payment Information
						</h3>
						<div class="bg-success/10 p-4 rounded-lg">
							<div class="grid grid-cols-2 gap-2 text-sm">
								<span class="text-base-content/70">Payment Method</span>
								<span class="font-medium capitalize">
									{(invoice.paymentMethod || 'Unknown').replace('_', ' ')}
								</span>
								<span class="text-base-content/70">Paid On</span>
								<span class="font-medium">{formatDate(invoice.paidAt)}</span>
								{#if invoice.paymentReference}
									<span class="text-base-content/70">Reference</span>
									<span class="font-mono font-medium">{invoice.paymentReference}</span>
								{/if}
								{#if invoice.paymentNotes}
									<span class="text-base-content/70">Notes</span>
									<span>{invoice.paymentNotes}</span>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- Notes -->
				{#if invoice.publicNotes}
					<div class="mt-8 pt-6 border-t border-base-300">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							Notes
						</h3>
						<p class="text-sm whitespace-pre-wrap">{invoice.publicNotes}</p>
					</div>
				{/if}

				<!-- Internal Notes (not on public view) -->
				{#if invoice.notes}
					<div class="mt-8 pt-6 border-t border-base-300">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							Internal Notes
						</h3>
						<div class="bg-warning/10 p-4 rounded-lg">
							<p class="text-sm whitespace-pre-wrap">{invoice.notes}</p>
						</div>
					</div>
				{/if}

				<!-- View Stats -->
				{#if invoice.viewCount > 0}
					<div class="mt-8 pt-6 border-t border-base-300 text-sm text-base-content/60">
						Viewed {invoice.viewCount} time{invoice.viewCount > 1 ? 's' : ''}
						{#if invoice.lastViewedAt}
							&bull; Last viewed {formatDate(invoice.lastViewedAt)}
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Email History -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<EmailHistory invoiceId={invoice.id} />
			</div>
		</div>
	{/if}
</div>

<script lang="ts">
	import { page } from '$app/state';
	import {
		CheckCircle,
		Clock,
		AlertCircle,
		XCircle,
		Send,
		Eye,
		Banknote,
		Download,
		Printer,
		CreditCard
	} from 'lucide-svelte';
	import { formatDate, formatCurrency } from '$lib/utils/formatting';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let invoice = $derived(data.invoice);
	let lineItems = $derived(data.lineItems || []);
	let agency = $derived(data.agency);
	let profile = $derived(data.profile);

	// Check for successful payment redirect
	let justPaid = $derived(page.url.searchParams.get('paid') === 'true');

	// Check if payment link is available and invoice can be paid
	let canPay = $derived(
		invoice.stripePaymentLinkUrl &&
		!['paid', 'cancelled', 'refunded'].includes(invoice.status) &&
		invoice.onlinePaymentEnabled
	);

	function getStatusBadge(status: string) {
		switch (status) {
			case 'draft':
				return { class: 'badge-ghost', icon: Clock, label: 'Draft' };
			case 'sent':
				return { class: 'badge-info', icon: Send, label: 'Awaiting Payment' };
			case 'viewed':
				return { class: 'badge-warning', icon: Eye, label: 'Awaiting Payment' };
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

	function downloadPdf() {
		window.open(`/api/invoices/${invoice.id}/pdf`, '_blank');
	}

	function handlePrint() {
		window.print();
	}

	let statusInfo = $derived(getStatusBadge(invoice.status));
	let isPaid = $derived(invoice.status === 'paid');
</script>

<svelte:head>
	<title>Invoice {invoice.invoiceNumber} | {agency.name}</title>
	<style>
		@media print {
			body * {
				visibility: hidden;
			}
			#invoice-content,
			#invoice-content * {
				visibility: visible;
			}
			#invoice-content {
				position: absolute;
				left: 0;
				top: 0;
				width: 100%;
			}
			.print-hidden {
				display: none !important;
			}
		}
	</style>
</svelte:head>

<div class="min-h-screen bg-base-200 py-8">
	<div class="container mx-auto px-4 max-w-3xl">
		<!-- Payment Success Banner -->
		{#if justPaid}
			<div class="alert alert-success mb-6 print-hidden">
				<CheckCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Payment Successful!</h3>
					<p class="text-sm">Thank you for your payment. A confirmation has been sent to your email.</p>
				</div>
			</div>
		{/if}

		<!-- Actions Bar (hidden in print) -->
		<div class="flex justify-end gap-2 mb-6 print-hidden">
			<button type="button" class="btn btn-outline btn-sm" onclick={downloadPdf}>
				<Download class="h-4 w-4" />
				Download PDF
			</button>
			<button type="button" class="btn btn-outline btn-sm" onclick={handlePrint}>
				<Printer class="h-4 w-4" />
				Print
			</button>
		</div>

		<!-- Invoice Card -->
		<div id="invoice-content" class="card bg-base-100 shadow-xl relative overflow-hidden">
			<!-- Paid Watermark -->
			{#if isPaid}
				<div
					class="absolute inset-0 flex items-center justify-center pointer-events-none z-0 print-hidden"
				>
					<div
						class="text-8xl font-bold text-success/10 transform -rotate-45 select-none"
					>
						PAID
					</div>
				</div>
			{/if}

			<div class="card-body relative z-10">
				<!-- Header -->
				<div class="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-base-300">
					<div>
						{#if agency.logoUrl}
							<img
								src={agency.logoUrl}
								alt={agency.name}
								class="h-12 object-contain mb-2"
							/>
						{:else}
							<h2 class="text-2xl font-bold" style:color={agency.primaryColor || undefined}>
								{agency.name}
							</h2>
						{/if}
					</div>
					<div class="sm:text-right">
						<div class="text-3xl font-bold">INVOICE</div>
						<p class="text-base-content/60 mt-1 font-mono"># {invoice.invoiceNumber}</p>
						<div class="mt-2">
							<div class="badge {statusInfo.class} badge-lg gap-1">
								<statusInfo.icon class="h-4 w-4" />
								{statusInfo.label}
							</div>
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
							<p class="font-semibold">{profile?.tradingName || agency.name}</p>
							{#if profile?.addressLine1}
								<p>{profile.addressLine1}</p>
							{/if}
							{#if profile?.addressLine2}
								<p>{profile.addressLine2}</p>
							{/if}
							{#if profile?.city || profile?.state || profile?.postcode}
								<p>
									{[profile?.city, profile?.state, profile?.postcode]
										.filter(Boolean)
										.join(' ')}
								</p>
							{/if}
							{#if agency.email}
								<p>{agency.email}</p>
							{/if}
							{#if agency.phone}
								<p>{agency.phone}</p>
							{/if}
							{#if profile?.abn}
								<p>ABN: {profile.abn}</p>
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
								<p class="whitespace-pre-line">{invoice.clientAddress}</p>
							{/if}
							{#if invoice.clientEmail}
								<p>{invoice.clientEmail}</p>
							{/if}
							{#if invoice.clientPhone}
								<p>{invoice.clientPhone}</p>
							{/if}
							{#if invoice.clientAbn}
								<p>ABN: {invoice.clientAbn}</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Dates -->
				<div class="grid grid-cols-3 gap-4 py-6 bg-base-200/50 rounded-lg px-4 my-4">
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
							Issue Date
						</h3>
						<p class="font-medium">{formatDate(invoice.issueDate, 'long')}</p>
					</div>
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
							Due Date
						</h3>
						<p class="font-medium">{formatDate(invoice.dueDate, 'long')}</p>
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
											<div class="text-xs text-base-content/60 capitalize">{item.category}</div>
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
						{#if isPaid && invoice.paidAt}
							<div class="bg-success/10 text-success text-center py-2 px-3 rounded-lg font-medium mt-4">
								Paid on {formatDate(invoice.paidAt, 'long')}
							</div>
						{/if}
					</div>
				</div>

				<!-- Payment Details (only show if not paid) -->
				{#if !isPaid && (profile?.bankName || profile?.bsb || profile?.accountNumber)}
					<div class="mt-8 pt-6 border-t border-base-300">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							Payment Details
						</h3>
						<div class="bg-base-200/50 p-4 rounded-lg">
							<div class="grid grid-cols-2 gap-2 text-sm">
								{#if profile?.bankName}
									<span class="text-base-content/70">Bank</span>
									<span class="font-medium">{profile.bankName}</span>
								{/if}
								{#if profile?.accountName}
									<span class="text-base-content/70">Account Name</span>
									<span class="font-medium">{profile.accountName}</span>
								{/if}
								{#if profile?.bsb}
									<span class="text-base-content/70">BSB</span>
									<span class="font-mono font-medium">{profile.bsb}</span>
								{/if}
								{#if profile?.accountNumber}
									<span class="text-base-content/70">Account Number</span>
									<span class="font-mono font-medium">{profile.accountNumber}</span>
								{/if}
								<span class="text-base-content/70">Reference</span>
								<span class="font-mono font-medium">{invoice.invoiceNumber}</span>
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

				<!-- Invoice Footer -->
				{#if profile?.invoiceFooter}
					<div class="mt-8 pt-6 border-t border-base-300 text-center text-sm text-base-content/60">
						{profile.invoiceFooter}
					</div>
				{/if}
			</div>
		</div>

		<!-- Pay Now Button -->
		{#if canPay}
			<div class="mt-6 print-hidden">
				<a
					href={invoice.stripePaymentLinkUrl}
					class="btn btn-primary btn-lg w-full gap-2"
					target="_blank"
					rel="noopener noreferrer"
				>
					<CreditCard class="h-5 w-5" />
					Pay {formatCurrency(invoice.total)} Now
				</a>
				<p class="text-center text-sm text-base-content/60 mt-2">
					Secure payment powered by Stripe
				</p>
			</div>
		{/if}

		<!-- Powered By Footer -->
		<div class="text-center mt-8 text-sm text-base-content/40 print-hidden">
			Powered by <a href="https://webkit.au" class="link link-hover">Webkit</a>
		</div>
	</div>
</div>

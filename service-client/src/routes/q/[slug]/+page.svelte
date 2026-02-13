<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		CheckCircle,
		AlertCircle,
		XCircle,
		Mail,
		Phone,
		MapPin,
		Download,
		Printer,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { formatDate, formatCurrency } from '$lib/utils/formatting';
	import type { PageProps, ActionData } from './$types';

	let { data, form }: PageProps & { form: ActionData } = $props();

	let quotation = $derived(data.quotation);
	let sections = $derived(data.sections);
	let agency = $derived(data.agency);
	let profile = $derived(data.profile);

	let effectiveStatus = $derived(quotation.effectiveStatus);
	let isAccepted = $derived(effectiveStatus === 'accepted');
	let isDeclined = $derived(effectiveStatus === 'declined');
	let isExpired = $derived(effectiveStatus === 'expired');
	let canRespond = $derived(['sent', 'viewed'].includes(effectiveStatus));

	// Terms blocks from JSONB
	let termsBlocks = $derived(
		(quotation.termsBlocks as Array<{ title: string; content: string; sortOrder: number }>) || []
	);

	// Form state
	let acceptedByName = $state('');
	let acceptedByTitle = $state('');
	let isSubmitting = $state(false);
	let acceptSuccess = $state(false);
	let declineSuccess = $state(false);

	// Decline flow state
	let showDeclineForm = $state(false);
	let declineReason = $state('');

	// Handle form success
	$effect(() => {
		if (form?.success && form?.action === 'accepted') {
			acceptSuccess = true;
		}
		if (form?.success && form?.action === 'declined') {
			declineSuccess = true;
		}
	});

	function getStatusBadge(status: string) {
		switch (status) {
			case 'accepted':
				return { class: 'badge-success', label: 'Accepted' };
			case 'declined':
				return { class: 'badge-error', label: 'Declined' };
			case 'expired':
				return { class: 'badge-warning', label: 'Expired' };
			case 'sent':
			case 'viewed':
				return { class: 'badge-info', label: 'Awaiting Response' };
			default:
				return { class: 'badge-ghost', label: status };
		}
	}

	let statusInfo = $derived(getStatusBadge(effectiveStatus));

	function downloadPdf() {
		window.open(`/api/quotations/${quotation.id}/pdf`, '_blank');
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Quotation {quotation.quotationNumber} | {agency?.name || 'Quotation'}</title>
	<style>
		@media print {
			body * {
				visibility: hidden;
			}
			#quotation-content,
			#quotation-content * {
				visibility: visible;
			}
			#quotation-content {
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
	<div class="container mx-auto px-4 max-w-4xl">
		<!-- Accept Success Message -->
		{#if acceptSuccess}
			<div class="alert alert-success mb-6 print-hidden">
				<CheckCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Quotation Accepted!</h3>
					<p class="text-sm">Thank you for accepting this quotation. The team will be in touch to schedule your work.</p>
				</div>
			</div>
		{/if}

		<!-- Decline Success Message -->
		{#if declineSuccess}
			<div class="alert alert-info mb-6 print-hidden">
				<XCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Quotation Declined</h3>
					<p class="text-sm">The quotation has been declined. Thank you for letting us know.</p>
				</div>
			</div>
		{/if}

		<!-- Expired Warning -->
		{#if isExpired && !acceptSuccess && !declineSuccess}
			<div class="alert alert-warning mb-6 print-hidden">
				<AlertCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Quotation Expired</h3>
					<p class="text-sm">
						This quotation expired on {formatDate(quotation.expiryDate, 'long')}. Please contact us for an updated quotation.
					</p>
				</div>
			</div>
		{/if}

		<!-- Already Accepted -->
		{#if isAccepted && !acceptSuccess}
			<div class="alert alert-success mb-6 print-hidden">
				<CheckCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Quotation Accepted</h3>
					<p class="text-sm">
						This quotation was accepted by {quotation.acceptedByName} on {formatDate(quotation.acceptedAt, 'long')}.
					</p>
				</div>
			</div>
		{/if}

		<!-- Already Declined -->
		{#if isDeclined && !declineSuccess}
			<div class="alert alert-error mb-6 print-hidden">
				<XCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Quotation Declined</h3>
					<p class="text-sm">
						This quotation was declined on {formatDate(quotation.declinedAt, 'long')}.
						{#if quotation.declineReason}
							Reason: {quotation.declineReason}
						{/if}
					</p>
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

		<!-- Quotation Card -->
		<div id="quotation-content" class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<!-- Header -->
				<div class="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-base-300">
					<div>
						{#if agency?.logoUrl}
							<img
								src={agency.logoUrl}
								alt={agency.name}
								class="h-12 object-contain mb-2"
							/>
						{:else}
							<h2 class="text-2xl font-bold" style:color={agency?.primaryColor || undefined}>
								{agency?.name || 'Agency'}
							</h2>
						{/if}
						{#if profile?.tagline}
							<p class="text-sm text-base-content/60">{profile.tagline}</p>
						{/if}
					</div>
					<div class="sm:text-right">
						<div class="text-3xl font-bold">QUOTATION</div>
						<p class="text-base-content/60 mt-1 font-mono"># {quotation.quotationNumber}</p>
						<div class="mt-2">
							<div class="badge {statusInfo.class} badge-lg">
								{statusInfo.label}
							</div>
						</div>
					</div>
				</div>

				<!-- Prepared For / From -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-8 py-6 border-b border-base-300">
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							From
						</h3>
						<div class="text-sm space-y-1">
							<p class="font-semibold">{profile?.tradingName || agency?.name}</p>
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
							{#if agency?.email}
								<p>{agency.email}</p>
							{/if}
							{#if agency?.phone}
								<p>{agency.phone}</p>
							{/if}
							{#if profile?.abn}
								<p>ABN: {profile.abn}</p>
							{/if}
						</div>
					</div>
					<div class="sm:text-right">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
							Prepared For
						</h3>
						<div class="text-sm space-y-1">
							<p class="font-semibold">{quotation.clientBusinessName}</p>
							{#if quotation.clientContactName}
								<p>{quotation.clientContactName}</p>
							{/if}
							{#if quotation.clientAddress}
								<p class="whitespace-pre-line">{quotation.clientAddress}</p>
							{/if}
							{#if quotation.clientEmail}
								<p>{quotation.clientEmail}</p>
							{/if}
							{#if quotation.clientPhone}
								<p>{quotation.clientPhone}</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Dates & Site -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 bg-base-200/50 rounded-lg px-4 my-4">
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
							Date
						</h3>
						<p class="font-medium">{formatDate(quotation.preparedDate, 'long')}</p>
					</div>
					<div>
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
							Valid Until
						</h3>
						<p class="font-medium">{formatDate(quotation.expiryDate, 'long')}</p>
					</div>
					{#if quotation.siteAddress}
						<div class="col-span-2">
							<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1">
								Site Address
							</h3>
							<p class="font-medium flex items-start gap-1">
								<MapPin class="h-4 w-4 shrink-0 mt-0.5" />
								{quotation.siteAddress}
							</p>
						</div>
					{/if}
				</div>

				{#if quotation.siteReference}
					<div class="mb-4 px-4">
						<span class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">Reference:</span>
						<span class="font-medium ml-2">{quotation.siteReference}</span>
					</div>
				{/if}

				<!-- Scope Sections -->
				{#if sections.length > 0}
					<div class="mt-4 space-y-6">
						<h2 class="text-lg font-bold">Scope of Works</h2>

						{#each sections as section}
							{@const items = (section.workItems as string[]) || []}
							<div class="border border-base-300 rounded-lg overflow-hidden">
								<div class="bg-base-200/50 px-4 py-3 flex justify-between items-center">
									<h3 class="font-semibold">{section.title}</h3>
									<span class="font-bold text-primary">
										{formatCurrency(section.sectionTotal)}
										{#if quotation.gstRegistered}
											<span class="text-xs text-base-content/60 font-normal">inc GST</span>
										{/if}
									</span>
								</div>
								<div class="p-4">
									{#if items.length > 0}
										<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
											{#each items as item}
												<div class="flex items-start gap-2 text-sm">
													<span class="text-primary mt-0.5 shrink-0">&#x2022;</span>
													<span>{item}</span>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Pricing Summary -->
				<div class="mt-8 flex justify-end">
					<div class="w-full max-w-xs space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-base-content/70">Subtotal (ex GST)</span>
							<span>{formatCurrency(quotation.subtotal)}</span>
						</div>
						{#if parseFloat(quotation.discountAmount as string) > 0}
							<div class="flex justify-between text-sm text-success">
								<span>
									Discount{quotation.discountDescription
										? ` (${quotation.discountDescription})`
										: ''}
								</span>
								<span>-{formatCurrency(quotation.discountAmount)}</span>
							</div>
						{/if}
						{#if quotation.gstRegistered && parseFloat(quotation.gstAmount as string) > 0}
							<div class="flex justify-between text-sm">
								<span class="text-base-content/70">GST ({quotation.gstRate}%)</span>
								<span>{formatCurrency(quotation.gstAmount)}</span>
							</div>
						{/if}
						<div class="flex justify-between font-bold text-xl border-t-2 border-base-content pt-3 mt-2">
							<span>Total</span>
							<span>{formatCurrency(quotation.total)}</span>
						</div>
					</div>
				</div>

				<!-- Terms -->
				{#if termsBlocks.length > 0}
					<div class="mt-8 pt-6 border-t border-base-300">
						<h2 class="text-lg font-bold mb-4">Terms & Conditions</h2>
						<div class="space-y-4">
							{#each termsBlocks.sort((a, b) => a.sortOrder - b.sortOrder) as term}
								<div>
									<h3 class="font-semibold text-sm mb-1">{term.title}</h3>
									<div class="prose prose-sm max-w-none text-base-content/80">
										{@html sanitizeHtml(term.content)}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Options Notes -->
				{#if quotation.optionsNotes}
					<div class="mt-8 pt-6 border-t border-base-300">
						<h2 class="text-lg font-bold mb-2">Options & Notes</h2>
						<p class="text-sm whitespace-pre-wrap text-base-content/80">{quotation.optionsNotes}</p>
					</div>
				{/if}

				<!-- Acceptance Section -->
				{#if canRespond && !acceptSuccess && !declineSuccess}
					<div class="mt-8 pt-6 border-t-2 border-primary print-hidden">
						<h2 class="text-lg font-bold mb-4">Acceptance</h2>

						{#if form?.error}
							<div class="alert alert-error alert-sm mb-4">
								<AlertCircle class="h-4 w-4" />
								<span>{form.error}</span>
							</div>
						{/if}

						<form
							method="POST"
							action="?/accept"
							use:enhance={() => {
								isSubmitting = true;
								return async ({ update }) => {
									isSubmitting = false;
									await update();
								};
							}}
							class="space-y-4"
						>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div class="form-control">
									<label class="label" for="acceptedByName">
										<span class="label-text font-medium">Your Full Name *</span>
									</label>
									<input
										type="text"
										id="acceptedByName"
										name="acceptedByName"
										bind:value={acceptedByName}
										class="input input-bordered"
										placeholder="Enter your full name"
										required
									/>
								</div>
								<div class="form-control">
									<label class="label" for="acceptedByTitle">
										<span class="label-text font-medium">Position / Title</span>
									</label>
									<input
										type="text"
										id="acceptedByTitle"
										name="acceptedByTitle"
										bind:value={acceptedByTitle}
										class="input input-bordered"
										placeholder="e.g., Director, Owner"
									/>
								</div>
							</div>

							<div class="flex flex-col sm:flex-row gap-3">
								<button
									type="submit"
									class="btn btn-primary flex-1"
									disabled={isSubmitting || !acceptedByName}
								>
									{#if isSubmitting}
										<span class="loading loading-spinner loading-sm"></span>
									{:else}
										<CheckCircle class="h-4 w-4" />
									{/if}
									Accept Quotation
								</button>

								<button
									type="button"
									class="btn btn-outline btn-error"
									onclick={() => (showDeclineForm = !showDeclineForm)}
								>
									<XCircle class="h-4 w-4" />
									Decline
									{#if showDeclineForm}
										<ChevronUp class="h-4 w-4" />
									{:else}
										<ChevronDown class="h-4 w-4" />
									{/if}
								</button>
							</div>

							<p class="text-xs text-center text-base-content/50">
								By accepting, you agree to the terms and pricing outlined in this quotation.
							</p>
						</form>

						<!-- Decline Form (expanded below) -->
						{#if showDeclineForm}
							<div class="mt-4 p-4 bg-error/5 border border-error/20 rounded-lg">
								<h3 class="font-semibold text-error mb-2">Decline Quotation</h3>
								<form
									method="POST"
									action="?/decline"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ update }) => {
											isSubmitting = false;
											await update();
										};
									}}
									class="space-y-3"
								>
									<div class="form-control">
										<label class="label" for="declineReason">
											<span class="label-text">Reason (optional)</span>
										</label>
										<textarea
											id="declineReason"
											name="reason"
											bind:value={declineReason}
											class="textarea textarea-bordered"
											placeholder="Let us know why so we can improve..."
											rows="3"
										></textarea>
									</div>
									<button
										type="submit"
										class="btn btn-error btn-sm"
										disabled={isSubmitting}
									>
										{#if isSubmitting}
											<span class="loading loading-spinner loading-sm"></span>
										{/if}
										Confirm Decline
									</button>
								</form>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Accepted Confirmation -->
				{#if isAccepted && !acceptSuccess}
					<div class="mt-8 pt-6 border-t border-base-300">
						<div class="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
							<CheckCircle class="h-8 w-8 text-success mx-auto mb-2" />
							<p class="font-semibold">Accepted by {quotation.acceptedByName}</p>
							{#if quotation.acceptedByTitle}
								<p class="text-sm text-base-content/60">{quotation.acceptedByTitle}</p>
							{/if}
							<p class="text-sm text-base-content/60 mt-1">
								{formatDate(quotation.acceptedAt, 'long')}
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Contact Info -->
		{#if agency?.email || agency?.phone}
			<div class="card bg-base-100 mt-6 print-hidden">
				<div class="card-body py-4">
					<div class="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
						<span class="text-base-content/60">Questions?</span>
						{#if agency?.email}
							<a
								href="mailto:{agency.email}"
								class="flex items-center gap-1 hover:text-primary transition-colors"
							>
								<Mail class="h-4 w-4" />
								{agency.email}
							</a>
						{/if}
						{#if agency?.phone}
							<a
								href="tel:{agency.phone}"
								class="flex items-center gap-1 hover:text-primary transition-colors"
							>
								<Phone class="h-4 w-4" />
								{agency.phone}
							</a>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Powered By Footer -->
		<div class="text-center mt-8 text-sm text-base-content/40 print-hidden">
			Powered by <a href="https://webkit.au" class="link link-hover">Webkit</a>
		</div>
	</div>
</div>

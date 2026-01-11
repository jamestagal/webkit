<script lang="ts">
	/**
	 * Contract Editor Page
	 *
	 * Full editor for viewing and editing contracts with:
	 * - Overview section with status and quick actions
	 * - Client info section
	 * - Agreement section with field visibility toggles
	 * - Schedule section for selecting included sections
	 * - Signatures section
	 * - History section with email tracking
	 */

	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateContract, sendContract, deleteContract } from '$lib/api/contracts.remote';
	import { sendContractEmail } from '$lib/api/email.remote';
	import EmailHistory from '$lib/components/emails/EmailHistory.svelte';
	import {
		Save,
		Send,
		Eye,
		ChevronLeft,
		User,
		FileText,
		PenTool,
		History,
		ExternalLink,
		Copy,
		Trash2,
		CheckCircle,
		Clock,
		AlertCircle,
		LayoutDashboard,
		Settings2,
		FileDown
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let contract = $derived(data.contract);
	let availableSchedules = $derived(data.availableSchedules);

	let isSubmitting = $state(false);
	let isSending = $state(false);
	let isDownloadingPdf = $state(false);
	let activeSection = $state('overview');

	// Form state - editable fields
	let clientBusinessName = $state('');
	let clientContactName = $state('');
	let clientEmail = $state('');
	let clientPhone = $state('');
	let clientAddress = $state('');
	let servicesDescription = $state('');
	let commencementDate = $state('');
	let completionDate = $state('');
	let specialConditions = $state('');
	let totalPrice = $state('');
	let priceIncludesGst = $state(true);
	let paymentTerms = $state('');
	let validUntil = $state('');
	let agencySignatoryName = $state('');
	let agencySignatoryTitle = $state('');

	// Field visibility state
	let visibleFields = $state<string[]>([]);

	// Included schedule IDs
	let includedScheduleIds = $state<string[]>([]);

	// Sync form state when contract data changes
	$effect(() => {
		clientBusinessName = contract.clientBusinessName || '';
		clientContactName = contract.clientContactName || '';
		clientEmail = contract.clientEmail || '';
		clientPhone = contract.clientPhone || '';
		clientAddress = contract.clientAddress || '';
		servicesDescription = contract.servicesDescription || '';
		commencementDate = contract.commencementDate
			? new Date(contract.commencementDate).toISOString().split('T')[0]
			: '';
		completionDate = contract.completionDate
			? new Date(contract.completionDate).toISOString().split('T')[0]
			: '';
		specialConditions = contract.specialConditions || '';
		totalPrice = contract.totalPrice || '';
		priceIncludesGst = contract.priceIncludesGst ?? true;
		paymentTerms = contract.paymentTerms || '';
		validUntil = contract.validUntil
			? new Date(contract.validUntil).toISOString().split('T')[0]
			: '';
		agencySignatoryName = contract.agencySignatoryName || '';
		agencySignatoryTitle = contract.agencySignatoryTitle || '';
		visibleFields = (contract.visibleFields as string[]) || [
			'services',
			'commencementDate',
			'completionDate',
			'price',
			'paymentTerms',
			'specialConditions'
		];
		includedScheduleIds = (contract.includedScheduleIds as string[]) || [];
	});

	// Editable: draft, sent, viewed - locked only after signing
	let isEditable = $derived(!['signed', 'completed', 'expired', 'terminated'].includes(contract.status));

	// Can send: only draft
	let canSend = $derived(contract.status === 'draft');

	// Can resend: sent or viewed
	let canResend = $derived(['sent', 'viewed'].includes(contract.status));

	// Sections for navigation
	const sections = [
		{ id: 'overview', label: 'Overview', icon: LayoutDashboard },
		{ id: 'preview', label: 'Preview', icon: Eye },
		{ id: 'client', label: 'Client', icon: User },
		{ id: 'agreement', label: 'Agreement', icon: FileText },
		{ id: 'schedule', label: 'Schedule', icon: Settings2 },
		{ id: 'signatures', label: 'Signatures', icon: PenTool },
		{ id: 'history', label: 'History', icon: History }
	];

	// Field visibility options
	const fieldOptions = [
		{ key: 'services', label: 'Services Description' },
		{ key: 'commencementDate', label: 'Commencement Date' },
		{ key: 'completionDate', label: 'Completion Date' },
		{ key: 'price', label: 'Price' },
		{ key: 'paymentTerms', label: 'Payment Terms' },
		{ key: 'specialConditions', label: 'Special Conditions' }
	];

	function getStatusInfo(status: string) {
		switch (status) {
			case 'draft':
				return {
					class: 'badge-ghost',
					icon: Clock,
					label: 'Draft',
					description: 'This contract is a draft. You can edit all fields before sending.'
				};
			case 'sent':
				return {
					class: 'badge-info',
					icon: Send,
					label: 'Sent',
					description: 'This contract has been sent and is awaiting client response. You can still make edits.'
				};
			case 'viewed':
				return {
					class: 'badge-warning',
					icon: Eye,
					label: 'Viewed',
					description: 'The client has viewed this contract. You can still make edits before they sign.'
				};
			case 'signed':
				return {
					class: 'badge-success',
					icon: CheckCircle,
					label: 'Signed',
					description: 'This contract has been signed by the client. No further edits are allowed.'
				};
			case 'completed':
				return {
					class: 'badge-success',
					icon: CheckCircle,
					label: 'Completed',
					description: 'This contract is complete.'
				};
			case 'expired':
				return {
					class: 'badge-error',
					icon: AlertCircle,
					label: 'Expired',
					description: 'This contract has expired.'
				};
			default:
				return { class: 'badge-ghost', icon: Clock, label: status, description: '' };
		}
	}

	let statusInfo = $derived(getStatusInfo(contract.status));

	function toggleFieldVisibility(fieldKey: string) {
		if (visibleFields.includes(fieldKey)) {
			visibleFields = visibleFields.filter((f) => f !== fieldKey);
		} else {
			visibleFields = [...visibleFields, fieldKey];
		}
	}

	function toggleScheduleIncluded(scheduleId: string) {
		if (includedScheduleIds.includes(scheduleId)) {
			includedScheduleIds = includedScheduleIds.filter((id) => id !== scheduleId);
		} else {
			includedScheduleIds = [...includedScheduleIds, scheduleId];
		}
	}

	async function handleSave() {
		isSubmitting = true;

		try {
			await updateContract({
				contractId: contract.id,
				clientBusinessName,
				clientContactName,
				clientEmail,
				clientPhone,
				clientAddress,
				servicesDescription,
				commencementDate: commencementDate || null,
				completionDate: completionDate || null,
				specialConditions,
				totalPrice,
				priceIncludesGst,
				paymentTerms,
				validUntil: validUntil || null,
				agencySignatoryName,
				agencySignatoryTitle,
				visibleFields,
				includedScheduleIds
			});

			await invalidateAll();
			toast.success('Contract saved');
		} catch (err) {
			toast.error('Failed to save', err instanceof Error ? err.message : '');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSend() {
		if (!clientEmail) {
			toast.error('Client email is required to send the contract');
			return;
		}

		if (!confirm(`Send this contract to ${clientEmail}?`)) {
			return;
		}

		isSending = true;

		try {
			// Save first
			await handleSave();

			// Then send email
			const result = await sendContractEmail({ contractId: contract.id });
			await invalidateAll();
			if (result.success) {
				toast.success('Contract sent', `Email delivered to ${clientEmail}`);
			} else {
				toast.error('Failed to send contract', result.error || 'Unknown error');
			}
		} catch (err) {
			toast.error('Failed to send', err instanceof Error ? err.message : '');
		} finally {
			isSending = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this contract?')) {
			return;
		}

		try {
			await deleteContract(contract.id);
			toast.success('Contract deleted');
			goto(`/${agencySlug}/contracts`);
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : '');
		}
	}

	function copyPublicUrl() {
		const url = `${window.location.origin}/c/${contract.slug}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
	}

	function viewPublic() {
		window.open(`/c/${contract.slug}`, '_blank');
	}

	function openPreviewNewTab() {
		window.open(`/c/${contract.slug}?preview=true`, '_blank');
	}

	async function downloadPdf() {
		isDownloadingPdf = true;
		try {
			const response = await fetch(`/api/contracts/${contract.id}/pdf`);
			if (!response.ok) throw new Error('Failed to generate PDF');

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${contract.contractNumber}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success('PDF downloaded');
		} catch (err) {
			toast.error('Failed to download PDF', err instanceof Error ? err.message : '');
		} finally {
			isDownloadingPdf = false;
		}
	}

	function goBack() {
		goto(`/${agencySlug}/contracts`);
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

	// Group schedules by category
	let schedulesByCategory = $derived(() => {
		const grouped: Record<string, typeof availableSchedules> = {};
		for (const schedule of availableSchedules) {
			const category = schedule.sectionCategory || 'custom';
			if (!grouped[category]) {
				grouped[category] = [];
			}
			grouped[category].push(schedule);
		}
		return grouped;
	});

	const categoryLabels: Record<string, string> = {
		service_level: 'Service Level Terms',
		payment_billing: 'Payment & Billing',
		ownership: 'Ownership & IP',
		cancellation: 'Cancellation & Renewal',
		package_terms: 'Package-Specific Terms',
		custom: 'Custom Sections'
	};
</script>

<svelte:head>
	<title>Contract {contract.contractNumber} | Webkit</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<div class="navbar bg-base-100 border-b px-4">
		<div class="flex-1 gap-4">
			<button type="button" class="btn btn-ghost btn-sm" onclick={goBack}>
				<ChevronLeft class="h-4 w-4" />
				Back
			</button>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-lg font-semibold">{contract.contractNumber}</h1>
					{#if true}
						{@const StatusIcon = statusInfo.icon}
						<div class="badge {statusInfo.class} gap-1">
							<StatusIcon class="h-3 w-3" />
							{statusInfo.label}
						</div>
					{/if}
				</div>
				<p class="text-base-content/60 text-sm">{contract.clientBusinessName || 'No client'}</p>
			</div>
		</div>
		<div class="flex-none gap-2">
			<!-- Preview - always available -->
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => (activeSection = 'preview')}
			>
				<Eye class="h-4 w-4" />
				Preview
			</button>
			<!-- PDF - always available -->
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={downloadPdf}
				disabled={isDownloadingPdf}
			>
				{#if isDownloadingPdf}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<FileDown class="h-4 w-4" />
				{/if}
				PDF
			</button>
			{#if contract.status !== 'draft'}
				<button type="button" class="btn btn-ghost btn-sm" onclick={viewPublic}>
					<ExternalLink class="h-4 w-4" />
					View
				</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={copyPublicUrl}>
					<Copy class="h-4 w-4" />
					Copy Link
				</button>
			{/if}
			{#if isEditable}
				<button
					type="button"
					class="btn btn-outline btn-sm"
					onclick={handleSave}
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Save class="h-4 w-4" />
					{/if}
					Save
				</button>
				{#if canSend}
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={handleSend}
						disabled={isSending || !clientEmail}
					>
						{#if isSending}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Send class="h-4 w-4" />
						{/if}
						Send
					</button>
				{:else if canResend}
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={handleSend}
						disabled={isSending || !clientEmail}
					>
						{#if isSending}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Send class="h-4 w-4" />
						{/if}
						Resend
					</button>
				{/if}
			{/if}
		</div>
	</div>

	<div class="flex flex-1">
		<!-- Sidebar Navigation -->
		<aside class="bg-base-200 hidden w-48 shrink-0 p-4 lg:block">
			<nav class="space-y-1">
				{#each sections as section}
					{@const SectionIcon = section.icon}
					<button
						type="button"
						class="btn btn-ghost btn-sm w-full justify-start {activeSection === section.id ? 'btn-active' : ''}"
						onclick={() => (activeSection = section.id)}
					>
						<SectionIcon class="h-4 w-4" />
						{section.label}
					</button>
				{/each}
			</nav>

			{#if isEditable && contract.status === 'draft'}
				<div class="divider"></div>
				<button
					type="button"
					class="btn btn-ghost btn-sm w-full justify-start text-error"
					onclick={handleDelete}
				>
					<Trash2 class="h-4 w-4" />
					Delete
				</button>
			{/if}
		</aside>

		<!-- Main Content -->
		<main class="flex-1 overflow-y-auto p-6">
			<div class="mx-auto max-w-3xl space-y-8">
				<!-- Overview Section -->
				{#if activeSection === 'overview'}
					<section class="card bg-base-100 shadow">
						<div class="card-body">
							<h2 class="card-title">Overview</h2>

							<!-- Status Banner -->
							{#if true}
								{@const OverviewStatusIcon = statusInfo.icon}
								<div class="alert {statusInfo.class === 'badge-success' ? 'alert-success' : statusInfo.class === 'badge-error' ? 'alert-error' : statusInfo.class === 'badge-warning' ? 'alert-warning' : 'alert-info'}">
									<OverviewStatusIcon class="h-5 w-5" />
									<div>
										<p class="font-medium">{statusInfo.label}</p>
										<p class="text-sm opacity-80">{statusInfo.description}</p>
									</div>
								</div>
							{/if}

							<!-- Quick Stats -->
							<div class="grid gap-4 sm:grid-cols-3 mt-4">
								<div class="stat bg-base-200 rounded-lg p-4">
									<div class="stat-title">Contract Value</div>
									<div class="stat-value text-xl">
										{formatCurrency(contract.totalPrice)}
									</div>
									<div class="stat-desc">{contract.priceIncludesGst ? 'Inc. GST' : 'Ex. GST'}</div>
								</div>

								<div class="stat bg-base-200 rounded-lg p-4">
									<div class="stat-title">Views</div>
									<div class="stat-value text-xl">{contract.viewCount}</div>
									<div class="stat-desc">
										{contract.lastViewedAt ? `Last: ${formatDate(contract.lastViewedAt)}` : 'Not viewed'}
									</div>
								</div>

								<div class="stat bg-base-200 rounded-lg p-4">
									<div class="stat-title">Valid Until</div>
									<div class="stat-value text-lg">{formatDate(contract.validUntil)}</div>
									<div class="stat-desc">
										{contract.sentAt ? `Sent: ${formatDate(contract.sentAt)}` : 'Not sent'}
									</div>
								</div>
							</div>

							<!-- Signatures Summary -->
							{#if contract.status !== 'draft'}
								<div class="divider">Signatures</div>
								<div class="grid gap-4 sm:grid-cols-2">
									<div class="flex items-center gap-3">
										{#if contract.agencySignatoryName}
											<CheckCircle class="h-5 w-5 text-success" />
										{:else}
											<Clock class="h-5 w-5 text-base-content/40" />
										{/if}
										<div>
											<p class="font-medium">Agency</p>
											<p class="text-sm text-base-content/60">
												{contract.agencySignatoryName || 'Not signed'}
											</p>
										</div>
									</div>
									<div class="flex items-center gap-3">
										{#if contract.clientSignatoryName}
											<CheckCircle class="h-5 w-5 text-success" />
										{:else}
											<Clock class="h-5 w-5 text-base-content/40" />
										{/if}
										<div>
											<p class="font-medium">Client</p>
											<p class="text-sm text-base-content/60">
												{contract.clientSignatoryName || 'Awaiting signature'}
											</p>
										</div>
									</div>
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Preview Section -->
				{#if activeSection === 'preview'}
					<section class="card bg-base-100 shadow">
						<div class="card-body">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
								<h2 class="card-title">Contract Preview</h2>
								<div class="flex gap-2">
									<button
										type="button"
										class="btn btn-outline btn-sm"
										onclick={openPreviewNewTab}
									>
										<ExternalLink class="h-4 w-4" />
										Open in New Tab
									</button>
									<button
										type="button"
										class="btn btn-outline btn-sm"
										onclick={downloadPdf}
										disabled={isDownloadingPdf}
									>
										{#if isDownloadingPdf}
											<span class="loading loading-spinner loading-sm"></span>
										{:else}
											<FileDown class="h-4 w-4" />
										{/if}
										Download PDF
									</button>
								</div>
							</div>

							<div class="alert alert-info mt-4">
								<AlertCircle class="h-5 w-5" />
								<span>This is a preview of how the contract will appear to your client. Save any changes before previewing.</span>
							</div>

							<!-- Inline Preview iframe -->
							<div class="border border-base-300 rounded-lg mt-4 overflow-hidden bg-base-200">
								<iframe
									src="/c/{contract.slug}?preview=true"
									class="w-full bg-white"
									style="height: 800px;"
									title="Contract Preview"
								></iframe>
							</div>
						</div>
					</section>
				{/if}

				<!-- Client Section -->
				{#if activeSection === 'client'}
					<section class="card bg-base-100 shadow">
						<div class="card-body">
							<h2 class="card-title">Client Information</h2>
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="form-control">
									<label class="label" for="clientBusinessName">
										<span class="label-text font-medium">Business Name</span>
									</label>
									<input
										type="text"
										id="clientBusinessName"
										class="input input-bordered"
										bind:value={clientBusinessName}
										disabled={!isEditable}
									/>
								</div>

								<div class="form-control">
									<label class="label" for="clientContactName">
										<span class="label-text font-medium">Contact Name</span>
									</label>
									<input
										type="text"
										id="clientContactName"
										class="input input-bordered"
										bind:value={clientContactName}
										disabled={!isEditable}
									/>
								</div>

								<div class="form-control">
									<label class="label" for="clientEmail">
										<span class="label-text font-medium">Email *</span>
									</label>
									<input
										type="email"
										id="clientEmail"
										class="input input-bordered"
										bind:value={clientEmail}
										disabled={!isEditable}
										required
									/>
								</div>

								<div class="form-control">
									<label class="label" for="clientPhone">
										<span class="label-text font-medium">Phone</span>
									</label>
									<input
										type="text"
										id="clientPhone"
										class="input input-bordered"
										bind:value={clientPhone}
										disabled={!isEditable}
									/>
								</div>

								<div class="form-control sm:col-span-2">
									<label class="label" for="clientAddress">
										<span class="label-text font-medium">Address</span>
									</label>
									<textarea
										id="clientAddress"
										class="textarea textarea-bordered"
										rows="2"
										bind:value={clientAddress}
										disabled={!isEditable}
									></textarea>
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Agreement Section -->
				{#if activeSection === 'agreement'}
					<section class="card bg-base-100 shadow">
						<div class="card-body">
							<h2 class="card-title">Agreement Details</h2>
							<p class="text-base-content/60 text-sm">
								Configure which fields appear on the public contract view.
							</p>

							<!-- Field Visibility Toggles -->
							{#if isEditable}
								<div class="bg-base-200 rounded-lg p-4 mt-4">
									<h3 class="font-medium mb-3">Field Visibility</h3>
									<div class="flex flex-wrap gap-2">
										{#each fieldOptions as field}
											<label class="label cursor-pointer gap-2 bg-base-100 rounded-lg px-3 py-2">
												<input
													type="checkbox"
													class="checkbox checkbox-sm checkbox-primary"
													checked={visibleFields.includes(field.key)}
													onchange={() => toggleFieldVisibility(field.key)}
												/>
												<span class="label-text">{field.label}</span>
											</label>
										{/each}
									</div>
								</div>
							{/if}

							<div class="divider">Contract Fields</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div class="form-control">
									<label class="label" for="totalPrice">
										<span class="label-text font-medium">Total Price (AUD)</span>
										{#if !visibleFields.includes('price')}
											<span class="badge badge-ghost badge-sm">Hidden</span>
										{/if}
									</label>
									<input
										type="number"
										id="totalPrice"
										class="input input-bordered"
										bind:value={totalPrice}
										step="0.01"
										min="0"
										disabled={!isEditable}
									/>
								</div>

								<div class="form-control">
									<label class="label cursor-pointer">
										<span class="label-text font-medium">Price includes GST</span>
										<input
											type="checkbox"
											class="toggle toggle-primary"
											bind:checked={priceIncludesGst}
											disabled={!isEditable}
										/>
									</label>
								</div>

								<div class="form-control">
									<label class="label" for="validUntil">
										<span class="label-text font-medium">Valid Until</span>
									</label>
									<input
										type="date"
										id="validUntil"
										class="input input-bordered"
										bind:value={validUntil}
										disabled={!isEditable}
									/>
								</div>

								<div class="form-control">
									<label class="label" for="commencementDate">
										<span class="label-text font-medium">Commencement Date</span>
										{#if !visibleFields.includes('commencementDate')}
											<span class="badge badge-ghost badge-sm">Hidden</span>
										{/if}
									</label>
									<input
										type="date"
										id="commencementDate"
										class="input input-bordered"
										bind:value={commencementDate}
										disabled={!isEditable}
									/>
								</div>

								<div class="form-control">
									<label class="label" for="completionDate">
										<span class="label-text font-medium">Completion Date</span>
										{#if !visibleFields.includes('completionDate')}
											<span class="badge badge-ghost badge-sm">Hidden</span>
										{/if}
									</label>
									<input
										type="date"
										id="completionDate"
										class="input input-bordered"
										bind:value={completionDate}
										disabled={!isEditable}
									/>
								</div>

								<div class="form-control sm:col-span-2">
									<label class="label" for="servicesDescription">
										<span class="label-text font-medium">Services Description</span>
										{#if !visibleFields.includes('services')}
											<span class="badge badge-ghost badge-sm">Hidden</span>
										{/if}
									</label>
									<textarea
										id="servicesDescription"
										class="textarea textarea-bordered"
										rows="3"
										placeholder="Brief description of the services..."
										bind:value={servicesDescription}
										disabled={!isEditable}
									></textarea>
								</div>

								<div class="form-control sm:col-span-2">
									<label class="label" for="paymentTerms">
										<span class="label-text font-medium">Payment Terms</span>
										{#if !visibleFields.includes('paymentTerms')}
											<span class="badge badge-ghost badge-sm">Hidden</span>
										{/if}
									</label>
									<textarea
										id="paymentTerms"
										class="textarea textarea-bordered"
										rows="2"
										bind:value={paymentTerms}
										disabled={!isEditable}
									></textarea>
								</div>

								<div class="form-control sm:col-span-2">
									<label class="label" for="specialConditions">
										<span class="label-text font-medium">Special Conditions</span>
										{#if !visibleFields.includes('specialConditions')}
											<span class="badge badge-ghost badge-sm">Hidden</span>
										{/if}
									</label>
									<textarea
										id="specialConditions"
										class="textarea textarea-bordered"
										rows="3"
										placeholder="Any special conditions for this contract..."
										bind:value={specialConditions}
										disabled={!isEditable}
									></textarea>
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Schedule Section -->
				{#if activeSection === 'schedule'}
					<section class="card bg-base-100 shadow">
						<div class="card-body">
							<h2 class="card-title">Schedule A Sections</h2>
							<p class="text-base-content/60 text-sm">
								Select which schedule sections to include in this contract. These appear after the core agreement.
							</p>

							{#if availableSchedules.length === 0}
								<div class="alert alert-info mt-4">
									<AlertCircle class="h-5 w-5" />
									<div>
										<p class="font-medium">No schedule sections available</p>
										<p class="text-sm">Create schedule sections in your contract template settings.</p>
									</div>
								</div>
							{:else}
								<div class="space-y-4 mt-4">
									{#each Object.entries(schedulesByCategory()) as [category, schedules]}
										<div class="collapse collapse-arrow bg-base-200">
											<input type="checkbox" checked />
											<div class="collapse-title font-medium">
												{categoryLabels[category] || category}
												<span class="badge badge-sm ml-2">{schedules.length}</span>
											</div>
											<div class="collapse-content">
												<div class="space-y-2">
													{#each schedules as schedule}
														<label class="label cursor-pointer justify-start gap-3 bg-base-100 rounded-lg p-3">
															<input
																type="checkbox"
																class="checkbox checkbox-primary"
																checked={includedScheduleIds.includes(schedule.id)}
																onchange={() => toggleScheduleIncluded(schedule.id)}
																disabled={!isEditable}
															/>
															<div class="flex-1">
																<p class="font-medium">{schedule.name}</p>
																{#if schedule.packageName}
																	<p class="text-sm text-base-content/60">
																		Package: {schedule.packageName}
																	</p>
																{/if}
															</div>
														</label>
													{/each}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							{#if includedScheduleIds.length > 0}
								<div class="divider">Preview ({includedScheduleIds.length} sections selected)</div>
								<div class="prose prose-sm max-w-none">
									{#each availableSchedules.filter((s) => includedScheduleIds.includes(s.id)) as schedule}
										<div class="border-b border-base-200 pb-4 mb-4 last:border-0">
											<h4 class="text-base font-semibold">{schedule.name}</h4>
											{@html schedule.content}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Signatures Section -->
				{#if activeSection === 'signatures'}
					<section class="card bg-base-100 shadow">
						<div class="card-body">
							<h2 class="card-title">Signatures</h2>

							<!-- Agency Signature -->
							<div class="bg-base-200 rounded-lg p-4 mt-4">
								<h3 class="font-medium mb-3">Agency Signature</h3>
								<div class="grid gap-4 sm:grid-cols-2">
									<div class="form-control">
										<label class="label" for="agencySignatoryName">
											<span class="label-text font-medium">Signatory Name</span>
										</label>
										<input
											type="text"
											id="agencySignatoryName"
											class="input input-bordered"
											bind:value={agencySignatoryName}
											disabled={!isEditable}
										/>
									</div>

									<div class="form-control">
										<label class="label" for="agencySignatoryTitle">
											<span class="label-text font-medium">Signatory Title</span>
										</label>
										<input
											type="text"
											id="agencySignatoryTitle"
											class="input input-bordered"
											placeholder="e.g., Director"
											bind:value={agencySignatoryTitle}
											disabled={!isEditable}
										/>
									</div>
								</div>

								{#if contract.agencySignedAt}
									<p class="text-sm text-success mt-2 flex items-center gap-1">
										<CheckCircle class="h-4 w-4" />
										Signed on {formatDate(contract.agencySignedAt)}
									</p>
								{/if}
							</div>

							<!-- Client Signature -->
							<div class="bg-base-200 rounded-lg p-4 mt-4">
								<h3 class="font-medium mb-3">Client Signature</h3>
								{#if contract.clientSignatoryName}
									<div class="flex items-center gap-3">
										<CheckCircle class="h-8 w-8 text-success" />
										<div>
											<p class="font-medium">{contract.clientSignatoryName}</p>
											{#if contract.clientSignatoryTitle}
												<p class="text-sm text-base-content/60">{contract.clientSignatoryTitle}</p>
											{/if}
											<p class="text-sm text-success">
												Signed on {formatDate(contract.clientSignedAt)}
											</p>
										</div>
									</div>
								{:else}
									<p class="text-base-content/60">Awaiting client signature</p>
									{#if contract.status !== 'draft'}
										<p class="text-sm text-base-content/40 mt-1">
											The client will sign when they access the public contract link.
										</p>
									{/if}
								{/if}
							</div>
						</div>
					</section>
				{/if}

				<!-- History Section -->
				{#if activeSection === 'history'}
					<section class="card bg-base-100 shadow">
						<div class="card-body">
							<h2 class="card-title">Activity & History</h2>

							<!-- Activity Stats -->
							{#if contract.status !== 'draft'}
								<div class="grid gap-4 sm:grid-cols-3 mt-4">
									<div>
										<span class="text-sm text-base-content/60">Views</span>
										<p class="font-medium">{contract.viewCount}</p>
									</div>
									<div>
										<span class="text-sm text-base-content/60">Last Viewed</span>
										<p class="font-medium">{formatDate(contract.lastViewedAt)}</p>
									</div>
									<div>
										<span class="text-sm text-base-content/60">Sent At</span>
										<p class="font-medium">{formatDate(contract.sentAt)}</p>
									</div>
								</div>
								<div class="divider">Email History</div>
							{/if}

							<EmailHistory contractId={contract.id} />
						</div>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>

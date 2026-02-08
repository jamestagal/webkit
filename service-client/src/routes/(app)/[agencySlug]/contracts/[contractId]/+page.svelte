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
	import { updateContract, deleteContract, regenerateContractTerms, linkTemplateToContract } from '$lib/api/contracts.remote';
	import { sendContractEmail } from '$lib/api/email.remote';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import EmailHistory from '$lib/components/emails/EmailHistory.svelte';
	import SendEmailModal from '$lib/components/shared/SendEmailModal.svelte';
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
		FileDown,
		MoreHorizontal,
		RefreshCw,
		Link2
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let contract = $derived(data.contract);
	let availableSchedules = $derived(data.availableSchedules);
	let availableTemplates = $derived(data.availableTemplates);

	let isSubmitting = $state(false);
	let isDownloadingPdf = $state(false);
	let isRegeneratingTerms = $state(false);
	let isLinkingTemplate = $state(false);
	let showTemplatePicker = $state(false);
	let showRegenerateConfirm = $state(false);
	let selectedTemplateId = $state<string | null>(null);
	let activeSection = $state('overview');

	// Send email modal state
	let sendModalOpen = $state(false);
	let sendingEmail = $state(false);
	let isResend = $state(false);

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
			? new Date(contract.commencementDate).toISOString().split('T')[0] ?? ''
			: '';
		completionDate = contract.completionDate
			? new Date(contract.completionDate).toISOString().split('T')[0] ?? ''
			: '';
		specialConditions = contract.specialConditions || '';
		totalPrice = contract.totalPrice || '';
		priceIncludesGst = contract.priceIncludesGst ?? true;
		paymentTerms = contract.paymentTerms || '';
		validUntil = contract.validUntil
			? new Date(contract.validUntil).toISOString().split('T')[0] ?? ''
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

	function openSendModal(resend = false) {
		if (!clientEmail) {
			toast.error('Client email is required to send the contract');
			return;
		}
		isResend = resend;
		sendModalOpen = true;
	}

	async function confirmSendEmail() {
		sendingEmail = true;

		try {
			// Save first
			await handleSave();

			// Then send email
			const result = await sendContractEmail({ contractId: contract.id });
			await invalidateAll();
			sendModalOpen = false;
			if (result.success) {
				toast.success(isResend ? 'Contract resent' : 'Contract sent', `Email delivered to ${clientEmail}`);
			} else {
				toast.error('Failed to send contract', result.error || 'Unknown error');
			}
		} catch (err) {
			toast.error('Failed to send', err instanceof Error ? err.message : '');
		} finally {
			sendingEmail = false;
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

	function handleRegenerateTerms() {
		if (!contract.templateId) {
			// No template linked - show template picker
			if (availableTemplates.length === 0) {
				toast.error('No templates available', 'Create a contract template first in Settings → Contracts');
				return;
			}
			// Pre-select first template
			selectedTemplateId = availableTemplates[0]!.id;
			showTemplatePicker = true;
			return;
		}

		// Template is linked - show regenerate confirmation modal
		showRegenerateConfirm = true;
	}

	async function confirmRegenerateTerms() {
		showRegenerateConfirm = false;
		isRegeneratingTerms = true;
		try {
			await regenerateContractTerms(contract.id);
			await invalidateAll();
			toast.success('Terms regenerated', 'Terms & Conditions updated from template');
		} catch (err) {
			toast.error('Failed to regenerate terms', err instanceof Error ? err.message : '');
		} finally {
			isRegeneratingTerms = false;
		}
	}

	async function handleLinkTemplate() {
		if (!selectedTemplateId) {
			toast.error('Please select a template');
			return;
		}

		isLinkingTemplate = true;
		try {
			await linkTemplateToContract({
				contractId: contract.id,
				templateId: selectedTemplateId
			});
			await invalidateAll();
			showTemplatePicker = false;
			toast.success('Template linked', 'Terms & Conditions generated from template');
		} catch (err) {
			toast.error('Failed to link template', err instanceof Error ? err.message : '');
		} finally {
			isLinkingTemplate = false;
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
	<div class="bg-base-100 border-b border-base-300">
		<div class="card-body p-4">
				<!-- Top row: Back button + Title -->
				<div class="flex items-start gap-3">
					<button type="button" class="btn btn-ghost btn-sm btn-square shrink-0" onclick={goBack}>
						<ChevronLeft class="h-4 w-4" />
					</button>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2 flex-wrap">
							<h1 class="text-lg font-semibold">{contract.contractNumber}</h1>
							{#if true}
								{@const StatusIcon = statusInfo.icon}
								<div class="badge {statusInfo.class} gap-1 whitespace-nowrap">
									<StatusIcon class="h-3 w-3" />
									{statusInfo.label}
								</div>
							{/if}
						</div>
						<p class="text-base-content/60 text-sm truncate">{contract.clientBusinessName || 'No client'}</p>
					</div>
				</div>
				<!-- Bottom row: Action buttons -->
				<div class="flex flex-wrap items-center justify-center sm:justify-between gap-2 mt-3 pt-3 border-t border-base-200">
					<!-- Primary actions always visible -->
					<div class="flex flex-wrap items-center justify-center gap-2">
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
									onclick={() => openSendModal(false)}
									disabled={sendingEmail || !clientEmail}
								>
									{#if sendingEmail}
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
									onclick={() => openSendModal(true)}
									disabled={sendingEmail || !clientEmail}
								>
									{#if sendingEmail}
										<span class="loading loading-spinner loading-sm"></span>
									{:else}
										<Send class="h-4 w-4" />
									{/if}
									Resend
								</button>
							{/if}
						{/if}
					</div>
					<!-- Secondary actions in dropdown -->
					<div class="dropdown dropdown-end">
						<button type="button" tabindex="0" class="btn btn-outline btn-sm gap-1">
							<MoreHorizontal class="h-4 w-4" />
							More
						</button>
						<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
							<li>
								<button type="button" onclick={() => (activeSection = 'preview')}>
									<Eye class="h-4 w-4" />
									Preview
								</button>
							</li>
							<li>
								<button type="button" onclick={downloadPdf} disabled={isDownloadingPdf}>
									<FileDown class="h-4 w-4" />
									Download PDF
								</button>
							</li>
							{#if isEditable}
								<li>
									<button type="button" onclick={handleRegenerateTerms} disabled={isRegeneratingTerms || isLinkingTemplate}>
										{#if contract.templateId}
											<RefreshCw class="h-4 w-4 {isRegeneratingTerms ? 'animate-spin' : ''}" />
											Regenerate Terms
										{:else}
											<Link2 class="h-4 w-4" />
											Link Template
										{/if}
									</button>
								</li>
							{/if}
							{#if contract.status !== 'draft'}
								<li>
									<button type="button" onclick={viewPublic}>
										<ExternalLink class="h-4 w-4" />
										View Public Page
									</button>
								</li>
								<li>
									<button type="button" onclick={copyPublicUrl}>
										<Copy class="h-4 w-4" />
										Copy Link
									</button>
								</li>
							{/if}
						</ul>
					</div>
				</div>
			</div>
		</div>

	<!-- Mobile Section Navigation -->
	<div class="lg:hidden border-b border-base-300 bg-base-100">
		<div class="flex overflow-x-auto px-2 py-2 gap-1 scrollbar-none">
			{#each sections as section}
				{@const SectionIcon = section.icon}
				<button
					type="button"
					class="btn btn-sm shrink-0 gap-1 {activeSection === section.id ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => (activeSection = section.id)}
				>
					<SectionIcon class="h-3.5 w-3.5" />
					{section.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex flex-1">
		<!-- Sidebar Navigation (Desktop only) -->
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
		<main class="flex-1 overflow-y-auto py-4 lg:p-6">
			<div class="mx-auto max-w-3xl space-y-4 lg:space-y-6">
				<!-- Overview Section -->
				{#if activeSection === 'overview'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
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
					<section class="bg-base-100 shadow-sm lg:rounded-lg lg:mx-0">
						<div class="p-3 sm:p-4">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<h2 class="font-semibold">Contract Preview</h2>
								<div class="flex flex-wrap gap-2">
									<button
										type="button"
										class="btn btn-outline btn-sm"
										onclick={openPreviewNewTab}
									>
										<ExternalLink class="h-4 w-4" />
										New Tab
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
										PDF
									</button>
								</div>
							</div>

							<div class="alert alert-info py-2 mt-3 text-sm">
								<AlertCircle class="h-4 w-4" />
								<span>Preview of how clients will see the contract. Save changes first.</span>
							</div>
						</div>

						<!-- Inline Preview iframe - full width -->
						<div class="border-t border-base-300 overflow-hidden bg-base-200">
							<iframe
								src="/c/{contract.slug}?preview=true"
								class="w-full bg-white"
								style="height: 75vh; min-height: 500px;"
								title="Contract Preview"
							></iframe>
						</div>
					</section>
				{/if}

				<!-- Client Section -->
				{#if activeSection === 'client'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
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
										class="textarea textarea-bordered w-full"
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
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
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
										class="textarea textarea-bordered w-full"
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
										class="textarea textarea-bordered w-full"
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
										class="textarea textarea-bordered w-full"
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
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
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
											{@html sanitizeHtml(schedule.content)}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Signatures Section -->
				{#if activeSection === 'signatures'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
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
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
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

<!-- Template Picker Modal -->
{#if showTemplatePicker}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg flex items-center gap-2">
				<Link2 class="h-5 w-5" />
				Link Contract Template
			</h3>
			<p class="text-base-content/70 mt-2">
				Select a template to link to this contract. The template's terms and conditions will be applied.
			</p>

			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text font-medium">Select Template</span>
				</label>
				<div class="space-y-2">
					{#each availableTemplates as template (template.id)}
						<label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-base-200 transition-colors {selectedTemplateId === template.id ? 'border-primary bg-primary/5' : 'border-base-300'}">
							<input
								type="radio"
								name="template"
								class="radio radio-primary"
								checked={selectedTemplateId === template.id}
								onchange={() => selectedTemplateId = template.id}
							/>
							<div class="flex-1">
								<div class="font-medium">{template.name}</div>
								{#if template.description}
									<div class="text-sm text-base-content/60">{template.description}</div>
								{/if}
							</div>
							{#if template.isDefault}
								<span class="badge badge-primary badge-sm">Default</span>
							{/if}
						</label>
					{/each}
				</div>
			</div>

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => showTemplatePicker = false}
					disabled={isLinkingTemplate}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-primary"
					onclick={handleLinkTemplate}
					disabled={!selectedTemplateId || isLinkingTemplate}
				>
					{#if isLinkingTemplate}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Link & Generate Terms
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => showTemplatePicker = false}>close</button>
		</form>
	</dialog>
{/if}

<!-- Regenerate Terms Confirmation Modal -->
{#if showRegenerateConfirm}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg flex items-center gap-2">
				<RefreshCw class="h-5 w-5" />
				Regenerate Terms & Conditions
			</h3>
			<p class="text-base-content/70 mt-4">
				This will regenerate the Terms & Conditions from the linked template. Any manual edits to the current terms will be replaced.
			</p>
			<div class="alert alert-warning mt-4">
				<AlertCircle class="h-4 w-4" />
				<span class="text-sm">This action cannot be undone.</span>
			</div>

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => showRegenerateConfirm = false}
					disabled={isRegeneratingTerms}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-primary"
					onclick={confirmRegenerateTerms}
					disabled={isRegeneratingTerms}
				>
					{#if isRegeneratingTerms}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Regenerate Terms
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => showRegenerateConfirm = false}>close</button>
		</form>
	</dialog>
{/if}

<!-- Send Email Modal -->
<SendEmailModal
	open={sendModalOpen}
	title={isResend ? 'Resend Contract' : 'Send Contract'}
	documentType="contract"
	recipientEmail={clientEmail}
	recipientName={clientContactName || clientBusinessName}
	loading={sendingEmail}
	onConfirm={confirmSendEmail}
	onCancel={() => sendModalOpen = false}
/>

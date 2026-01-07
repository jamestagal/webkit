<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateContract, sendContract, deleteContract } from '$lib/api/contracts.remote';
	import { sendContractEmail } from '$lib/api/email.remote';
	import EmailHistory from '$lib/components/emails/EmailHistory.svelte';
	import QuestionnaireView from '$lib/components/questionnaire/QuestionnaireView.svelte';
	import {
		Save,
		ArrowLeft,
		Send,
		ExternalLink,
		Copy,
		Trash2,
		CheckCircle,
		Clock,
		Eye,
		AlertCircle
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let contract = $derived(data.contract);
	let questionnaire = $derived(data.questionnaire);

	let isSubmitting = $state(false);
	let isSending = $state(false);

	// Form state - editable fields
	let clientBusinessName = $state(contract.clientBusinessName);
	let clientContactName = $state(contract.clientContactName);
	let clientEmail = $state(contract.clientEmail);
	let clientPhone = $state(contract.clientPhone);
	let clientAddress = $state(contract.clientAddress);
	let servicesDescription = $state(contract.servicesDescription);
	let commencementDate = $state(
		contract.commencementDate
			? new Date(contract.commencementDate).toISOString().split('T')[0]
			: ''
	);
	let completionDate = $state(
		contract.completionDate
			? new Date(contract.completionDate).toISOString().split('T')[0]
			: ''
	);
	let specialConditions = $state(contract.specialConditions);
	let totalPrice = $state(contract.totalPrice);
	let paymentTerms = $state(contract.paymentTerms);
	let validUntil = $state(
		contract.validUntil
			? new Date(contract.validUntil).toISOString().split('T')[0]
			: ''
	);
	let agencySignatoryName = $state(contract.agencySignatoryName || '');
	let agencySignatoryTitle = $state(contract.agencySignatoryTitle || '');

	let isEditable = $derived(contract.status === 'draft');

	function getStatusInfo(status: string) {
		switch (status) {
			case 'draft':
				return {
					class: 'badge-ghost',
					icon: Clock,
					label: 'Draft',
					description: 'This contract is a draft and can be edited before sending.'
				};
			case 'sent':
				return {
					class: 'badge-info',
					icon: Send,
					label: 'Sent',
					description: 'This contract has been sent and is awaiting client response.'
				};
			case 'viewed':
				return {
					class: 'badge-warning',
					icon: Eye,
					label: 'Viewed',
					description: 'The client has viewed this contract.'
				};
			case 'signed':
				return {
					class: 'badge-success',
					icon: CheckCircle,
					label: 'Signed',
					description: 'This contract has been signed by the client.'
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

	async function handleSave() {
		if (!isEditable) return;

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
				paymentTerms,
				validUntil: validUntil || null,
				agencySignatoryName,
				agencySignatoryTitle
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
				paymentTerms,
				validUntil: validUntil || null,
				agencySignatoryName,
				agencySignatoryTitle
			});

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

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-bold">{contract.contractNumber}</h1>
				<div class="badge {statusInfo.class} gap-1">
					<statusInfo.icon class="h-3 w-3" />
					{statusInfo.label}
				</div>
			</div>
			<p class="text-base-content/70 mt-1">{statusInfo.description}</p>
		</div>

		<div class="flex flex-wrap gap-2">
			{#if contract.status !== 'draft'}
				<a
					href="/c/{contract.slug}"
					target="_blank"
					class="btn btn-ghost btn-sm"
				>
					<ExternalLink class="h-4 w-4" />
					View Public
				</a>
				<button type="button" class="btn btn-ghost btn-sm" onclick={copyPublicUrl}>
					<Copy class="h-4 w-4" />
					Copy Link
				</button>
			{/if}

			{#if isEditable}
				<button
					type="button"
					class="btn btn-ghost btn-sm text-error"
					onclick={handleDelete}
				>
					<Trash2 class="h-4 w-4" />
					Delete
				</button>
			{/if}
		</div>
	</div>

	<!-- Signature Info (for signed contracts) -->
	{#if contract.status === 'signed' || contract.status === 'completed'}
		<div class="alert alert-success">
			<CheckCircle class="h-5 w-5" />
			<div>
				<p class="font-medium">
					Signed by {contract.clientSignatoryName}
					{contract.clientSignatoryTitle ? `(${contract.clientSignatoryTitle})` : ''}
				</p>
				<p class="text-sm opacity-80">
					{formatDate(contract.clientSignedAt)}
				</p>
			</div>
		</div>

		<!-- Website Questionnaire - Prominent placement for signed contracts -->
		<div class="card bg-base-100 border-2 border-primary/30">
			<div class="card-body">
				<QuestionnaireView {questionnaire} contractSlug={contract.slug} />
			</div>
		</div>
	{/if}

	<!-- Client Information -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Client Information</h2>

			<div class="grid gap-4 sm:grid-cols-2 mt-4">
				<div class="form-control">
					<label class="label" for="clientBusinessName">
						<span class="label-text font-medium">Business Name</span>
					</label>
					<input
						type="text"
						id="clientBusinessName"
						bind:value={clientBusinessName}
						class="input input-bordered"
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
						bind:value={clientContactName}
						class="input input-bordered"
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
						bind:value={clientEmail}
						class="input input-bordered"
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
						bind:value={clientPhone}
						class="input input-bordered"
						disabled={!isEditable}
					/>
				</div>

				<div class="form-control sm:col-span-2">
					<label class="label" for="clientAddress">
						<span class="label-text font-medium">Address</span>
					</label>
					<textarea
						id="clientAddress"
						bind:value={clientAddress}
						class="textarea textarea-bordered"
						rows="2"
						disabled={!isEditable}
					></textarea>
				</div>
			</div>
		</div>
	</div>

	<!-- Contract Details -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Contract Details</h2>

			<div class="grid gap-4 sm:grid-cols-2 mt-4">
				<div class="form-control">
					<label class="label" for="totalPrice">
						<span class="label-text font-medium">Total Price (AUD)</span>
					</label>
					<input
						type="number"
						id="totalPrice"
						bind:value={totalPrice}
						class="input input-bordered"
						step="0.01"
						min="0"
						disabled={!isEditable}
					/>
				</div>

				<div class="form-control">
					<label class="label" for="validUntil">
						<span class="label-text font-medium">Valid Until</span>
					</label>
					<input
						type="date"
						id="validUntil"
						bind:value={validUntil}
						class="input input-bordered"
						disabled={!isEditable}
					/>
				</div>

				<div class="form-control">
					<label class="label" for="commencementDate">
						<span class="label-text font-medium">Commencement Date</span>
					</label>
					<input
						type="date"
						id="commencementDate"
						bind:value={commencementDate}
						class="input input-bordered"
						disabled={!isEditable}
					/>
				</div>

				<div class="form-control">
					<label class="label" for="completionDate">
						<span class="label-text font-medium">Completion Date</span>
					</label>
					<input
						type="date"
						id="completionDate"
						bind:value={completionDate}
						class="input input-bordered"
						disabled={!isEditable}
					/>
				</div>

				<div class="form-control sm:col-span-2">
					<label class="label" for="servicesDescription">
						<span class="label-text font-medium">Services Description</span>
					</label>
					<textarea
						id="servicesDescription"
						bind:value={servicesDescription}
						class="textarea textarea-bordered"
						rows="3"
						placeholder="Brief description of the services..."
						disabled={!isEditable}
					></textarea>
				</div>

				<div class="form-control sm:col-span-2">
					<label class="label" for="paymentTerms">
						<span class="label-text font-medium">Payment Terms</span>
					</label>
					<textarea
						id="paymentTerms"
						bind:value={paymentTerms}
						class="textarea textarea-bordered"
						rows="2"
						disabled={!isEditable}
					></textarea>
				</div>

				<div class="form-control sm:col-span-2">
					<label class="label" for="specialConditions">
						<span class="label-text font-medium">Special Conditions</span>
					</label>
					<textarea
						id="specialConditions"
						bind:value={specialConditions}
						class="textarea textarea-bordered"
						rows="3"
						placeholder="Any special conditions for this contract..."
						disabled={!isEditable}
					></textarea>
				</div>
			</div>
		</div>
	</div>

	<!-- Agency Signature -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Agency Signature</h2>

			<div class="grid gap-4 sm:grid-cols-2 mt-4">
				<div class="form-control">
					<label class="label" for="agencySignatoryName">
						<span class="label-text font-medium">Signatory Name</span>
					</label>
					<input
						type="text"
						id="agencySignatoryName"
						bind:value={agencySignatoryName}
						class="input input-bordered"
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
						bind:value={agencySignatoryTitle}
						class="input input-bordered"
						placeholder="e.g., Director"
						disabled={!isEditable}
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- View Count & Tracking -->
	{#if contract.status !== 'draft'}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-lg">Activity</h2>

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
			</div>
		</div>
	{/if}

	<!-- Email History -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<EmailHistory contractId={contract.id} />
		</div>
	</div>

	<!-- Actions -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<a href="/{agencySlug}/contracts" class="btn btn-ghost">
			<ArrowLeft class="h-4 w-4" />
			Back to Contracts
		</a>

		{#if isEditable}
			<div class="flex gap-2">
				<button
					type="button"
					class="btn btn-ghost"
					disabled={isSubmitting}
					onclick={handleSave}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Save class="h-4 w-4" />
					{/if}
					Save Draft
				</button>

				<button
					type="button"
					class="btn btn-primary"
					disabled={isSending || !clientEmail}
					onclick={handleSend}
				>
					{#if isSending}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Send class="h-4 w-4" />
					{/if}
					Send to Client
				</button>
			</div>
		{/if}
	</div>
</div>

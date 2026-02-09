<script lang="ts">
	/**
	 * Create New Proposal Page
	 *
	 * Allows user to create a proposal from:
	 * 1. An existing consultation (pre-fills client data)
	 * 2. Standalone (manual entry)
	 *
	 * Supports ?clientId= URL param to filter/highlight consultations for that client.
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getCompletedConsultations } from '$lib/api/consultation.remote';
	import { getActivePackages } from '$lib/api/agency-packages.remote';
	import { createProposal } from '$lib/api/proposals.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { FileText, Users, ArrowRight, Package, UserCircle } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/formatting';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const toast = getToast();
	const agencySlug = page.params.agencySlug;

	// Pre-fill from clientId URL param (Quick Create from Client Hub)
	const prefillClientId = data.prefillClientId;
	const prefillClientName = data.prefillClientName;

	// State
	let selectedConsultationId = $state<string | null>(null);
	let selectedPackageId = $state<string | null>(null);
	let proposalTitle = $state('Website Proposal');
	let isCreating = $state(false);
	let step = $state<'consultation' | 'package' | 'confirm'>('consultation');

	// Load data - getCompletedConsultations returns only completed consultations
	const allConsultations = await getCompletedConsultations();
	const packages = await getActivePackages();

	// Sort consultations: those matching prefillClientId first
	const completedConsultations = prefillClientId
		? [...allConsultations].sort((a, b) => {
				const aMatch = a.clientId === prefillClientId ? 0 : 1;
				const bMatch = b.clientId === prefillClientId ? 0 : 1;
				return aMatch - bMatch;
			})
		: allConsultations;

	// Selected data
	let selectedConsultation = $derived(
		completedConsultations.find((c) => c.id === selectedConsultationId)
	);
	let selectedPackage = $derived(packages.find((p) => p.id === selectedPackageId));

	function selectConsultation(id: string | null) {
		selectedConsultationId = id;
		step = 'package';
	}

	function selectPackage(id: string | null) {
		selectedPackageId = id;
		step = 'confirm';
	}

	function goBack() {
		if (step === 'package') {
			step = 'consultation';
		} else if (step === 'confirm') {
			step = 'package';
		}
	}

	async function handleCreate() {
		isCreating = true;
		try {
			const proposal = await createProposal({
				consultationId: selectedConsultationId || undefined,
				selectedPackageId: selectedPackageId || undefined,
				title: proposalTitle
			});

			if (proposal) {
				toast.success('Proposal created');
				goto(`/${agencySlug}/proposals/${proposal.id}`);
			}
		} catch (err) {
			toast.error('Failed to create proposal', err instanceof Error ? err.message : 'Unknown error');
		} finally {
			isCreating = false;
		}
	}
</script>

<svelte:head>
	<title>New Proposal | Webkit</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold">Create New Proposal</h1>
		<p class="text-base-content/70 mt-1">
			{#if step === 'consultation'}
				Select a consultation to pre-fill client information, or start fresh.
			{:else if step === 'package'}
				Choose a package for this proposal.
			{:else}
				Review and confirm your proposal details.
			{/if}
		</p>
	</div>

	<!-- Client Context Banner (from Quick Create) -->
	{#if prefillClientName}
		<div class="alert bg-primary/10 border-primary/20">
			<UserCircle class="h-5 w-5 text-primary" />
			<span>Creating proposal for <strong>{prefillClientName}</strong></span>
		</div>
	{/if}

	<!-- Steps Indicator -->
	<ul class="steps w-full">
		<li class="step {step === 'consultation' || step === 'package' || step === 'confirm' ? 'step-primary' : ''}">
			Client
		</li>
		<li class="step {step === 'package' || step === 'confirm' ? 'step-primary' : ''}">
			Package
		</li>
		<li class="step {step === 'confirm' ? 'step-primary' : ''}">
			Confirm
		</li>
	</ul>

	<!-- Step 1: Select Consultation -->
	{#if step === 'consultation'}
		<div class="space-y-4">
			<!-- Standalone Option -->
			<button
				type="button"
				class="card bg-base-100 w-full cursor-pointer shadow transition-all hover:shadow-md {selectedConsultationId === null ? 'ring-2 ring-primary' : ''}"
				onclick={() => selectConsultation(null)}
			>
				<div class="card-body flex-row items-center gap-4">
					<div class="rounded-lg bg-base-200 p-3">
						<FileText class="h-6 w-6" />
					</div>
					<div class="flex-1 text-left">
						<h3 class="font-semibold">Standalone Proposal</h3>
						<p class="text-base-content/60 text-sm">Create without linking to a consultation</p>
					</div>
					<ArrowRight class="h-5 w-5 text-base-content/40" />
				</div>
			</button>

			{#if completedConsultations.length > 0}
				<div class="divider">Or select from consultations</div>

				{#each completedConsultations as consultation}
					<button
						type="button"
						class="card bg-base-100 w-full cursor-pointer shadow transition-all hover:shadow-md {selectedConsultationId === consultation.id ? 'ring-2 ring-primary' : ''}"
						onclick={() => selectConsultation(consultation.id)}
					>
						<div class="card-body flex-row items-center gap-4">
							<div class="rounded-lg bg-base-200 p-3">
								<Users class="h-6 w-6" />
							</div>
							<div class="flex-1 text-left">
								<h3 class="font-semibold">
									{consultation.businessName || 'Untitled'}
								</h3>
								<p class="text-base-content/60 text-sm">
									{consultation.contactPerson || 'No contact'} &bull;
									{formatDate(consultation.createdAt)}
								</p>
							</div>
							<div class="badge badge-success">Completed</div>
							<ArrowRight class="h-5 w-5 text-base-content/40" />
						</div>
					</button>
				{/each}
			{:else}
				<div class="alert">
					<span>No consultations found. You can create a standalone proposal.</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Step 2: Select Package -->
	{#if step === 'package'}
		<div class="space-y-4">
			<!-- No Package Option -->
			<button
				type="button"
				class="card bg-base-100 w-full cursor-pointer shadow transition-all hover:shadow-md {selectedPackageId === null ? 'ring-2 ring-primary' : ''}"
				onclick={() => selectPackage(null)}
			>
				<div class="card-body flex-row items-center gap-4">
					<div class="rounded-lg bg-base-200 p-3">
						<FileText class="h-6 w-6" />
					</div>
					<div class="flex-1 text-left">
						<h3 class="font-semibold">Custom Pricing</h3>
						<p class="text-base-content/60 text-sm">Set up custom pricing in the editor</p>
					</div>
					<ArrowRight class="h-5 w-5 text-base-content/40" />
				</div>
			</button>

			{#if packages.length > 0}
				<div class="divider">Or select a package</div>

				{#each packages as pkg}
					<button
						type="button"
						class="card bg-base-100 w-full cursor-pointer shadow transition-all hover:shadow-md {selectedPackageId === pkg.id ? 'ring-2 ring-primary' : ''}"
						onclick={() => selectPackage(pkg.id)}
					>
						<div class="card-body flex-row items-center gap-4">
							<div class="rounded-lg bg-primary/10 p-3">
								<Package class="h-6 w-6 text-primary" />
							</div>
							<div class="flex-1 text-left">
								<div class="flex items-center gap-2">
									<h3 class="font-semibold">{pkg.name}</h3>
									{#if pkg.isFeatured}
										<span class="badge badge-primary badge-sm">Featured</span>
									{/if}
								</div>
								<p class="text-base-content/60 line-clamp-1 text-sm">
									{pkg.description || 'No description'}
								</p>
							</div>
							<div class="text-right">
								{#if parseFloat(pkg.monthlyPrice) > 0}
									<div class="font-semibold">${pkg.monthlyPrice}/mo</div>
								{/if}
								{#if parseFloat(pkg.setupFee) > 0}
									<div class="text-base-content/60 text-sm">+${pkg.setupFee} setup</div>
								{/if}
							</div>
							<ArrowRight class="h-5 w-5 text-base-content/40" />
						</div>
					</button>
				{/each}
			{:else}
				<div class="alert">
					<span>No packages configured. <a href="/{agencySlug}/settings/packages" class="link">Create packages</a> first, or continue with custom pricing.</span>
				</div>
			{/if}

			<button type="button" class="btn btn-ghost" onclick={goBack}>
				Back
			</button>
		</div>
	{/if}

	<!-- Step 3: Confirm -->
	{#if step === 'confirm'}
		<div class="card bg-base-100 shadow">
			<div class="card-body space-y-4">
				<h2 class="card-title">Proposal Details</h2>

				<!-- Title -->
				<div class="form-control">
					<label class="label" for="proposal-title">
						<span class="label-text">Proposal Title</span>
					</label>
					<input
						type="text"
						id="proposal-title"
						class="input input-bordered"
						bind:value={proposalTitle}
						placeholder="Website Proposal"
					/>
				</div>

				<!-- Summary -->
				<div class="rounded-lg bg-base-200 p-4">
					<dl class="grid gap-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-base-content/60">Client</dt>
							<dd class="font-medium">
								{selectedConsultation
									? selectedConsultation.businessName || 'Untitled'
									: 'Standalone (manual entry)'}
							</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-base-content/60">Package</dt>
							<dd class="font-medium">
								{selectedPackage ? selectedPackage.name : 'Custom Pricing'}
							</dd>
						</div>
					</dl>
				</div>

				<!-- Actions -->
				<div class="card-actions justify-between pt-4">
					<button type="button" class="btn btn-ghost" onclick={goBack}>
						Back
					</button>
					<button
						type="button"
						class="btn btn-primary"
						onclick={handleCreate}
						disabled={isCreating}
					>
						{#if isCreating}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Create Proposal
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

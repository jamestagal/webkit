<script lang="ts">
	/**
	 * Agency-Scoped Consultation History Page
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getUserConsultations } from '$lib/api/consultation.remote';
	import { FEATURES } from '$lib/config/features';
	import { Plus } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';

	const feature = FEATURES.consultations;

	// Get agency slug from URL
	const agencySlug = page.params.agencySlug;

	// Load consultations using remote function
	const consultations = await getUserConsultations();

	function formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		const d = new Date(date);
		const datePart = d.toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
		const timePart = d.toLocaleTimeString('en-AU', {
			hour: '2-digit',
			minute: '2-digit'
		});
		return `${datePart}, ${timePart}`;
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'badge-success';
			case 'draft':
				return 'badge-warning';
			case 'in_review':
				return 'badge-info';
			default:
				return 'badge-ghost';
		}
	}

	function viewConsultation(id: string) {
		goto(`/${agencySlug}/consultation/view/${id}`);
	}

	function editConsultation(id: string) {
		goto(`/${agencySlug}/consultation/edit/${id}`);
	}

	function startNewConsultation() {
		goto(`/${agencySlug}/consultation`);
	}
</script>

<svelte:head>
	<title>My Consultations | Webkit</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
				style="background-color: {feature.colorLight}; color: {feature.color}"
			>
				<feature.icon class="h-6 w-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">My Consultations</h1>
				<p class="text-base-content/70 mt-1">View and manage your consultation submissions</p>
			</div>
		</div>
		<Button variant="primary" onclick={startNewConsultation}>
			<Plus class="mr-2 h-4 w-4" />
			New Consultation
		</Button>
	</div>

	<!-- Consultations List -->
	{#if consultations.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
					style="background-color: {feature.colorLight}; color: {feature.color}"
				>
					<feature.icon class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No consultations yet</h3>
				<p class="text-base-content/60 max-w-sm">Get started by creating your first consultation.</p>
				<Button class="mt-4" variant="primary" onclick={startNewConsultation}>Start New Consultation</Button>
			</div>
		</div>
		{:else}
		<div class="space-y-4">
			{#each consultations as consultation}
				<div class="card bg-base-100 border border-base-300 transition-shadow hover:shadow-md">
					<div class="card-body">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3">
									<h3 class="text-lg font-semibold">
										{consultation.contactInfo?.business_name || 'Untitled Consultation'}
									</h3>
									<span class="badge {getStatusBadgeClass(consultation.status)}">
										{consultation.status === 'completed' ? 'Completed' : consultation.status === 'draft' ? 'Draft' : consultation.status}
									</span>
								</div>

								<div class="mt-2 grid grid-cols-2 gap-4 text-sm text-base-content/70">
									<div>
										<span class="font-medium">Contact:</span>
										{consultation.contactInfo?.contact_person || 'N/A'}
									</div>
									<div>
										<span class="font-medium">Industry:</span>
										{consultation.businessContext?.industry || 'N/A'}
									</div>
									<div>
										<span class="font-medium">Created:</span>
										{formatDate(consultation.createdAt)}
									</div>
									<div>
										<span class="font-medium">Last Updated:</span>
										{formatDate(consultation.updatedAt)}
									</div>
								</div>

								<!-- Progress Bar -->
								<div class="mt-4">
									<div class="flex items-center justify-between text-xs text-base-content/60">
										<span>Completion</span>
										<span>{consultation.completionPercentage}%</span>
									</div>
									<progress
										class="progress w-full mt-1 {consultation.status === 'completed' ? 'progress-success' : 'progress-primary'}"
										value={consultation.completionPercentage}
										max="100"
									></progress>
								</div>
							</div>

							<!-- Actions -->
							<div class="ml-6 flex flex-col gap-2">
								<button class="btn btn-ghost btn-sm" onclick={() => viewConsultation(consultation.id)}>
									View
								</button>
								<button class="btn btn-primary btn-sm" onclick={() => editConsultation(consultation.id)}>
									{consultation.status === 'draft' ? 'Continue' : 'Edit'}
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

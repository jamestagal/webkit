<script lang="ts">
	/**
	 * Agency-Scoped Consultation History Page v2
	 *
	 * Data loaded in +page.server.ts — no top-level await.
	 * Uses invalidateAll() after mutations to re-run server load.
	 */

	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { deleteConsultation } from '$lib/api/consultation.remote';
	import { FEATURES } from '$lib/config/features';
	import { INDUSTRY_OPTIONS, URGENCY_COLORS } from '$lib/config/consultation-options';
	import { formatDateTime } from '$lib/utils/formatting';
	import { Plus, Trash2, User } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const feature = FEATURES.consultations;

	// Get agency slug from URL
	const agencySlug = page.params.agencySlug;

	// Get current user's membership info for permission checks
	const membership = data.membership;

	// Consultations from server load (reactive — updates when invalidateAll() runs)
	let consultations = $derived(data.consultations);

	// Delete modal state
	let deleteModalOpen = $state(false);
	let consultationToDelete = $state<{ id: string; name: string } | null>(null);
	let isDeleting = $state(false);

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'badge-success';
			case 'draft':
				return 'badge-warning';
			case 'converted':
				return 'badge-info';
			default:
				return 'badge-ghost';
		}
	}

	function getIndustryLabel(value: string | null): string {
		if (!value) return 'N/A';
		return INDUSTRY_OPTIONS.find((o) => o.value === value)?.label ?? value;
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

	function openDeleteModal(id: string, name: string) {
		consultationToDelete = { id, name };
		deleteModalOpen = true;
	}

	function closeDeleteModal() {
		deleteModalOpen = false;
		consultationToDelete = null;
	}

	async function confirmDelete() {
		if (!consultationToDelete) return;

		isDeleting = true;
		try {
			await deleteConsultation({ consultationId: consultationToDelete.id });
			closeDeleteModal();
			// Re-run server load to get fresh data
			await invalidateAll();
		} catch (error) {
			console.error('Failed to delete consultation:', error);
		} finally {
			isDeleting = false;
		}
	}

	// Check if current user can edit/delete a consultation
	// Members can only edit their own, admins/owners can edit all
	function canModify(createdBy: string | null): boolean {
		if (membership.role === 'owner' || membership.role === 'admin') {
			return true;
		}
		return createdBy === membership.userId;
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
		<button class="btn btn-primary" onclick={startNewConsultation}>
			<Plus class="mr-2 h-4 w-4" />
			New Consultation
		</button>
	</div>

	<!-- Consultations List -->
	{#if consultations.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center py-12 text-center">
				<div
					class="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
					style="background-color: {feature.colorLight}; color: {feature.color}"
				>
					<feature.icon class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No consultations yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Get started by creating your first consultation.
				</p>
				<button class="btn btn-primary mt-4" onclick={startNewConsultation}
					>Start New Consultation</button
				>
			</div>
		</div>
	{:else}
		<div class="space-y-4">
			{#each consultations as consultation}
				{@const canEdit = canModify(consultation.createdBy)}
				<div class="card bg-base-100 border border-base-300 transition-shadow hover:shadow-md">
					<div class="card-body p-4 sm:p-6">
						<!-- Header with title and badge -->
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="text-lg font-semibold">
								{#if consultation.clientId}
									<a
										href="/{agencySlug}/clients/{consultation.clientId}"
										class="link link-hover"
										title="View client hub"
									>
										{consultation.businessName || 'Untitled Consultation'}
									</a>
								{:else}
									{consultation.businessName || 'Untitled Consultation'}
								{/if}
							</h3>
							<span class="badge {getStatusBadgeClass(consultation.status)} whitespace-nowrap">
								{consultation.status === 'completed'
									? 'Completed'
									: consultation.status === 'draft'
										? 'Draft'
										: consultation.status}
							</span>
							{#if consultation.urgencyLevel && consultation.urgencyLevel !== 'low'}
								<span class="badge {URGENCY_COLORS[consultation.urgencyLevel]} whitespace-nowrap">
									{consultation.urgencyLevel}
								</span>
							{/if}
						</div>

						<!-- Details grid -->
						<div
							class="text-base-content/70 mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-4"
						>
							<div>
								<span class="font-medium">Contact:</span>
								{consultation.contactPerson || 'N/A'}
							</div>
							<div>
								<span class="font-medium">Industry:</span>
								{getIndustryLabel(consultation.industry)}
							</div>
							<div>
								<span class="font-medium">Email:</span>
								{consultation.email}
							</div>
							<div>
								<span class="font-medium">Updated:</span>
								{formatDateTime(consultation.updatedAt)}
							</div>
							{#if consultation.creatorName}
								<div class="flex items-center gap-1">
									<User class="h-3 w-3" />
									<span>{consultation.creatorName}</span>
								</div>
							{/if}
						</div>

						<!-- Primary Challenges Tags -->
						{#if consultation.primaryChallenges?.length}
							<div class="mt-3 flex flex-wrap gap-1">
								{#each consultation.primaryChallenges.slice(0, 3) as challenge}
									<span class="badge badge-outline badge-sm">{challenge}</span>
								{/each}
								{#if consultation.primaryChallenges.length > 3}
									<span class="badge badge-ghost badge-sm"
										>+{consultation.primaryChallenges.length - 3} more</span
									>
								{/if}
							</div>
						{/if}

						<!-- Actions -->
						<div class="border-base-200 mt-4 flex gap-2 border-t pt-4">
							<button
								class="btn btn-outline btn-sm flex-1 sm:flex-none"
								onclick={() => viewConsultation(consultation.id)}
							>
								View Details
							</button>
							<button
								class="btn btn-primary btn-sm flex-1 sm:flex-none"
								onclick={() => editConsultation(consultation.id)}
								disabled={!canEdit}
								title={canEdit ? '' : 'Only the creator can edit this consultation'}
							>
								{consultation.status === 'draft' ? 'Continue' : 'Edit'}
							</button>
							<button
								class="btn btn-ghost btn-sm text-error"
								onclick={() =>
									openDeleteModal(
										consultation.id,
										consultation.businessName || 'Untitled Consultation'
									)}
								disabled={!canEdit}
								title={canEdit ? 'Delete consultation' : 'Only the creator can delete this consultation'}
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
{#if deleteModalOpen}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Consultation</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{consultationToDelete?.name}</strong>? This action
				cannot be undone.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeDeleteModal} disabled={isDeleting}>
					Cancel
				</button>
				<button class="btn btn-error" onclick={confirmDelete} disabled={isDeleting}>
					{#if isDeleting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Delete
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeDeleteModal}></div>
	</div>
{/if}

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { deleteAgencyAddon, duplicateAgencyAddon } from '$lib/api/agency-addons.remote';

	const toast = getToast();
	import AddonCard from '$lib/components/settings/AddonCard.svelte';
	import { Plus, PlusSquare } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Get agency slug from parent layout data
	let agencySlug = $derived(data.agency.slug);

	// Separate active and inactive add-ons
	let activeAddons = $derived(data.addons.filter((a) => a.isActive));
	let inactiveAddons = $derived(data.addons.filter((a) => !a.isActive));

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingItem = $state<{ id: string; name: string } | null>(null);
	let isDeleting = $state(false);

	function openDeleteModal(id: string, name: string) {
		deletingItem = { id, name };
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deletingItem = null;
	}

	async function confirmDelete() {
		if (!deletingItem) return;
		isDeleting = true;
		try {
			await deleteAgencyAddon(deletingItem.id);
			await invalidateAll();
			closeDeleteModal();
			toast.success('Add-on deleted');
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : '');
		} finally {
			isDeleting = false;
		}
	}

	async function handleDuplicate(id: string) {
		try {
			await duplicateAgencyAddon(id);
			await invalidateAll();
			toast.success('Add-on duplicated');
		} catch (err) {
			toast.error('Failed to duplicate', err instanceof Error ? err.message : '');
		}
	}

	function handleDelete(id: string, name?: string) {
		openDeleteModal(id, name || 'this add-on');
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Add-ons</h1>
			<p class="text-base-content/70 mt-1">
				Optional services clients can add to packages
			</p>
		</div>
		<a href="/{agencySlug}/settings/addons/new" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			New Add-on
		</a>
	</div>

	{#if data.addons.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<PlusSquare class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No add-ons yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create optional services that clients can add to their packages, like extra pages,
					rush delivery, or premium features.
				</p>
				<a href="/{agencySlug}/settings/addons/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create Add-on
				</a>
			</div>
		</div>
	{:else}
		<!-- Active Add-ons -->
		{#if activeAddons.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Active Add-ons ({activeAddons.length})
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each activeAddons as addon (addon.id)}
						<AddonCard
							{addon}
							{agencySlug}
							onDuplicate={handleDuplicate}
							onDelete={handleDelete}
						/>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Inactive Add-ons -->
		{#if inactiveAddons.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Inactive Add-ons ({inactiveAddons.length})
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each inactiveAddons as addon (addon.id)}
						<AddonCard
							{addon}
							{agencySlug}
							onDuplicate={handleDuplicate}
							onDelete={handleDelete}
						/>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if showDeleteModal && deletingItem}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Add-on</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{deletingItem.name}</strong>? It will be
				deactivated.
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

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { deleteAgencyPackage, duplicateAgencyPackage } from '$lib/api/agency-packages.remote';

	const toast = getToast();
	import PackageCard from '$lib/components/settings/PackageCard.svelte';
	import { Plus, Package } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Get agency slug from parent layout data
	let agencySlug = $derived(data.agency.slug);

	// Separate active and inactive packages
	let activePackages = $derived(data.packages.filter((p) => p.isActive));
	let inactivePackages = $derived(data.packages.filter((p) => !p.isActive));

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
			await deleteAgencyPackage(deletingItem.id);
			await invalidateAll();
			closeDeleteModal();
			toast.success('Package deleted');
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : '');
		} finally {
			isDeleting = false;
		}
	}

	async function handleDuplicate(id: string) {
		try {
			await duplicateAgencyPackage(id);
			await invalidateAll();
			toast.success('Package duplicated');
		} catch (err) {
			toast.error('Failed to duplicate', err instanceof Error ? err.message : '');
		}
	}

	function handleDelete(id: string, name?: string) {
		openDeleteModal(id, name || 'this package');
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Packages</h1>
			<p class="text-base-content/70 mt-1">
				Define pricing tiers for your web design services
			</p>
		</div>
		<a href="/{agencySlug}/settings/packages/new" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			New Package
		</a>
	</div>

	{#if data.packages.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<Package class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No packages yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create your first pricing package to start building proposals with pre-defined
					pricing tiers.
				</p>
				<a href="/{agencySlug}/settings/packages/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create Package
				</a>
			</div>
		</div>
	{:else}
		<!-- Active Packages -->
		{#if activePackages.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Active Packages ({activePackages.length})
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each activePackages as pkg (pkg.id)}
						<PackageCard
							{pkg}
							{agencySlug}
							onDuplicate={handleDuplicate}
							onDelete={handleDelete}
						/>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Inactive Packages -->
		{#if inactivePackages.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Inactive Packages ({inactivePackages.length})
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each inactivePackages as pkg (pkg.id)}
						<PackageCard
							{pkg}
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
			<h3 class="text-lg font-bold">Delete Package</h3>
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

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/components/shared/Toast.svelte';
	import { deleteAgencyPackage, duplicateAgencyPackage } from '$lib/api/agency-packages.remote';
	import PackageCard from '$lib/components/settings/PackageCard.svelte';
	import { Plus, Package } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Get agency slug from parent layout data
	let agencySlug = $derived(data.agency.slug);

	// Separate active and inactive packages
	let activePackages = $derived(data.packages.filter((p) => p.isActive));
	let inactivePackages = $derived(data.packages.filter((p) => !p.isActive));

	async function handleDuplicate(id: string) {
		isDuplicating = id;
		try {
			await duplicateAgencyPackage(id);
			await invalidateAll();
			toast.success('Package duplicated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to duplicate');
		} finally {
			isDuplicating = null;
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Are you sure you want to delete this package? It will be deactivated.')) {
			return;
		}

		isDeleting = id;
		try {
			await deleteAgencyPackage(id);
			await invalidateAll();
			toast.success('Package deleted');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete');
		} finally {
			isDeleting = null;
		}
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

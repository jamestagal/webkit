<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		deleteContractTemplate,
		duplicateContractTemplate,
		setDefaultTemplate
	} from '$lib/api/contract-templates.remote';
	import { formatDate } from '$lib/utils/formatting';
	import { Plus, FileText, Star, Copy, Trash2, MoreVertical } from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	// Get agency slug from parent layout data
	let agencySlug = $derived(data.agency.slug);

	// Separate active and inactive templates
	let activeTemplates = $derived(data.templates.filter((t) => t.isActive));
	let inactiveTemplates = $derived(data.templates.filter((t) => !t.isActive));

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
			await deleteContractTemplate(deletingItem.id);
			await invalidateAll();
			closeDeleteModal();
			toast.success('Template deleted');
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : '');
		} finally {
			isDeleting = false;
		}
	}

	async function handleDuplicate(id: string) {
		try {
			await duplicateContractTemplate(id);
			await invalidateAll();
			toast.success('Template duplicated');
		} catch (err) {
			toast.error('Failed to duplicate', err instanceof Error ? err.message : '');
		}
	}

	function handleDelete(id: string, name?: string) {
		openDeleteModal(id, name || 'this template');
	}

	async function handleSetDefault(id: string) {
		try {
			await setDefaultTemplate(id);
			await invalidateAll();
			toast.success('Default template updated');
		} catch (err) {
			toast.error('Failed to set default', err instanceof Error ? err.message : '');
		}
	}


</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Contract Templates</h1>
			<p class="text-base-content/70 mt-1">
				Define your terms and conditions for client contracts
			</p>
		</div>
		<a href="/{agencySlug}/settings/contracts/new" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			New Template
		</a>
	</div>

	{#if data.templates.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4"
				>
					<FileText class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No contract templates yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create your first contract template to define your terms and conditions for
					client agreements.
				</p>
				<a href="/{agencySlug}/settings/contracts/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create Template
				</a>
			</div>
		</div>
	{:else}
		<!-- Active Templates -->
		{#if activeTemplates.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Active Templates ({activeTemplates.length})
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each activeTemplates as template (template.id)}
						<div
							class="card bg-base-100 border border-base-300 hover:border-base-400 transition-colors"
						>
							<div class="card-body p-4">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<h3 class="font-semibold truncate">{template.name}</h3>
											{#if template.isDefault}
												<span class="badge badge-primary badge-sm">
													<Star class="h-3 w-3 mr-1" />
													Default
												</span>
											{/if}
										</div>
										<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
											{template.description || 'No description'}
										</p>
									</div>
									<div class="dropdown dropdown-end">
										<button
											type="button"
											tabindex="0"
											class="btn btn-ghost btn-sm btn-square"
										>
											<MoreVertical class="h-4 w-4" />
										</button>
										<ul
											class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300"
										>
											<li>
												<a href="/{agencySlug}/settings/contracts/{template.id}">
													Edit Template
												</a>
											</li>
											<li>
												<a
													href="/{agencySlug}/settings/contracts/{template.id}/schedules"
												>
													Manage Schedules
												</a>
											</li>
											<li>
												<button
													type="button"
													onclick={() => handleDuplicate(template.id)}
												>
													<Copy class="h-4 w-4" />
													Duplicate
												</button>
											</li>
											{#if !template.isDefault}
												<li>
													<button
														type="button"
														onclick={() => handleSetDefault(template.id)}
													>
														<Star class="h-4 w-4" />
														Set as Default
													</button>
												</li>
											{/if}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button
													type="button"
													class="text-error"
													onclick={() => handleDelete(template.id)}
												>
													<Trash2 class="h-4 w-4" />
													Delete
												</button>
											</li>
										</ul>
									</div>
								</div>

								<div class="flex items-center gap-4 mt-3 pt-3 border-t border-base-200">
									<span class="text-xs text-base-content/60">
										v{template.version}
									</span>
									<span class="text-xs text-base-content/60">
										Updated {formatDate(template.updatedAt)}
									</span>
								</div>

								<a
									href="/{agencySlug}/settings/contracts/{template.id}"
									class="btn btn-ghost btn-sm mt-2 w-full"
								>
									Edit Template
								</a>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Inactive Templates -->
		{#if inactiveTemplates.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Inactive Templates ({inactiveTemplates.length})
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each inactiveTemplates as template (template.id)}
						<div class="card bg-base-200/50 border border-base-300 opacity-60">
							<div class="card-body p-4">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1 min-w-0">
										<h3 class="font-semibold truncate">{template.name}</h3>
										<p class="text-sm text-base-content/60 line-clamp-2 mt-1">
											{template.description || 'No description'}
										</p>
									</div>
									<div class="dropdown dropdown-end">
										<button
											type="button"
											tabindex="0"
											class="btn btn-ghost btn-sm btn-square"
										>
											<MoreVertical class="h-4 w-4" />
										</button>
										<ul
											class="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300"
										>
											<li>
												<button
													type="button"
													onclick={() => handleDuplicate(template.id)}
												>
													<Copy class="h-4 w-4" />
													Duplicate
												</button>
											</li>
										</ul>
									</div>
								</div>
								<div class="badge badge-ghost badge-sm mt-2">Inactive</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if showDeleteModal && deletingItem}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Template</h3>
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

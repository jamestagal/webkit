<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createQuotationTemplate,
		deleteQuotationTemplate,
		duplicateQuotationTemplate,
		setDefaultQuotationTemplate
	} from '$lib/api/quotation-templates.remote';
	import { Plus, FileText, Star, Copy, Trash2, MoreVertical, ArrowLeft } from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();
	let agencySlug = $derived(data.agency.slug);

	let activeTemplates = $derived(data.templates.filter((t: any) => t.isActive));
	let inactiveTemplates = $derived(data.templates.filter((t: any) => !t.isActive));

	// Create modal state
	let showCreateModal = $state(false);
	let isCreating = $state(false);
	let createName = $state('');
	let createDescription = $state('');
	let createCategory = $state('');
	let createValidityDays = $state('');

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingItem = $state<{ id: string; name: string } | null>(null);
	let isDeleting = $state(false);

	function openCreateModal() {
		createName = '';
		createDescription = '';
		createCategory = '';
		createValidityDays = '';
		showCreateModal = true;
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	async function handleCreate() {
		if (!createName.trim()) return;
		isCreating = true;
		try {
			await createQuotationTemplate({
				name: createName.trim(),
				description: createDescription.trim(),
				category: createCategory.trim() || null,
				defaultValidityDays: createValidityDays ? parseInt(createValidityDays) : null,
			});
			await invalidateAll();
			closeCreateModal();
			toast.success('Template created');
		} catch (err) {
			toast.error('Failed to create', err instanceof Error ? err.message : '');
		} finally {
			isCreating = false;
		}
	}

	async function handleDuplicate(id: string) {
		try {
			await duplicateQuotationTemplate(id);
			await invalidateAll();
			toast.success('Template duplicated');
		} catch (err) {
			toast.error('Failed to duplicate', err instanceof Error ? err.message : '');
		}
	}

	async function handleSetDefault(id: string) {
		try {
			await setDefaultQuotationTemplate(id);
			await invalidateAll();
			toast.success('Default template updated');
		} catch (err) {
			toast.error('Failed to set default', err instanceof Error ? err.message : '');
		}
	}

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
			await deleteQuotationTemplate(deletingItem.id);
			await invalidateAll();
			closeDeleteModal();
			toast.success('Template deleted');
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : '');
		} finally {
			isDeleting = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex items-center gap-3">
			<a href="/{agencySlug}/settings/quotations" class="btn btn-ghost btn-sm btn-square">
				<ArrowLeft class="h-4 w-4" />
			</a>
			<div>
				<h1 class="text-2xl font-bold">Quotation Templates</h1>
				<p class="text-base-content/70 mt-1">
					Parent templates that bundle scope sections and terms
				</p>
			</div>
		</div>
		<button type="button" class="btn btn-primary" onclick={openCreateModal}>
			<Plus class="h-4 w-4" />
			New Template
		</button>
	</div>

	{#if data.templates.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 mb-4"
				>
					<FileText class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No quotation templates yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create your first quotation template to bundle scope sections and terms for quick quotation creation.
				</p>
				<button type="button" class="btn btn-primary mt-4" onclick={openCreateModal}>
					<Plus class="h-4 w-4" />
					Create Template
				</button>
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
												<a href="/{agencySlug}/settings/quotations/templates/{template.id}">
													Edit Template
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
													onclick={() => openDeleteModal(template.id, template.name)}
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
										{template.sectionCount} sections
									</span>
									<span class="text-xs text-base-content/60">
										{template.termsCount} terms
									</span>
									{#if template.category}
										<span class="badge badge-ghost badge-xs">{template.category}</span>
									{/if}
								</div>

								<a
									href="/{agencySlug}/settings/quotations/templates/{template.id}"
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

<!-- Create Modal -->
{#if showCreateModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">New Quotation Template</h3>

			<div class="space-y-4 mt-4">
				<div class="form-control">
					<label class="label" for="template-name">
						<span class="label-text">Name <span class="text-error">*</span></span>
					</label>
					<input
						id="template-name"
						type="text"
						class="input input-bordered"
						placeholder="e.g. Full Shower Retile"
						bind:value={createName}
					/>
				</div>

				<div class="form-control">
					<label class="label" for="template-desc">
						<span class="label-text">Description</span>
					</label>
					<textarea
						id="template-desc"
						class="textarea textarea-bordered"
						placeholder="Brief description"
						bind:value={createDescription}
						rows="2"
					></textarea>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="template-category">
							<span class="label-text">Category</span>
						</label>
						<input
							id="template-category"
							type="text"
							class="input input-bordered"
							placeholder="e.g. Bathroom"
							bind:value={createCategory}
						/>
					</div>
					<div class="form-control">
						<label class="label" for="template-validity">
							<span class="label-text">Validity (days)</span>
						</label>
						<input
							id="template-validity"
							type="number"
							class="input input-bordered"
							placeholder="e.g. 60"
							bind:value={createValidityDays}
						/>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeCreateModal} disabled={isCreating}>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={handleCreate}
					disabled={isCreating || !createName.trim()}
				>
					{#if isCreating}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Create Template
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeCreateModal}></div>
	</div>
{/if}

<!-- Delete Modal -->
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

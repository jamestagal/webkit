<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createScopeTemplate,
		updateScopeTemplate,
		deleteScopeTemplate
	} from '$lib/api/quotation-templates.remote';
	import { formatCurrency } from '$lib/utils/formatting';
	import { Plus, Trash2, ArrowLeft, Pencil, X } from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();
	let agencySlug = $derived(data.agency.slug);

	let activeTemplates = $derived(data.templates.filter((t: any) => t.isActive));
	let inactiveTemplates = $derived(data.templates.filter((t: any) => !t.isActive));

	// Modal state
	let showModal = $state(false);
	let editingTemplate = $state<any>(null);
	let isSubmitting = $state(false);

	// Form state
	let formName = $state('');
	let formDescription = $state('');
	let formCategory = $state('');
	let formDefaultPrice = $state('');
	let formWorkItems = $state<string[]>(['']);

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingItem = $state<{ id: string; name: string } | null>(null);
	let isDeleting = $state(false);

	function openCreateModal() {
		editingTemplate = null;
		formName = '';
		formDescription = '';
		formCategory = '';
		formDefaultPrice = '';
		formWorkItems = [''];
		showModal = true;
	}

	function openEditModal(template: any) {
		editingTemplate = template;
		formName = template.name;
		formDescription = template.description || '';
		formCategory = template.category || '';
		formDefaultPrice = template.defaultPrice || '';
		const items = Array.isArray(template.workItems) ? template.workItems : [];
		formWorkItems = items.length > 0 ? [...items] : [''];
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingTemplate = null;
	}

	function addWorkItem() {
		formWorkItems = [...formWorkItems, ''];
	}

	function removeWorkItem(index: number) {
		formWorkItems = formWorkItems.filter((_, i) => i !== index);
		if (formWorkItems.length === 0) formWorkItems = [''];
	}

	function updateWorkItem(index: number, value: string) {
		formWorkItems = formWorkItems.map((item, i) => (i === index ? value : item));
	}

	function moveWorkItem(index: number, direction: -1 | 1) {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= formWorkItems.length) return;
		const items = [...formWorkItems];
		[items[index], items[newIndex]] = [items[newIndex]!, items[index]!];
		formWorkItems = items;
	}

	async function handleSubmit() {
		if (!formName.trim()) return;
		isSubmitting = true;

		const workItems = formWorkItems.filter((item) => item.trim() !== '');

		try {
			if (editingTemplate) {
				await updateScopeTemplate({
					templateId: editingTemplate.id,
					name: formName.trim(),
					description: formDescription.trim(),
					category: formCategory.trim() || null,
					workItems,
					defaultPrice: formDefaultPrice.trim() || null,
				});
				toast.success('Scope template updated');
			} else {
				await createScopeTemplate({
					name: formName.trim(),
					description: formDescription.trim(),
					category: formCategory.trim() || null,
					workItems,
					defaultPrice: formDefaultPrice.trim() || null,
				});
				toast.success('Scope template created');
			}
			await invalidateAll();
			closeModal();
		} catch (err) {
			toast.error('Failed to save', err instanceof Error ? err.message : '');
		} finally {
			isSubmitting = false;
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
			await deleteScopeTemplate(deletingItem.id);
			await invalidateAll();
			closeDeleteModal();
			toast.success('Scope template deleted');
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
				<h1 class="text-2xl font-bold">Scope Templates</h1>
				<p class="text-base-content/70 mt-1">
					Reusable work item blocks for quotation sections
				</p>
			</div>
		</div>
		<button type="button" class="btn btn-primary" onclick={openCreateModal}>
			<Plus class="h-4 w-4" />
			New Scope Template
		</button>
	</div>

	{#if data.templates.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<h3 class="text-lg font-semibold">No scope templates yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create reusable work item blocks that can be added to quotation templates.
				</p>
				<button type="button" class="btn btn-primary mt-4" onclick={openCreateModal}>
					<Plus class="h-4 w-4" />
					Create Scope Template
				</button>
			</div>
		</div>
	{:else}
		<!-- Active Templates -->
		{#if activeTemplates.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Active ({activeTemplates.length})
				</h2>
				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Category</th>
								<th>Items</th>
								<th>Default Price</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each activeTemplates as template (template.id)}
								{@const items = Array.isArray(template.workItems) ? template.workItems : []}
								<tr class="hover">
									<td>
										<div class="font-medium">{template.name}</div>
										{#if template.description}
											<div class="text-sm text-base-content/60 line-clamp-1">
												{template.description}
											</div>
										{/if}
									</td>
									<td>
										{#if template.category}
											<span class="badge badge-ghost badge-sm">{template.category}</span>
										{:else}
											<span class="text-base-content/40">—</span>
										{/if}
									</td>
									<td>{items.length} items</td>
									<td>
										{#if template.defaultPrice}
											{formatCurrency(template.defaultPrice)}
										{:else}
											<span class="text-base-content/40">—</span>
										{/if}
									</td>
									<td class="text-right">
										<div class="flex items-center justify-end gap-1">
											<button
												type="button"
												class="btn btn-ghost btn-sm btn-square"
												onclick={() => openEditModal(template)}
											>
												<Pencil class="h-4 w-4" />
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-sm btn-square text-error"
												onclick={() => openDeleteModal(template.id, template.name)}
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Inactive Templates -->
		{#if inactiveTemplates.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
					Inactive ({inactiveTemplates.length})
				</h2>
				<div class="overflow-x-auto opacity-60">
					<table class="table">
						<tbody>
							{#each inactiveTemplates as template (template.id)}
								<tr>
									<td>{template.name}</td>
									<td><span class="badge badge-ghost badge-sm">Inactive</span></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Create/Edit Modal -->
{#if showModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<h3 class="text-lg font-bold">
				{editingTemplate ? 'Edit Scope Template' : 'New Scope Template'}
			</h3>

			<div class="space-y-4 mt-4">
				<!-- Name -->
				<div class="form-control">
					<label class="label" for="scope-name">
						<span class="label-text">Name <span class="text-error">*</span></span>
					</label>
					<input
						id="scope-name"
						type="text"
						class="input input-bordered"
						placeholder="e.g. Full Shower Retile"
						bind:value={formName}
					/>
				</div>

				<!-- Description -->
				<div class="form-control">
					<label class="label" for="scope-desc">
						<span class="label-text">Description</span>
					</label>
					<textarea
						id="scope-desc"
						class="textarea textarea-bordered"
						placeholder="Brief description of this scope section"
						bind:value={formDescription}
						rows="2"
					></textarea>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<!-- Category -->
					<div class="form-control">
						<label class="label" for="scope-category">
							<span class="label-text">Category</span>
						</label>
						<input
							id="scope-category"
							type="text"
							class="input input-bordered"
							placeholder="e.g. Bathroom"
							bind:value={formCategory}
						/>
					</div>

					<!-- Default Price -->
					<div class="form-control">
						<label class="label" for="scope-price">
							<span class="label-text">Default Price (ex GST)</span>
						</label>
						<input
							id="scope-price"
							type="text"
							class="input input-bordered"
							placeholder="e.g. 5500.00"
							bind:value={formDefaultPrice}
						/>
					</div>
				</div>

				<!-- Work Items -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Work Items</span>
						<button type="button" class="btn btn-ghost btn-xs" onclick={addWorkItem}>
							<Plus class="h-3 w-3" />
							Add Item
						</button>
					</label>
					<div class="space-y-2">
						{#each formWorkItems as item, index (index)}
							<div class="flex items-center gap-2">
								<div class="flex flex-col gap-0.5">
									<button
										type="button"
										class="btn btn-ghost btn-xs btn-square"
										onclick={() => moveWorkItem(index, -1)}
										disabled={index === 0}
									>
										<span class="text-xs">&#9650;</span>
									</button>
									<button
										type="button"
										class="btn btn-ghost btn-xs btn-square"
										onclick={() => moveWorkItem(index, 1)}
										disabled={index === formWorkItems.length - 1}
									>
										<span class="text-xs">&#9660;</span>
									</button>
								</div>
								<input
									type="text"
									class="input input-bordered input-sm flex-1"
									placeholder="Work item description"
									value={item}
									oninput={(e) => updateWorkItem(index, e.currentTarget.value)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-sm btn-square text-error"
									onclick={() => removeWorkItem(index)}
								>
									<X class="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeModal} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={handleSubmit}
					disabled={isSubmitting || !formName.trim()}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					{editingTemplate ? 'Save Changes' : 'Create Template'}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeModal}></div>
	</div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal && deletingItem}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Scope Template</h3>
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

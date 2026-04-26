<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createTermsTemplate,
		updateTermsTemplate,
		deleteTermsTemplate
	} from '$lib/api/quotation-templates.remote';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import { Plus, Trash2, Pencil, ArrowLeft, Star } from 'lucide-svelte';
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
	let formTitle = $state('');
	let formContent = $state('');
	let formIsDefault = $state(false);

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingItem = $state<{ id: string; name: string } | null>(null);
	let isDeleting = $state(false);

	function openCreateModal() {
		editingTemplate = null;
		formTitle = '';
		formContent = '';
		formIsDefault = false;
		showModal = true;
	}

	function openEditModal(template: any) {
		editingTemplate = template;
		formTitle = template.title;
		formContent = template.content || '';
		formIsDefault = template.isDefault || false;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingTemplate = null;
	}

	async function handleSubmit() {
		if (!formTitle.trim() || !formContent.trim()) return;
		isSubmitting = true;

		try {
			if (editingTemplate) {
				await updateTermsTemplate({
					templateId: editingTemplate.id,
					title: formTitle.trim(),
					content: formContent,
					isDefault: formIsDefault,
				});
				toast.success('Terms template updated');
			} else {
				await createTermsTemplate({
					title: formTitle.trim(),
					content: formContent,
					isDefault: formIsDefault,
				});
				toast.success('Terms template created');
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
			await deleteTermsTemplate(deletingItem.id);
			await invalidateAll();
			closeDeleteModal();
			toast.success('Terms template deleted');
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : '');
		} finally {
			isDeleting = false;
		}
	}

	function stripHtml(html: string): string {
		const div = typeof document !== 'undefined' ? document.createElement('div') : null;
		if (div) {
			div.innerHTML = html;
			return div.textContent || div.innerText || '';
		}
		return html.replace(/<[^>]*>/g, '');
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
				<h1 class="text-2xl font-bold">Terms Templates</h1>
				<p class="text-base-content/70 mt-1">
					Reusable terms and conditions blocks for quotations
				</p>
			</div>
		</div>
		<button type="button" class="btn btn-primary" onclick={openCreateModal}>
			<Plus class="h-4 w-4" />
			New Terms Template
		</button>
	</div>

	{#if data.templates.length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<h3 class="text-lg font-semibold">No terms templates yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create reusable terms and conditions blocks that can be added to quotation templates.
				</p>
				<button type="button" class="btn btn-primary mt-4" onclick={openCreateModal}>
					<Plus class="h-4 w-4" />
					Create Terms Template
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
								<th>Title</th>
								<th>Content Preview</th>
								<th>Default</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each activeTemplates as template (template.id)}
								<tr class="hover">
									<td>
										<div class="font-medium">{template.title}</div>
									</td>
									<td>
										<div class="text-sm text-base-content/60 line-clamp-2 max-w-xs">
											{stripHtml(template.content)}
										</div>
									</td>
									<td>
										{#if template.isDefault}
											<span class="badge badge-primary badge-sm">
												<Star class="h-3 w-3 mr-1" />
												Default
											</span>
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
												onclick={() => openDeleteModal(template.id, template.title)}
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
									<td>{template.title}</td>
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
		<div class="modal-box max-w-3xl">
			<h3 class="text-lg font-bold">
				{editingTemplate ? 'Edit Terms Template' : 'New Terms Template'}
			</h3>

			<div class="space-y-4 mt-4">
				<!-- Title -->
				<div class="form-control">
					<label class="label" for="terms-title">
						<span class="label-text">Title <span class="text-error">*</span></span>
					</label>
					<input
						id="terms-title"
						type="text"
						class="input input-bordered"
						placeholder="e.g. Payment Terms"
						bind:value={formTitle}
					/>
				</div>

				<!-- Content -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Content <span class="text-error">*</span></span>
					</label>
					<RichTextEditor
						content={formContent}
						onUpdate={(html) => (formContent = html)}
						minHeight="200px"
						placeholder="Enter terms and conditions content..."
					/>
				</div>

				<!-- Default toggle -->
				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3" for="terms-default">
						<input
							id="terms-default"
							type="checkbox"
							class="toggle toggle-primary"
							bind:checked={formIsDefault}
						/>
						<span class="label-text">Set as default (auto-included in new quotation templates)</span>
					</label>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeModal} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={handleSubmit}
					disabled={isSubmitting || !formTitle.trim() || !formContent.trim()}
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
			<h3 class="text-lg font-bold">Delete Terms Template</h3>
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

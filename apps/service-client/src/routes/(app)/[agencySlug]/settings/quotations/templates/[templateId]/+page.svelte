<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		updateQuotationTemplate,
		addSectionToTemplate,
		removeSectionFromTemplate,
		addTermsToTemplate,
		removeTermsFromTemplate
	} from '$lib/api/quotation-templates.remote';
	import { formatCurrency } from '$lib/utils/formatting';
	import {
		ArrowLeft,
		Plus,
		Trash2,
		GripVertical,
		Layers,
		Scale,
		Save
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();
	let agencySlug = $derived(data.agency.slug);

	// Tab state
	let activeTab = $state<'sections' | 'terms'>('sections');

	// Template edit state
	let editName = $state(data.template.name);
	let editDescription = $state(data.template.description || '');
	let editCategory = $state(data.template.category || '');
	let editValidityDays = $state(data.template.defaultValidityDays?.toString() || '');
	let isSaving = $state(false);

	// Add section modal
	let showAddSectionModal = $state(false);
	let selectedScopeTemplateId = $state('');
	let sectionPrice = $state('');
	let isAddingSection = $state(false);

	// Add terms modal
	let showAddTermsModal = $state(false);
	let selectedTermsTemplateId = $state('');
	let isAddingTerms = $state(false);

	// Remove modal
	let showRemoveModal = $state(false);
	let removingItem = $state<{ id: string; name: string; type: 'section' | 'term' } | null>(null);
	let isRemoving = $state(false);

	// Available scope templates (not already linked)
	let linkedScopeIds = $derived(new Set(data.sections.map((s: any) => s.scopeTemplateId)));
	let availableScopeTemplates = $derived(
		data.scopeTemplates.filter((t: any) => !linkedScopeIds.has(t.id))
	);

	// Available terms templates (not already linked)
	let linkedTermsIds = $derived(new Set(data.terms.map((t: any) => t.termsTemplateId)));
	let availableTermsTemplates = $derived(
		data.termsTemplates.filter((t: any) => !linkedTermsIds.has(t.id))
	);

	async function saveTemplate() {
		isSaving = true;
		try {
			await updateQuotationTemplate({
				templateId: data.template.id,
				name: editName.trim(),
				description: editDescription.trim(),
				category: editCategory.trim() || null,
				defaultValidityDays: editValidityDays ? parseInt(editValidityDays) : null,
			});
			await invalidateAll();
			toast.success('Template saved');
		} catch (err) {
			toast.error('Failed to save', err instanceof Error ? err.message : '');
		} finally {
			isSaving = false;
		}
	}

	// -- Section Management --

	function openAddSectionModal() {
		selectedScopeTemplateId = '';
		sectionPrice = '';
		showAddSectionModal = true;
	}

	async function handleAddSection() {
		if (!selectedScopeTemplateId) return;
		isAddingSection = true;
		try {
			await addSectionToTemplate({
				templateId: data.template.id,
				scopeTemplateId: selectedScopeTemplateId,
				defaultSectionPrice: sectionPrice.trim() || null,
			});
			await invalidateAll();
			showAddSectionModal = false;
			toast.success('Section added');
		} catch (err) {
			toast.error('Failed to add section', err instanceof Error ? err.message : '');
		} finally {
			isAddingSection = false;
		}
	}

	// -- Terms Management --

	function openAddTermsModal() {
		selectedTermsTemplateId = '';
		showAddTermsModal = true;
	}

	async function handleAddTerms() {
		if (!selectedTermsTemplateId) return;
		isAddingTerms = true;
		try {
			await addTermsToTemplate({
				templateId: data.template.id,
				termsTemplateId: selectedTermsTemplateId,
			});
			await invalidateAll();
			showAddTermsModal = false;
			toast.success('Terms added');
		} catch (err) {
			toast.error('Failed to add terms', err instanceof Error ? err.message : '');
		} finally {
			isAddingTerms = false;
		}
	}

	// -- Remove --

	function openRemoveModal(id: string, name: string, type: 'section' | 'term') {
		removingItem = { id, name, type };
		showRemoveModal = true;
	}

	function closeRemoveModal() {
		showRemoveModal = false;
		removingItem = null;
	}

	async function confirmRemove() {
		if (!removingItem) return;
		isRemoving = true;
		try {
			if (removingItem.type === 'section') {
				await removeSectionFromTemplate(removingItem.id);
			} else {
				await removeTermsFromTemplate(removingItem.id);
			}
			await invalidateAll();
			closeRemoveModal();
			toast.success(`${removingItem.type === 'section' ? 'Section' : 'Terms'} removed`);
		} catch (err) {
			toast.error('Failed to remove', err instanceof Error ? err.message : '');
		} finally {
			isRemoving = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a href="/{agencySlug}/settings/quotations/templates" class="btn btn-ghost btn-sm btn-square">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div class="flex-1">
			<h1 class="text-2xl font-bold">Edit Template</h1>
			<p class="text-base-content/70 mt-1">{data.template.name}</p>
		</div>
	</div>

	<!-- Template Details -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="form-control">
					<label class="label" for="edit-name">
						<span class="label-text">Name</span>
					</label>
					<input
						id="edit-name"
						type="text"
						class="input input-bordered"
						bind:value={editName}
					/>
				</div>
				<div class="form-control">
					<label class="label" for="edit-category">
						<span class="label-text">Category</span>
					</label>
					<input
						id="edit-category"
						type="text"
						class="input input-bordered"
						placeholder="e.g. Bathroom"
						bind:value={editCategory}
					/>
				</div>
			</div>
			<div class="form-control">
				<label class="label" for="edit-desc">
					<span class="label-text">Description</span>
				</label>
				<textarea
					id="edit-desc"
					class="textarea textarea-bordered"
					bind:value={editDescription}
					rows="2"
				></textarea>
			</div>
			<div class="form-control w-48">
				<label class="label" for="edit-validity">
					<span class="label-text">Default Validity (days)</span>
				</label>
				<input
					id="edit-validity"
					type="number"
					class="input input-bordered"
					placeholder="60"
					bind:value={editValidityDays}
				/>
			</div>
			<div class="flex justify-end mt-2">
				<button
					class="btn btn-primary btn-sm"
					onclick={saveTemplate}
					disabled={isSaving || !editName.trim()}
				>
					{#if isSaving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					<Save class="h-4 w-4" />
					Save Details
				</button>
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div role="tablist" class="tabs tabs-bordered">
		<button
			role="tab"
			class="tab gap-2"
			class:tab-active={activeTab === 'sections'}
			onclick={() => (activeTab = 'sections')}
		>
			<Layers class="h-4 w-4" />
			Scope Sections ({data.sections.length})
		</button>
		<button
			role="tab"
			class="tab gap-2"
			class:tab-active={activeTab === 'terms'}
			onclick={() => (activeTab = 'terms')}
		>
			<Scale class="h-4 w-4" />
			Terms ({data.terms.length})
		</button>
	</div>

	<!-- Sections Tab -->
	{#if activeTab === 'sections'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-sm text-base-content/60">
					Scope sections that will be included when using this template
				</p>
				<button
					type="button"
					class="btn btn-sm btn-primary"
					onclick={openAddSectionModal}
					disabled={availableScopeTemplates.length === 0}
				>
					<Plus class="h-4 w-4" />
					Add Section
				</button>
			</div>

			{#if data.sections.length === 0}
				<div class="card bg-base-200/50 border border-base-300">
					<div class="card-body items-center text-center py-8">
						<p class="text-base-content/60">No scope sections linked yet.</p>
						<p class="text-sm text-base-content/40">
							Add scope templates to define the default work sections for this quotation template.
						</p>
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					{#each data.sections as section (section.id)}
						{@const items = Array.isArray(section.scopeTemplateWorkItems) ? section.scopeTemplateWorkItems : []}
						<div class="card bg-base-100 border border-base-300">
							<div class="card-body p-4 flex-row items-center gap-3">
								<div class="text-base-content/40">
									<GripVertical class="h-5 w-5" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium">{section.scopeTemplateName}</div>
									{#if section.scopeTemplateCategory}
										<span class="badge badge-ghost badge-xs">
											{section.scopeTemplateCategory}
										</span>
									{/if}
									<div class="text-xs text-base-content/50 mt-1">
										{items.length} work items
									</div>
								</div>
								<div class="text-sm text-base-content/60">
									{#if section.defaultSectionPrice}
										{formatCurrency(section.defaultSectionPrice)}
									{:else if section.scopeTemplateDefaultPrice}
										{formatCurrency(section.scopeTemplateDefaultPrice)}
										<span class="text-xs">(default)</span>
									{:else}
										<span class="text-base-content/40">No price</span>
									{/if}
								</div>
								<button
									type="button"
									class="btn btn-ghost btn-sm btn-square text-error"
									onclick={() =>
										openRemoveModal(section.id, section.scopeTemplateName, 'section')}
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Terms Tab -->
	{#if activeTab === 'terms'}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-sm text-base-content/60">
					Terms blocks that will be included when using this template
				</p>
				<button
					type="button"
					class="btn btn-sm btn-primary"
					onclick={openAddTermsModal}
					disabled={availableTermsTemplates.length === 0}
				>
					<Plus class="h-4 w-4" />
					Add Terms
				</button>
			</div>

			{#if data.terms.length === 0}
				<div class="card bg-base-200/50 border border-base-300">
					<div class="card-body items-center text-center py-8">
						<p class="text-base-content/60">No terms linked yet.</p>
						<p class="text-sm text-base-content/40">
							Add terms templates to define the default terms for this quotation template.
						</p>
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					{#each data.terms as term (term.id)}
						<div class="card bg-base-100 border border-base-300">
							<div class="card-body p-4 flex-row items-center gap-3">
								<div class="text-base-content/40">
									<GripVertical class="h-5 w-5" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium">{term.termsTemplateTitle}</div>
								</div>
								<button
									type="button"
									class="btn btn-ghost btn-sm btn-square text-error"
									onclick={() =>
										openRemoveModal(term.id, term.termsTemplateTitle, 'term')}
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Add Section Modal -->
{#if showAddSectionModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Add Scope Section</h3>
			<div class="space-y-4 mt-4">
				<div class="form-control">
					<label class="label" for="scope-select">
						<span class="label-text">Scope Template</span>
					</label>
					<select
						id="scope-select"
						class="select select-bordered"
						bind:value={selectedScopeTemplateId}
					>
						<option value="">Select a scope template...</option>
						{#each availableScopeTemplates as st (st.id)}
							<option value={st.id}>{st.name}</option>
						{/each}
					</select>
				</div>
				<div class="form-control">
					<label class="label" for="section-price">
						<span class="label-text">Override Price (ex GST)</span>
					</label>
					<input
						id="section-price"
						type="text"
						class="input input-bordered"
						placeholder="Leave blank to use template default"
						bind:value={sectionPrice}
					/>
				</div>
			</div>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (showAddSectionModal = false)}
					disabled={isAddingSection}
				>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={handleAddSection}
					disabled={isAddingSection || !selectedScopeTemplateId}
				>
					{#if isAddingSection}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Add Section
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showAddSectionModal = false)}></div>
	</div>
{/if}

<!-- Add Terms Modal -->
{#if showAddTermsModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Add Terms</h3>
			<div class="space-y-4 mt-4">
				<div class="form-control">
					<label class="label" for="terms-select">
						<span class="label-text">Terms Template</span>
					</label>
					<select
						id="terms-select"
						class="select select-bordered"
						bind:value={selectedTermsTemplateId}
					>
						<option value="">Select a terms template...</option>
						{#each availableTermsTemplates as tt (tt.id)}
							<option value={tt.id}>{tt.title}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (showAddTermsModal = false)}
					disabled={isAddingTerms}
				>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={handleAddTerms}
					disabled={isAddingTerms || !selectedTermsTemplateId}
				>
					{#if isAddingTerms}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Add Terms
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showAddTermsModal = false)}></div>
	</div>
{/if}

<!-- Remove Modal -->
{#if showRemoveModal && removingItem}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">
				Remove {removingItem.type === 'section' ? 'Section' : 'Terms'}
			</h3>
			<p class="py-4">
				Are you sure you want to remove <strong>{removingItem.name}</strong> from this template?
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeRemoveModal} disabled={isRemoving}>
					Cancel
				</button>
				<button class="btn btn-error" onclick={confirmRemove} disabled={isRemoving}>
					{#if isRemoving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Remove
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeRemoveModal}></div>
	</div>
{/if}

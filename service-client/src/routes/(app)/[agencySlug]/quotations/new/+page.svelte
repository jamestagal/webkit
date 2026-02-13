<script lang="ts">
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { createQuotation, getTemplateForQuotation } from '$lib/api/quotations.remote';
	import ClientPicker from '$lib/components/shared/ClientPicker.svelte';
	import { formatCurrency } from '$lib/utils/formatting';
	import { Plus, Trash2, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-svelte';
	import type { PageProps } from './$types';
	import type { ScopeSectionInput, TermsBlock } from '$lib/api/quotations.types';

	const toast = getToast();
	let { data }: PageProps = $props();
	let agencySlug = $derived(data.agency.slug);

	// Form state
	let isSubmitting = $state(false);
	let selectedTemplateId = $state<string | null>(null);
	let quotationName = $state('');

	// Client fields
	type Client = {
		id: string;
		businessName: string;
		email: string;
		contactName: string | null;
		phone: string | null;
	};
	let selectedClient = $state<Client | null>(data.prefillClient || null);
	let manualBusinessName = $state(data.prefillClient?.businessName || '');
	let manualEmail = $state(data.prefillClient?.email || '');
	let manualContactName = $state(data.prefillClient?.contactName || '');
	let manualPhone = $state(data.prefillClient?.phone || '');

	// Site fields
	let siteAddress = $state('');
	let siteReference = $state('');

	// Dates
	let preparedDate = $state(new Date().toISOString().split('T')[0]!);
	let expiryDate = $state(
		new Date(Date.now() + (data.profile?.defaultQuotationValidityDays ?? 60) * 86400000)
			.toISOString()
			.split('T')[0]!
	);

	// Scope sections
	let sections = $state<ScopeSectionInput[]>([]);

	// Pricing
	let discountAmount = $state('');
	let discountDescription = $state('');

	// Terms
	let termsBlocks = $state<TermsBlock[]>([]);

	// Options
	let optionsNotes = $state('');
	let notes = $state('');

	// Add scope section modal
	let showAddSectionModal = $state(false);
	let newSectionTitle = $state('');
	let selectedScopeTemplateId = $state<string | null>(null);

	// Calculated values
	let gstRegistered = $derived(data.profile?.gstRegistered ?? true);
	let gstRate = $derived(parseFloat(data.profile?.gstRate || '10.00'));

	let subtotal = $derived(
		sections.reduce((sum, s) => sum + parseFloat(s.sectionPrice || '0'), 0)
	);
	let discount = $derived(parseFloat(discountAmount || '0'));
	let gstAmount = $derived(gstRegistered ? (subtotal - discount) * (gstRate / 100) : 0);
	let total = $derived(subtotal - discount + gstAmount);

	// Template loading
	async function loadTemplate(templateId: string) {
		try {
			const result = await getTemplateForQuotation(templateId);
			sections = result.sections.map((s, i) => ({
				...s,
				sortOrder: i,
			}));
			termsBlocks = result.termsBlocks.map((t, i) => ({
				...t,
				sortOrder: i,
			}));
			quotationName = result.template.name;
			toast.success('Template loaded');
		} catch (err) {
			toast.error('Failed to load template', err instanceof Error ? err.message : '');
		}
	}

	async function handleTemplateChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const templateId = target.value;
		selectedTemplateId = templateId || null;
		if (templateId) {
			await loadTemplate(templateId);
		}
	}

	// Section management
	function openAddSectionModal() {
		newSectionTitle = '';
		selectedScopeTemplateId = null;
		showAddSectionModal = true;
	}

	function addSection() {
		if (selectedScopeTemplateId) {
			const scopeTemplate = data.scopeTemplates.find(
				(t: any) => t.id === selectedScopeTemplateId
			);
			if (scopeTemplate) {
				sections = [
					...sections,
					{
						title: scopeTemplate.name,
						workItems: Array.isArray(scopeTemplate.workItems)
							? [...(scopeTemplate.workItems as string[])]
							: [],
						sectionPrice: scopeTemplate.defaultPrice || '0.00',
						scopeTemplateId: scopeTemplate.id,
						sortOrder: sections.length,
					}
				];
			}
		} else if (newSectionTitle.trim()) {
			sections = [
				...sections,
				{
					title: newSectionTitle.trim(),
					workItems: [],
					sectionPrice: '0.00',
					scopeTemplateId: null,
					sortOrder: sections.length,
				}
			];
		}
		showAddSectionModal = false;
	}

	function removeSection(index: number) {
		sections = sections.filter((_, i) => i !== index);
		sections = sections.map((s, i) => ({ ...s, sortOrder: i }));
	}

	function moveSection(index: number, direction: -1 | 1) {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= sections.length) return;
		const items = [...sections];
		[items[index], items[newIndex]] = [items[newIndex]!, items[index]!];
		sections = items.map((s, i) => ({ ...s, sortOrder: i }));
	}

	// Work item management within a section
	function addWorkItem(sectionIndex: number) {
		sections = sections.map((s, i) =>
			i === sectionIndex ? { ...s, workItems: [...s.workItems, ''] } : s
		);
	}

	function updateWorkItem(sectionIndex: number, itemIndex: number, value: string) {
		sections = sections.map((s, i) =>
			i === sectionIndex
				? {
						...s,
						workItems: s.workItems.map((item, j) => (j === itemIndex ? value : item))
					}
				: s
		);
	}

	function removeWorkItem(sectionIndex: number, itemIndex: number) {
		sections = sections.map((s, i) =>
			i === sectionIndex
				? { ...s, workItems: s.workItems.filter((_, j) => j !== itemIndex) }
				: s
		);
	}

	function updateSectionPrice(index: number, value: string) {
		sections = sections.map((s, i) => (i === index ? { ...s, sectionPrice: value } : s));
	}

	function updateSectionTitle(index: number, value: string) {
		sections = sections.map((s, i) => (i === index ? { ...s, title: value } : s));
	}

	// Terms management
	function addTermsBlock() {
		termsBlocks = [
			...termsBlocks,
			{ title: '', content: '', sortOrder: termsBlocks.length }
		];
	}

	function removeTermsBlock(index: number) {
		termsBlocks = termsBlocks.filter((_, i) => i !== index);
		termsBlocks = termsBlocks.map((t, i) => ({ ...t, sortOrder: i }));
	}

	function updateTermsBlock(index: number, field: 'title' | 'content', value: string) {
		termsBlocks = termsBlocks.map((t, i) =>
			i === index ? { ...t, [field]: value } : t
		);
	}

	// Form submission
	async function handleSubmit() {
		const businessName = selectedClient?.businessName || manualBusinessName;
		const email = selectedClient?.email || manualEmail;

		if (!businessName.trim() || !email.trim()) {
			toast.error('Client business name and email are required');
			return;
		}

		if (sections.length === 0) {
			toast.error('At least one scope section is required');
			return;
		}

		isSubmitting = true;
		try {
			const quotation = await createQuotation({
				templateId: selectedTemplateId,
				quotationName: quotationName.trim(),
				clientBusinessName: businessName.trim(),
				clientContactName: (selectedClient?.contactName || manualContactName).trim(),
				clientEmail: email.trim(),
				clientPhone: (selectedClient?.phone || manualPhone).trim(),
				clientAddress: '',
				siteAddress: siteAddress.trim(),
				siteReference: siteReference.trim(),
				preparedDate,
				expiryDate,
				sections: sections.map((s) => ({
					...s,
					workItems: s.workItems.filter((w) => w.trim() !== ''),
				})),
				termsBlocks: termsBlocks.filter((t) => t.title.trim() || t.content.trim()),
				optionsNotes: optionsNotes.trim(),
				notes: notes.trim(),
				discountAmount: discountAmount || '0',
				discountDescription: discountDescription.trim(),
			});

			toast.success('Quotation created', quotation.quotationNumber);
			goto(`/${agencySlug}/quotations/${quotation.id}`);
		} catch (err) {
			toast.error('Failed to create quotation', err instanceof Error ? err.message : '');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="space-y-6 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a href="/{agencySlug}/quotations" class="btn btn-ghost btn-sm btn-square">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div>
			<h1 class="text-2xl font-bold">New Quotation</h1>
			<p class="text-base-content/70 mt-1">Create a new quotation for your client</p>
		</div>
	</div>

	<!-- Template Selection -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-base">Start from Template</h2>
			<div class="form-control">
				<select class="select select-bordered" onchange={handleTemplateChange}>
					<option value="">Start from Scratch</option>
					{#each data.templates as template (template.id)}
						<option value={template.id}>{template.name}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Client & Site Details -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-base">Client & Site Details</h2>

			<div class="space-y-4">
				<div class="form-control">
					<label class="label" for="quotation-name">
						<span class="label-text">Quotation Name</span>
					</label>
					<input
						id="quotation-name"
						type="text"
						class="input input-bordered"
						placeholder="e.g. Full Shower Retile - 123 Main St"
						bind:value={quotationName}
					/>
				</div>

				<ClientPicker
					selected={selectedClient}
					onSelect={(client) => {
						selectedClient = client;
						if (client) {
							manualBusinessName = client.businessName;
							manualEmail = client.email;
							manualContactName = client.contactName || '';
							manualPhone = client.phone || '';
						}
					}}
					showManualEntry={true}
					{manualBusinessName}
					{manualEmail}
					{manualContactName}
					{manualPhone}
					onManualBusinessNameChange={(v) => (manualBusinessName = v)}
					onManualEmailChange={(v) => (manualEmail = v)}
					onManualContactNameChange={(v) => (manualContactName = v)}
					onManualPhoneChange={(v) => (manualPhone = v)}
				/>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="site-address">
							<span class="label-text">Site Address</span>
						</label>
						<input
							id="site-address"
							type="text"
							class="input input-bordered"
							placeholder="Job site address"
							bind:value={siteAddress}
						/>
					</div>
					<div class="form-control">
						<label class="label" for="site-reference">
							<span class="label-text">Site Reference</span>
						</label>
						<input
							id="site-reference"
							type="text"
							class="input input-bordered"
							placeholder="e.g. Unit 5, Strata Plan 12345"
							bind:value={siteReference}
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="prepared-date">
							<span class="label-text">Prepared Date</span>
						</label>
						<input
							id="prepared-date"
							type="date"
							class="input input-bordered"
							bind:value={preparedDate}
						/>
					</div>
					<div class="form-control">
						<label class="label" for="expiry-date">
							<span class="label-text">Expiry Date</span>
						</label>
						<input
							id="expiry-date"
							type="date"
							class="input input-bordered"
							bind:value={expiryDate}
						/>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Scope Sections -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-base">Scope of Works</h2>
				<button type="button" class="btn btn-primary btn-sm" onclick={openAddSectionModal}>
					<Plus class="h-4 w-4" />
					Add Section
				</button>
			</div>

			{#if sections.length === 0}
				<div class="text-center py-8 text-base-content/60">
					<p>No scope sections yet. Add a section to define the work.</p>
				</div>
			{:else}
				<div class="space-y-4 mt-4">
					{#each sections as section, sectionIndex (sectionIndex)}
						<div class="border border-base-300 rounded-lg p-4">
							<div class="flex items-start justify-between gap-2 mb-3">
								<div class="flex items-center gap-2 flex-1">
									<div class="flex flex-col gap-0.5">
										<button
											type="button"
											class="btn btn-ghost btn-xs btn-square"
											onclick={() => moveSection(sectionIndex, -1)}
											disabled={sectionIndex === 0}
										>
											<ChevronUp class="h-3 w-3" />
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-xs btn-square"
											onclick={() => moveSection(sectionIndex, 1)}
											disabled={sectionIndex === sections.length - 1}
										>
											<ChevronDown class="h-3 w-3" />
										</button>
									</div>
									<input
										type="text"
										class="input input-bordered input-sm flex-1 font-semibold"
										value={section.title}
										oninput={(e) =>
											updateSectionTitle(sectionIndex, e.currentTarget.value)}
									/>
								</div>
								<button
									type="button"
									class="btn btn-ghost btn-sm btn-square text-error"
									onclick={() => removeSection(sectionIndex)}
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>

							<!-- Work Items -->
							<div class="space-y-2 mb-3">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium text-base-content/70"
										>Work Items</span
									>
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={() => addWorkItem(sectionIndex)}
									>
										<Plus class="h-3 w-3" />
										Add
									</button>
								</div>
								{#each section.workItems as item, itemIndex (itemIndex)}
									<div class="flex items-center gap-2">
										<input
											type="text"
											class="input input-bordered input-sm flex-1"
											placeholder="Work item description"
											value={item}
											oninput={(e) =>
												updateWorkItem(
													sectionIndex,
													itemIndex,
													e.currentTarget.value
												)}
										/>
										<button
											type="button"
											class="btn btn-ghost btn-xs btn-square text-error"
											onclick={() =>
												removeWorkItem(sectionIndex, itemIndex)}
										>
											<Trash2 class="h-3 w-3" />
										</button>
									</div>
								{/each}
							</div>

							<!-- Section Price -->
							<div class="flex items-center gap-4 pt-3 border-t border-base-200">
								<div class="form-control flex-1">
									<label class="label" for="section-price-{sectionIndex}">
										<span class="label-text text-sm">Price (ex GST)</span>
									</label>
									<input
										id="section-price-{sectionIndex}"
										type="text"
										class="input input-bordered input-sm"
										placeholder="0.00"
										value={section.sectionPrice}
										oninput={(e) =>
											updateSectionPrice(
												sectionIndex,
												e.currentTarget.value
											)}
									/>
								</div>
								{#if gstRegistered}
									{@const sectionGst =
										parseFloat(section.sectionPrice || '0') * (gstRate / 100)}
									{@const sectionTotal =
										parseFloat(section.sectionPrice || '0') + sectionGst}
									<div class="text-right text-sm">
										<div class="text-base-content/60">
											GST: {formatCurrency(sectionGst)}
										</div>
										<div class="font-semibold">
											Inc: {formatCurrency(sectionTotal)}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Pricing Summary -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-base">Pricing</h2>

			<div class="space-y-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="discount-amount">
							<span class="label-text">Discount Amount</span>
						</label>
						<input
							id="discount-amount"
							type="text"
							class="input input-bordered"
							placeholder="0.00"
							bind:value={discountAmount}
						/>
					</div>
					<div class="form-control">
						<label class="label" for="discount-desc">
							<span class="label-text">Discount Description</span>
						</label>
						<input
							id="discount-desc"
							type="text"
							class="input input-bordered"
							placeholder="e.g. Early acceptance discount"
							bind:value={discountDescription}
						/>
					</div>
				</div>

				<!-- Totals -->
				<div class="bg-base-200/50 rounded-lg p-4 space-y-2">
					<div class="flex justify-between text-sm">
						<span>Subtotal (ex GST)</span>
						<span>{formatCurrency(subtotal)}</span>
					</div>
					{#if discount > 0}
						<div class="flex justify-between text-sm text-error">
							<span>Discount</span>
							<span>-{formatCurrency(discount)}</span>
						</div>
					{/if}
					{#if gstRegistered}
						<div class="flex justify-between text-sm">
							<span>GST ({gstRate}%)</span>
							<span>{formatCurrency(gstAmount)}</span>
						</div>
					{/if}
					<div class="flex justify-between font-bold text-lg pt-2 border-t border-base-300">
						<span>Total (inc GST)</span>
						<span>{formatCurrency(total)}</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Terms & Options -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-base">Terms & Conditions</h2>
				<button type="button" class="btn btn-ghost btn-sm" onclick={addTermsBlock}>
					<Plus class="h-4 w-4" />
					Add Terms Block
				</button>
			</div>

			{#if termsBlocks.length === 0}
				<p class="text-sm text-base-content/60">
					No terms added. Load a template or add terms blocks manually.
				</p>
			{:else}
				<div class="space-y-4 mt-2">
					{#each termsBlocks as block, blockIndex (blockIndex)}
						<div class="border border-base-300 rounded-lg p-3">
							<div class="flex items-center justify-between gap-2 mb-2">
								<input
									type="text"
									class="input input-bordered input-sm flex-1"
									placeholder="Terms title"
									value={block.title}
									oninput={(e) =>
										updateTermsBlock(
											blockIndex,
											'title',
											e.currentTarget.value
										)}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-xs btn-square text-error"
									onclick={() => removeTermsBlock(blockIndex)}
								>
									<Trash2 class="h-3 w-3" />
								</button>
							</div>
							<textarea
								class="textarea textarea-bordered w-full"
								rows="3"
								placeholder="Terms content"
								value={block.content}
								oninput={(e) =>
									updateTermsBlock(blockIndex, 'content', e.currentTarget.value)}
							></textarea>
						</div>
					{/each}
				</div>
			{/if}

			<div class="form-control mt-4">
				<label class="label" for="options-notes">
					<span class="label-text">Options / Additional Notes (shown on quotation)</span>
				</label>
				<textarea
					id="options-notes"
					class="textarea textarea-bordered"
					rows="3"
					placeholder="Optional upgrades, alternative approaches, etc."
					bind:value={optionsNotes}
				></textarea>
			</div>

			<div class="form-control">
				<label class="label" for="internal-notes">
					<span class="label-text">Internal Notes (not shown on quotation)</span>
				</label>
				<textarea
					id="internal-notes"
					class="textarea textarea-bordered"
					rows="2"
					placeholder="Notes for your team only"
					bind:value={notes}
				></textarea>
			</div>
		</div>
	</div>

	<!-- Submit -->
	<div class="flex items-center justify-end gap-3">
		<a href="/{agencySlug}/quotations" class="btn btn-ghost">Cancel</a>
		<button
			type="button"
			class="btn btn-primary"
			onclick={handleSubmit}
			disabled={isSubmitting}
		>
			{#if isSubmitting}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			Create Quotation
		</button>
	</div>
</div>

<!-- Add Section Modal -->
{#if showAddSectionModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Add Scope Section</h3>

			<div class="space-y-4 mt-4">
				{#if data.scopeTemplates.length > 0}
					<div class="form-control">
						<label class="label" for="scope-template-picker">
							<span class="label-text">From Template</span>
						</label>
						<select
							id="scope-template-picker"
							class="select select-bordered"
							bind:value={selectedScopeTemplateId}
						>
							<option value={null}>Custom Section</option>
							{#each data.scopeTemplates as scopeTemplate (scopeTemplate.id)}
								<option value={scopeTemplate.id}>{scopeTemplate.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if !selectedScopeTemplateId}
					<div class="form-control">
						<label class="label" for="new-section-title">
							<span class="label-text"
								>Section Title <span class="text-error">*</span></span
							>
						</label>
						<input
							id="new-section-title"
							type="text"
							class="input input-bordered"
							placeholder="e.g. Demolition & Strip Out"
							bind:value={newSectionTitle}
						/>
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showAddSectionModal = false)}>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={addSection}
					disabled={!selectedScopeTemplateId && !newSectionTitle.trim()}
				>
					Add Section
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showAddSectionModal = false)}></div>
	</div>
{/if}

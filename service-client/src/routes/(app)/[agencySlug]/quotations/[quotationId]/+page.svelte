<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		updateQuotation,
		deleteQuotation,
		sendQuotation,
		duplicateQuotation
	} from '$lib/api/quotations.remote';
	import ClientPicker from '$lib/components/shared/ClientPicker.svelte';
	import SendEmailModal from '$lib/components/shared/SendEmailModal.svelte';
	import { formatCurrency, formatDate } from '$lib/utils/formatting';
	import {
		ArrowLeft,
		Plus,
		Trash2,
		Send,
		Copy,
		ExternalLink,
		CheckCircle,
		Clock,
		Eye,
		XCircle,
		AlertCircle,
		ChevronUp,
		ChevronDown,
		Save
	} from 'lucide-svelte';
	import type { PageProps } from './$types';
	import type { ScopeSectionInput, TermsBlock } from '$lib/api/quotations.types';

	const toast = getToast();
	let { data }: PageProps = $props();
	let agencySlug = $derived(data.agency.slug);

	let isDraft = $derived(data.quotation.status === 'draft');
	let effectiveStatus = $derived(data.quotation.effectiveStatus);
	let statusInfo = $derived(getStatusBadge(effectiveStatus));

	// Edit form state (only for draft)
	let isSaving = $state(false);
	let quotationName = $state(data.quotation.quotationName);

	// Client fields
	type Client = {
		id: string;
		businessName: string;
		email: string;
		contactName: string | null;
		phone: string | null;
	};
	let selectedClient = $state<Client | null>(null);
	let manualBusinessName = $state(data.quotation.clientBusinessName);
	let manualEmail = $state(data.quotation.clientEmail);
	let manualContactName = $state(data.quotation.clientContactName);
	let manualPhone = $state(data.quotation.clientPhone);

	// Site fields
	let siteAddress = $state(data.quotation.siteAddress);
	let siteReference = $state(data.quotation.siteReference);

	// Dates
	let preparedDate = $state(
		data.quotation.preparedDate
			? new Date(data.quotation.preparedDate).toISOString().split('T')[0]!
			: ''
	);
	let expiryDate = $state(
		data.quotation.expiryDate
			? new Date(data.quotation.expiryDate).toISOString().split('T')[0]!
			: ''
	);

	// Scope sections
	let sections = $state<ScopeSectionInput[]>(
		data.sections.map((s) => ({
			title: s.title,
			workItems: Array.isArray(s.workItems) ? [...(s.workItems as string[])] : [],
			sectionPrice: s.sectionPrice || '0.00',
			scopeTemplateId: s.scopeTemplateId || null,
			sortOrder: s.sortOrder,
		}))
	);

	// Pricing
	let discountAmount = $state(data.quotation.discountAmount || '');
	let discountDescription = $state(data.quotation.discountDescription || '');

	// Terms
	let termsBlocks = $state<TermsBlock[]>(
		Array.isArray(data.quotation.termsBlocks)
			? (data.quotation.termsBlocks as TermsBlock[]).map((t, i) => ({
					...t,
					sortOrder: t.sortOrder ?? i
				}))
			: []
	);

	// Options & notes
	let optionsNotes = $state(data.quotation.optionsNotes || '');
	let notes = $state(data.quotation.notes || '');

	// Modals
	let sendModalOpen = $state(false);
	let sendingEmail = $state(false);
	let showDeleteModal = $state(false);
	let isDeleting = $state(false);
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

	// Save handler
	async function handleSave() {
		isSaving = true;
		try {
			await updateQuotation({
				quotationId: data.quotation.id,
				quotationName: quotationName.trim(),
				clientBusinessName: (selectedClient?.businessName || manualBusinessName).trim(),
				clientContactName: (selectedClient?.contactName || manualContactName).trim(),
				clientEmail: (selectedClient?.email || manualEmail).trim(),
				clientPhone: (selectedClient?.phone || manualPhone).trim(),
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
			await invalidateAll();
			toast.success('Quotation saved');
		} catch (err) {
			toast.error('Failed to save', err instanceof Error ? err.message : '');
		} finally {
			isSaving = false;
		}
	}

	// Send handler
	async function confirmSendEmail() {
		sendingEmail = true;
		try {
			await sendQuotation(data.quotation.id);
			await invalidateAll();
			sendModalOpen = false;
			toast.success('Quotation sent');
		} catch (err) {
			toast.error('Failed to send', err instanceof Error ? err.message : '');
		} finally {
			sendingEmail = false;
		}
	}

	// Delete handler
	async function confirmDelete() {
		isDeleting = true;
		try {
			await deleteQuotation(data.quotation.id);
			toast.success('Quotation deleted');
			goto(`/${agencySlug}/quotations`);
		} catch (err) {
			toast.error('Failed to delete', err instanceof Error ? err.message : '');
		} finally {
			isDeleting = false;
		}
	}

	// Duplicate handler
	async function handleDuplicate() {
		try {
			const newQuotation = await duplicateQuotation(data.quotation.id);
			toast.success('Quotation duplicated');
			goto(`/${agencySlug}/quotations/${newQuotation.id}`);
		} catch (err) {
			toast.error('Failed to duplicate', err instanceof Error ? err.message : '');
		}
	}

	function copyPublicUrl() {
		const url = `${window.location.origin}/q/${data.quotation.slug}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'draft':
				return { class: 'badge-ghost', icon: Clock, label: 'Draft' };
			case 'sent':
				return { class: 'badge-info', icon: Send, label: 'Sent' };
			case 'viewed':
				return { class: 'badge-warning', icon: Eye, label: 'Viewed' };
			case 'accepted':
				return { class: 'badge-success', icon: CheckCircle, label: 'Accepted' };
			case 'declined':
				return { class: 'badge-error', icon: XCircle, label: 'Declined' };
			case 'expired':
				return { class: 'badge-neutral', icon: AlertCircle, label: 'Expired' };
			default:
				return { class: 'badge-ghost', icon: Clock, label: status };
		}
	}
</script>

<div class="space-y-6 max-w-4xl">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex items-center gap-3">
			<a href="/{agencySlug}/quotations" class="btn btn-ghost btn-sm btn-square">
				<ArrowLeft class="h-4 w-4" />
			</a>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold">{data.quotation.quotationNumber}</h1>
					<span class="badge {statusInfo.class} gap-1">
						<svelte:component this={statusInfo.icon} class="h-3 w-3" />
						{statusInfo.label}
					</span>
				</div>
				{#if data.quotation.quotationName}
					<p class="text-base-content/70 mt-1">{data.quotation.quotationName}</p>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2 flex-wrap">
			{#if isDraft}
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={handleSave}
					disabled={isSaving}
				>
					{#if isSaving}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Save class="h-4 w-4" />
					{/if}
					Save
				</button>
				<button
					type="button"
					class="btn btn-info btn-sm"
					onclick={() => (sendModalOpen = true)}
				>
					<Send class="h-4 w-4" />
					Send
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => handleDuplicate()}
				>
					<Copy class="h-4 w-4" />
					Duplicate
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm text-error"
					onclick={() => (showDeleteModal = true)}
				>
					<Trash2 class="h-4 w-4" />
					Delete
				</button>
			{:else if ['sent', 'viewed'].includes(effectiveStatus)}
				<button
					type="button"
					class="btn btn-info btn-sm"
					onclick={() => (sendModalOpen = true)}
				>
					<Send class="h-4 w-4" />
					Resend
				</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={copyPublicUrl}>
					<ExternalLink class="h-4 w-4" />
					Copy Link
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => handleDuplicate()}
				>
					<Copy class="h-4 w-4" />
					Duplicate
				</button>
			{:else if effectiveStatus === 'accepted'}
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => handleDuplicate()}
				>
					<Copy class="h-4 w-4" />
					Duplicate
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => handleDuplicate()}
				>
					<Copy class="h-4 w-4" />
					Duplicate
				</button>
			{/if}
		</div>
	</div>

	{#if isDraft}
		<!-- EDIT MODE -->

		<!-- Client & Site Details -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base">Client & Site Details</h2>

				<div class="space-y-4">
					<div class="form-control">
						<label class="label" for="edit-quotation-name">
							<span class="label-text">Quotation Name</span>
						</label>
						<input
							id="edit-quotation-name"
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
							<label class="label" for="edit-site-address">
								<span class="label-text">Site Address</span>
							</label>
							<input
								id="edit-site-address"
								type="text"
								class="input input-bordered"
								bind:value={siteAddress}
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-site-reference">
								<span class="label-text">Site Reference</span>
							</label>
							<input
								id="edit-site-reference"
								type="text"
								class="input input-bordered"
								bind:value={siteReference}
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="form-control">
							<label class="label" for="edit-prepared-date">
								<span class="label-text">Prepared Date</span>
							</label>
							<input
								id="edit-prepared-date"
								type="date"
								class="input input-bordered"
								bind:value={preparedDate}
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-expiry-date">
								<span class="label-text">Expiry Date</span>
							</label>
							<input
								id="edit-expiry-date"
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
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={openAddSectionModal}
					>
						<Plus class="h-4 w-4" />
						Add Section
					</button>
				</div>

				{#if sections.length === 0}
					<div class="text-center py-8 text-base-content/60">
						<p>No scope sections yet.</p>
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
												updateSectionTitle(
													sectionIndex,
													e.currentTarget.value
												)}
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
								<div
									class="flex items-center gap-4 pt-3 border-t border-base-200"
								>
									<div class="form-control flex-1">
										<label
											class="label"
											for="edit-section-price-{sectionIndex}"
										>
											<span class="label-text text-sm">Price (ex GST)</span>
										</label>
										<input
											id="edit-section-price-{sectionIndex}"
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
											parseFloat(section.sectionPrice || '0') *
											(gstRate / 100)}
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
							<label class="label" for="edit-discount">
								<span class="label-text">Discount Amount</span>
							</label>
							<input
								id="edit-discount"
								type="text"
								class="input input-bordered"
								placeholder="0.00"
								bind:value={discountAmount}
							/>
						</div>
						<div class="form-control">
							<label class="label" for="edit-discount-desc">
								<span class="label-text">Discount Description</span>
							</label>
							<input
								id="edit-discount-desc"
								type="text"
								class="input input-bordered"
								bind:value={discountDescription}
							/>
						</div>
					</div>

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
						<div
							class="flex justify-between font-bold text-lg pt-2 border-t border-base-300"
						>
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
					<p class="text-sm text-base-content/60">No terms added.</p>
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
										updateTermsBlock(
											blockIndex,
											'content',
											e.currentTarget.value
										)}
								></textarea>
							</div>
						{/each}
					</div>
				{/if}

				<div class="form-control mt-4">
					<label class="label" for="edit-options">
						<span class="label-text">Options / Additional Notes</span>
					</label>
					<textarea
						id="edit-options"
						class="textarea textarea-bordered"
						rows="3"
						bind:value={optionsNotes}
					></textarea>
				</div>

				<div class="form-control">
					<label class="label" for="edit-internal-notes">
						<span class="label-text">Internal Notes</span>
					</label>
					<textarea
						id="edit-internal-notes"
						class="textarea textarea-bordered"
						rows="2"
						bind:value={notes}
					></textarea>
				</div>
			</div>
		</div>
	{:else}
		<!-- VIEW MODE (sent/viewed/accepted/declined/expired) -->

		<!-- Info Cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<h3 class="text-sm font-semibold text-base-content/60 uppercase">Client</h3>
					<p class="font-medium">{data.quotation.clientBusinessName}</p>
					{#if data.quotation.clientContactName}
						<p class="text-sm text-base-content/70">
							{data.quotation.clientContactName}
						</p>
					{/if}
					<p class="text-sm text-base-content/70">{data.quotation.clientEmail}</p>
					{#if data.quotation.clientPhone}
						<p class="text-sm text-base-content/70">
							{data.quotation.clientPhone}
						</p>
					{/if}
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<h3 class="text-sm font-semibold text-base-content/60 uppercase">Details</h3>
					{#if data.quotation.siteAddress}
						<p class="text-sm">
							<span class="text-base-content/60">Site:</span>
							{data.quotation.siteAddress}
						</p>
					{/if}
					<p class="text-sm">
						<span class="text-base-content/60">Prepared:</span>
						{formatDate(data.quotation.preparedDate)}
					</p>
					<p class="text-sm">
						<span class="text-base-content/60">Expires:</span>
						{formatDate(data.quotation.expiryDate)}
					</p>
					{#if data.quotation.viewCount > 0}
						<p class="text-sm">
							<span class="text-base-content/60">Views:</span>
							{data.quotation.viewCount}
						</p>
					{/if}
				</div>
			</div>
		</div>

		{#if effectiveStatus === 'accepted' && data.quotation.acceptedByName}
			<div class="alert alert-success">
				<CheckCircle class="h-5 w-5" />
				<div>
					<p class="font-medium">
						Accepted by {data.quotation.acceptedByName}
						{#if data.quotation.acceptedByTitle}
							({data.quotation.acceptedByTitle})
						{/if}
					</p>
					{#if data.quotation.acceptedAt}
						<p class="text-sm">{formatDate(data.quotation.acceptedAt)}</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if effectiveStatus === 'declined'}
			<div class="alert alert-error">
				<XCircle class="h-5 w-5" />
				<div>
					<p class="font-medium">Declined</p>
					{#if data.quotation.declineReason}
						<p class="text-sm">{data.quotation.declineReason}</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Scope Sections (read-only) -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base">Scope of Works</h2>

				<div class="space-y-4 mt-2">
					{#each data.sections as section (section.id)}
						<div class="border border-base-300 rounded-lg p-4">
							<h3 class="font-semibold">{section.title}</h3>
							{#if Array.isArray(section.workItems) && (section.workItems as string[]).length > 0}
								<ul class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
									{#each section.workItems as string[] as item}
										<li class="flex items-start gap-2 text-sm">
											<span class="text-primary mt-0.5">•</span>
											<span>{item}</span>
										</li>
									{/each}
								</ul>
							{/if}
							{#if section.sectionPrice}
								<div
									class="flex items-center justify-between mt-3 pt-3 border-t border-base-200"
								>
									<span class="text-sm text-base-content/60">Section Price</span
									>
									<div class="text-right">
										<span class="font-semibold"
											>{formatCurrency(
												parseFloat(section.sectionPrice)
											)}</span
										>
										{#if section.sectionTotal}
											<span class="text-sm text-base-content/60 ml-2"
												>(inc GST: {formatCurrency(
													parseFloat(section.sectionTotal)
												)})</span
											>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Pricing (read-only) -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base">Pricing</h2>
				<div class="bg-base-200/50 rounded-lg p-4 space-y-2">
					<div class="flex justify-between text-sm">
						<span>Subtotal (ex GST)</span>
						<span>{formatCurrency(parseFloat(data.quotation.subtotal))}</span>
					</div>
					{#if parseFloat(data.quotation.discountAmount) > 0}
						<div class="flex justify-between text-sm text-error">
							<span>
								Discount
								{#if data.quotation.discountDescription}
									({data.quotation.discountDescription})
								{/if}
							</span>
							<span
								>-{formatCurrency(
									parseFloat(data.quotation.discountAmount)
								)}</span
							>
						</div>
					{/if}
					{#if data.quotation.gstRegistered}
						<div class="flex justify-between text-sm">
							<span>GST ({data.quotation.gstRate}%)</span>
							<span
								>{formatCurrency(parseFloat(data.quotation.gstAmount))}</span
							>
						</div>
					{/if}
					<div
						class="flex justify-between font-bold text-lg pt-2 border-t border-base-300"
					>
						<span>Total (inc GST)</span>
						<span>{formatCurrency(parseFloat(data.quotation.total))}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Terms (read-only) -->
		{#if Array.isArray(data.quotation.termsBlocks) && (data.quotation.termsBlocks as any[]).length > 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base">Terms & Conditions</h2>
					<div class="space-y-4 mt-2">
						{#each data.quotation.termsBlocks as any[] as block}
							<div>
								<h3 class="font-semibold text-sm">{block.title}</h3>
								<div class="text-sm text-base-content/70 mt-1 whitespace-pre-wrap">
									{block.content}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		{#if data.quotation.optionsNotes}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base">Options / Additional Notes</h2>
					<div class="whitespace-pre-wrap text-sm">
						{data.quotation.optionsNotes}
					</div>
				</div>
			</div>
		{/if}

		{#if data.quotation.notes}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base">Internal Notes</h2>
					<div class="whitespace-pre-wrap text-sm text-base-content/70">
						{data.quotation.notes}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Send Email Modal -->
<SendEmailModal
	open={sendModalOpen}
	title={isDraft ? 'Send Quotation' : 'Resend Quotation'}
	documentType="quotation"
	recipientEmail={data.quotation.clientEmail}
	recipientName={data.quotation.clientBusinessName}
	loading={sendingEmail}
	onConfirm={confirmSendEmail}
	onCancel={() => (sendModalOpen = false)}
/>

<!-- Delete Modal -->
{#if showDeleteModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Quotation</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{data.quotation.quotationNumber}</strong>?
				This action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (showDeleteModal = false)}
					disabled={isDeleting}
				>
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
		<div class="modal-backdrop" onclick={() => (showDeleteModal = false)}></div>
	</div>
{/if}

<!-- Add Section Modal -->
{#if showAddSectionModal}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Add Scope Section</h3>

			<div class="space-y-4 mt-4">
				{#if data.scopeTemplates.length > 0}
					<div class="form-control">
						<label class="label" for="edit-scope-template-picker">
							<span class="label-text">From Template</span>
						</label>
						<select
							id="edit-scope-template-picker"
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
						<label class="label" for="edit-new-section-title">
							<span class="label-text"
								>Section Title <span class="text-error">*</span></span
							>
						</label>
						<input
							id="edit-new-section-title"
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

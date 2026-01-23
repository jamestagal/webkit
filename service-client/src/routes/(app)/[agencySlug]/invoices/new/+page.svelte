<script lang="ts">
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createInvoice,
		createInvoiceFromProposal,
		createInvoiceFromContract
	} from '$lib/api/invoices.remote';
	import DraggableList from '$lib/components/DraggableList.svelte';
	import ClientPicker from '$lib/components/shared/ClientPicker.svelte';
	import {
		ArrowLeft,
		Plus,
		Trash2,
		FileText,
		FileSignature,
		Loader2,
		GripVertical
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let saving = $state(false);
	let createMode = $state<'standalone' | 'proposal' | 'contract'>('standalone');
	let selectedProposalId = $state<string | null>(null);
	let selectedContractId = $state<string | null>(null);

	// Client picker state
	type Client = {
		id: string;
		businessName: string;
		email: string;
		contactName: string | null;
		phone: string | null;
	};
	let selectedClient = $state<Client | null>(
		data.prefillClient
			? {
					id: data.prefillClient.id ?? '',
					businessName: data.prefillClient.businessName ?? '',
					email: data.prefillClient.email ?? '',
					contactName: data.prefillClient.contactName ?? null,
					phone: data.prefillClient.phone ?? null
				}
			: null
	);

	// Form state - pre-fill from clientId URL param if provided (Quick Create from Client Hub)
	let clientBusinessName = $state(data.prefillClient?.businessName ?? '');
	let clientContactName = $state(data.prefillClient?.contactName ?? '');
	let clientEmail = $state(data.prefillClient?.email ?? '');
	let clientPhone = $state(data.prefillClient?.phone ?? '');
	let clientAddress = $state('');
	let clientAbn = $state('');
	let issueDate = $state(new Date().toISOString().split('T')[0]);
	let paymentTerms = $state(data.profile?.defaultPaymentTerms || 'NET_14');
	let paymentTermsCustom = $state('');
	let notes = $state('');
	let publicNotes = $state('');
	let discountAmount = $state('0.00');
	let discountDescription = $state('');

	// Line items
	interface LineItem {
		id: string;
		description: string;
		quantity: string;
		unitPrice: string;
		isTaxable: boolean;
		category: string;
	}

	let lineItems = $state<LineItem[]>([
		{
			id: crypto.randomUUID(),
			description: '',
			quantity: '1.00',
			unitPrice: '0.00',
			isTaxable: true,
			category: ''
		}
	]);

	// Calculations
	let subtotal = $derived(() => {
		return lineItems.reduce((sum, item) => {
			return sum + parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0');
		}, 0);
	});

	let discount = $derived(() => parseFloat(discountAmount || '0'));

	let gstAmount = $derived(() => {
		if (!data.profile?.gstRegistered) return 0;
		const rate = parseFloat(data.profile?.gstRate || '10.00') / 100;
		const taxableAmount = lineItems.reduce((sum, item) => {
			if (!item.isTaxable) return sum;
			return sum + parseFloat(item.quantity || '0') * parseFloat(item.unitPrice || '0');
		}, 0);
		return (taxableAmount - discount()) * rate;
	});

	let total = $derived(() => subtotal() - discount() + gstAmount());

	function addLineItem() {
		lineItems = [
			...lineItems,
			{
				id: crypto.randomUUID(),
				description: '',
				quantity: '1.00',
				unitPrice: '0.00',
				isTaxable: true,
				category: ''
			}
		];
	}

	function removeLineItem(id: string) {
		if (lineItems.length === 1) return;
		lineItems = lineItems.filter((item) => item.id !== id);
	}

	function handleReorder(newItems: LineItem[]) {
		lineItems = newItems;
	}

	function addPackageAsLineItem(pkg: (typeof data.packages)[0]) {
		const price =
			pkg.pricingModel === 'subscription'
				? parseFloat(pkg.monthlyPrice as string)
				: parseFloat(pkg.oneTimePrice as string);

		lineItems = [
			...lineItems,
			{
				id: crypto.randomUUID(),
				description: pkg.name,
				quantity: '1.00',
				unitPrice: price.toFixed(2),
				isTaxable: true,
				category: 'package'
			}
		];
	}

	function addAddonAsLineItem(addon: (typeof data.addons)[0]) {
		lineItems = [
			...lineItems,
			{
				id: crypto.randomUUID(),
				description: addon.name,
				quantity: '1.00',
				unitPrice: parseFloat(addon.price as string).toFixed(2),
				isTaxable: true,
				category: 'addon'
			}
		];
	}

	function isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		// Client-side validation before setting saving state
		if (createMode === 'standalone') {
			if (!clientBusinessName.trim()) {
				toast.error('Validation Error', 'Client business name is required');
				return;
			}
			if (!clientEmail.trim()) {
				toast.error('Validation Error', 'Client email is required');
				return;
			}
			if (!isValidEmail(clientEmail)) {
				toast.error('Validation Error', 'Please enter a valid email address');
				return;
			}
			if (lineItems.filter((i) => i.description.trim()).length === 0) {
				toast.error('Validation Error', 'At least one line item with a description is required');
				return;
			}
		}

		saving = true;

		try {
			let invoice;

			if (createMode === 'proposal' && selectedProposalId) {
				invoice = await createInvoiceFromProposal(selectedProposalId);
			} else if (createMode === 'contract' && selectedContractId) {
				invoice = await createInvoiceFromContract(selectedContractId);
			} else {
				invoice = await createInvoice({
					clientBusinessName,
					clientContactName,
					clientEmail,
					clientPhone,
					clientAddress,
					clientAbn,
					issueDate,
					paymentTerms: paymentTerms as 'DUE_ON_RECEIPT' | 'NET_7' | 'NET_14' | 'NET_30' | 'CUSTOM',
					paymentTermsCustom,
					notes,
					publicNotes,
					discountAmount: String(discountAmount),
					discountDescription,
					lineItems: lineItems
						.filter((i) => i.description.trim())
						.map((item) => ({
							description: item.description,
							quantity: String(item.quantity),
							unitPrice: String(item.unitPrice),
							isTaxable: item.isTaxable,
							category: item.category || undefined
						}))
				});
			}

			toast.success('Invoice created successfully');
			await goto(`/${agencySlug}/invoices/${invoice.id}`);
		} catch (err) {
			console.error('Invoice creation error:', err);
			let errorMessage = 'An unexpected error occurred';

			// HttpError from SvelteKit has a body property with error details
			if (err && typeof err === 'object') {
				if ('body' in err) {
					const body = err.body;
					if (typeof body === 'string') {
						errorMessage = body;
					} else if (body && typeof body === 'object') {
						const b = body as Record<string, unknown>;
						errorMessage = (b.message as string) || (b.error as string) || 'Please check all fields are filled correctly';
					}
				} else if (err instanceof Error) {
					errorMessage = err.message;
				}
			}

			toast.error('Failed to create invoice', errorMessage);
		} finally {
			saving = false;
		}
	}

	function formatCurrency(value: number) {
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD'
		}).format(value);
	}

	// Load client details when selecting proposal/contract
	function loadFromProposal(proposalId: string) {
		const proposal = data.proposals.find((p) => p.id === proposalId);
		if (proposal) {
			clientBusinessName = proposal.clientBusinessName || '';
			clientContactName = proposal.clientContactName || '';
			clientEmail = proposal.clientEmail || '';
			clientPhone = proposal.clientPhone || '';
		}
	}

	function loadFromContract(contractId: string) {
		const contract = data.contracts.find((c) => c.id === contractId);
		if (contract) {
			clientBusinessName = contract.clientBusinessName || '';
			clientContactName = contract.clientContactName || '';
			clientEmail = contract.clientEmail || '';
			clientPhone = contract.clientPhone || '';
			clientAddress = contract.clientAddress || '';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center gap-4">
		<a href="/{agencySlug}/invoices" class="btn btn-ghost btn-sm btn-square">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div>
			<h1 class="text-2xl font-bold">New Invoice</h1>
			<p class="text-base-content/70">Create a new invoice for a client</p>
		</div>
	</div>

	<!-- Create Mode Selector -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Create From</h2>
			<div class="flex flex-wrap gap-4">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="radio"
						name="createMode"
						class="radio radio-primary"
						value="standalone"
						checked={createMode === 'standalone'}
						onchange={() => (createMode = 'standalone')}
					/>
					<span>Standalone Invoice</span>
				</label>

				{#if data.proposals.length > 0}
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="createMode"
							class="radio radio-primary"
							value="proposal"
							checked={createMode === 'proposal'}
							onchange={() => (createMode = 'proposal')}
						/>
						<FileText class="h-4 w-4" />
						<span>From Proposal</span>
					</label>
				{/if}

				{#if data.contracts.length > 0}
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="createMode"
							class="radio radio-primary"
							value="contract"
							checked={createMode === 'contract'}
							onchange={() => (createMode = 'contract')}
						/>
						<FileSignature class="h-4 w-4" />
						<span>From Contract</span>
					</label>
				{/if}
			</div>

			{#if createMode === 'proposal'}
				<div class="form-control mt-4">
					<label class="label" for="proposal-select">
						<span class="label-text">Select Proposal</span>
					</label>
					<select
						id="proposal-select"
						class="select select-bordered"
						bind:value={selectedProposalId}
						onchange={() => selectedProposalId && loadFromProposal(selectedProposalId)}
					>
						<option value="">Choose a proposal...</option>
						{#each data.proposals as proposal}
							<option value={proposal.id}>
								{proposal.proposalNumber} - {proposal.clientBusinessName}
							</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if createMode === 'contract'}
				<div class="form-control mt-4">
					<label class="label" for="contract-select">
						<span class="label-text">Select Contract</span>
					</label>
					<select
						id="contract-select"
						class="select select-bordered"
						bind:value={selectedContractId}
						onchange={() => selectedContractId && loadFromContract(selectedContractId)}
					>
						<option value="">Choose a contract...</option>
						{#each data.contracts as contract}
							<option value={contract.id}>
								{contract.contractNumber} - {contract.clientBusinessName}
							</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>
	</div>

	{#if createMode === 'standalone' || (createMode === 'proposal' && selectedProposalId) || (createMode === 'contract' && selectedContractId)}
		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- Client Details -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Client Details</h2>

					{#if createMode === 'standalone'}
						<!-- Client Picker with search -->
						<ClientPicker
							selected={selectedClient}
							onSelect={(client) => {
								selectedClient = client;
								if (client) {
									clientBusinessName = client.businessName;
									clientEmail = client.email;
									clientContactName = client.contactName || '';
									clientPhone = client.phone || '';
								}
							}}
							showManualEntry={true}
							manualBusinessName={clientBusinessName}
							manualEmail={clientEmail}
							manualContactName={clientContactName}
							manualPhone={clientPhone}
							onManualBusinessNameChange={(v) => (clientBusinessName = v)}
							onManualEmailChange={(v) => (clientEmail = v)}
							onManualContactNameChange={(v) => (clientContactName = v)}
							onManualPhoneChange={(v) => (clientPhone = v)}
						/>

						<!-- Additional fields not in ClientPicker -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
							<div class="form-control md:col-span-2">
								<label class="label" for="clientAddress">
									<span class="label-text">Address</span>
								</label>
								<textarea
									id="clientAddress"
									class="textarea textarea-bordered w-full"
									rows="2"
									bind:value={clientAddress}
								></textarea>
							</div>
							<div class="form-control">
								<label class="label" for="clientAbn">
									<span class="label-text">ABN</span>
								</label>
								<input
									type="text"
									id="clientAbn"
									class="input input-bordered"
									bind:value={clientAbn}
								/>
							</div>
						</div>
					{:else}
						<!-- Read-only client info from proposal/contract -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="form-control">
								<label class="label" for="clientBusinessName">
									<span class="label-text">Business Name *</span>
								</label>
								<input
									type="text"
									id="clientBusinessName"
									class="input input-bordered"
									bind:value={clientBusinessName}
									required
								/>
							</div>
							<div class="form-control">
								<label class="label" for="clientContactName">
									<span class="label-text">Contact Name</span>
								</label>
								<input
									type="text"
									id="clientContactName"
									class="input input-bordered"
									bind:value={clientContactName}
								/>
							</div>
							<div class="form-control">
								<label class="label" for="clientEmail">
									<span class="label-text">Email *</span>
								</label>
								<input
									type="email"
									id="clientEmail"
									class="input input-bordered"
									bind:value={clientEmail}
									required
								/>
							</div>
							<div class="form-control">
								<label class="label" for="clientPhone">
									<span class="label-text">Phone</span>
								</label>
								<input
									type="tel"
									id="clientPhone"
									class="input input-bordered"
									bind:value={clientPhone}
								/>
							</div>
							<div class="form-control md:col-span-2">
								<label class="label" for="clientAddress">
									<span class="label-text">Address</span>
								</label>
								<textarea
									id="clientAddress"
									class="textarea textarea-bordered w-full"
									rows="2"
									bind:value={clientAddress}
								></textarea>
							</div>
							<div class="form-control">
								<label class="label" for="clientAbn">
									<span class="label-text">ABN</span>
								</label>
								<input
									type="text"
									id="clientAbn"
									class="input input-bordered"
									bind:value={clientAbn}
								/>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Invoice Details -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Invoice Details</h2>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="form-control">
							<label class="label" for="issueDate">
								<span class="label-text">Issue Date</span>
							</label>
							<input
								type="date"
								id="issueDate"
								class="input input-bordered"
								bind:value={issueDate}
							/>
						</div>
						<div class="form-control">
							<label class="label" for="paymentTerms">
								<span class="label-text">Payment Terms</span>
							</label>
							<select id="paymentTerms" class="select select-bordered" bind:value={paymentTerms}>
								<option value="DUE_ON_RECEIPT">Due on Receipt</option>
								<option value="NET_7">Net 7</option>
								<option value="NET_14">Net 14</option>
								<option value="NET_30">Net 30</option>
								<option value="CUSTOM">Custom</option>
							</select>
						</div>
						{#if paymentTerms === 'CUSTOM'}
							<div class="form-control">
								<label class="label" for="paymentTermsCustom">
									<span class="label-text">Custom Terms</span>
								</label>
								<input
									type="text"
									id="paymentTermsCustom"
									class="input input-bordered"
									bind:value={paymentTermsCustom}
									placeholder="e.g., 50% upfront, 50% on completion"
								/>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Line Items -->
			{#if createMode === 'standalone'}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<div class="flex justify-between items-center">
							<h2 class="card-title text-lg">Line Items</h2>
							<button type="button" class="btn btn-ghost btn-sm" onclick={addLineItem}>
								<Plus class="h-4 w-4" />
								Add Item
							</button>
						</div>

						<!-- Quick Add from Packages/Addons -->
						{#if data.packages.length > 0 || data.addons.length > 0}
							<div class="flex flex-wrap gap-2 mt-2">
								<span class="text-sm text-base-content/60">Quick add:</span>
								{#each data.packages as pkg}
									<button
										type="button"
										class="badge badge-outline cursor-pointer hover:badge-primary"
										onclick={() => addPackageAsLineItem(pkg)}
									>
										{pkg.name}
									</button>
								{/each}
								{#each data.addons as addon}
									<button
										type="button"
										class="badge badge-outline cursor-pointer hover:badge-secondary"
										onclick={() => addAddonAsLineItem(addon)}
									>
										{addon.name}
									</button>
								{/each}
							</div>
						{/if}

						<!-- Line Items Header -->
						<div class="mt-4 hidden md:grid grid-cols-[32px_1fr_80px_100px_60px_100px_32px] gap-2 text-sm font-medium text-base-content/60 px-2">
							<div></div>
							<div>Description</div>
							<div>Qty</div>
							<div>Unit Price</div>
							<div>Tax</div>
							<div class="text-right">Amount</div>
							<div></div>
						</div>

						<!-- Line Items List -->
						<DraggableList items={lineItems} onReorder={handleReorder} class="space-y-2 mt-2">
							{#snippet item(lineItem, _index, isDragging, isDragOver)}
								<div
									class="grid grid-cols-1 md:grid-cols-[32px_1fr_80px_100px_60px_100px_32px] gap-2 items-center p-2 bg-base-100 rounded-lg border border-base-200 transition-all duration-200"
									class:opacity-50={isDragging}
									class:border-primary={isDragOver}
									class:scale-[1.02]={isDragOver}
								>
									<div class="hidden md:flex items-center justify-center text-base-content/40 cursor-grab active:cursor-grabbing">
										<GripVertical class="h-4 w-4" />
									</div>
									<div>
										<input
											type="text"
											class="input input-bordered input-sm w-full"
											placeholder="Item description"
											bind:value={lineItem.description}
										/>
									</div>
									<div>
										<input
											type="number"
											step="0.01"
											class="input input-bordered input-sm w-full"
											bind:value={lineItem.quantity}
										/>
									</div>
									<div>
										<input
											type="number"
											step="0.01"
											class="input input-bordered input-sm w-full"
											bind:value={lineItem.unitPrice}
										/>
									</div>
									<div class="flex items-center justify-center">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											bind:checked={lineItem.isTaxable}
										/>
									</div>
									<div class="text-right font-medium text-sm">
										{formatCurrency(
											parseFloat(lineItem.quantity || '0') * parseFloat(lineItem.unitPrice || '0')
										)}
									</div>
									<div class="flex items-center justify-center">
										<button
											type="button"
											class="btn btn-ghost btn-sm btn-square text-error"
											onclick={() => removeLineItem(lineItem.id)}
											disabled={lineItems.length === 1}
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								</div>
							{/snippet}
						</DraggableList>
					</div>
				</div>
			{/if}

			<!-- Totals & Discount -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex flex-col md:flex-row gap-8">
						<!-- Discount -->
						{#if createMode === 'standalone'}
							<div class="flex-1">
								<h3 class="font-medium mb-4">Discount</h3>
								<div class="grid grid-cols-2 gap-4">
									<div class="form-control">
										<label class="label" for="discountAmount">
											<span class="label-text">Amount</span>
										</label>
										<input
											type="number"
											step="0.01"
											id="discountAmount"
											class="input input-bordered"
											bind:value={discountAmount}
										/>
									</div>
									<div class="form-control">
										<label class="label" for="discountDescription">
											<span class="label-text">Description</span>
										</label>
										<input
											type="text"
											id="discountDescription"
											class="input input-bordered"
											placeholder="e.g., Early bird"
											bind:value={discountDescription}
										/>
									</div>
								</div>
							</div>
						{/if}

						<!-- Totals -->
						<div class="flex-1">
							<h3 class="font-medium mb-4">Summary</h3>
							<div class="space-y-2 max-w-xs ml-auto">
								<div class="flex justify-between">
									<span class="text-base-content/70">Subtotal</span>
									<span>{formatCurrency(subtotal())}</span>
								</div>
								{#if discount() > 0}
									<div class="flex justify-between text-success">
										<span>
											Discount{discountDescription ? ` (${discountDescription})` : ''}
										</span>
										<span>-{formatCurrency(discount())}</span>
									</div>
								{/if}
								{#if data.profile?.gstRegistered}
									<div class="flex justify-between">
										<span class="text-base-content/70">
											GST ({data.profile?.gstRate || 10}%)
										</span>
										<span>{formatCurrency(gstAmount())}</span>
									</div>
								{/if}
								<div class="flex justify-between font-bold text-lg border-t border-base-300 pt-2">
									<span>Total</span>
									<span>{formatCurrency(total())}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Notes -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-lg">Notes</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="form-control">
							<label class="label" for="notes">
								<span class="label-text">Internal Notes</span>
							</label>
							<textarea
								id="notes"
								class="textarea textarea-bordered w-full"
								rows="3"
								placeholder="Notes for internal use only..."
								bind:value={notes}
							></textarea>
						</div>
						<div class="form-control">
							<label class="label" for="publicNotes">
								<span class="label-text">Public Notes</span>
							</label>
							<textarea
								id="publicNotes"
								class="textarea textarea-bordered w-full"
								rows="3"
								placeholder="Notes visible on the invoice..."
								bind:value={publicNotes}
							></textarea>
						</div>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-4">
				<a href="/{agencySlug}/invoices" class="btn btn-ghost">Cancel</a>
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{#if saving}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					Create Invoice
				</button>
			</div>
		</form>
	{/if}
</div>

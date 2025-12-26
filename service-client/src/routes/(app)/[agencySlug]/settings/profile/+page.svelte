<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateAgencyProfile } from '$lib/api/agency-profile.remote';

	const toast = getToast();
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import FormField from '$lib/components/settings/FormField.svelte';
	import { Building2, MapPin, Landmark, Receipt, FileText } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Safe access to profile data
	const profile = data.profile;

	// Form state - initialized from server data
	let formData = $state({
		// Business Registration
		abn: profile?.abn ?? '',
		acn: profile?.acn ?? '',
		legalEntityName: profile?.legalEntityName ?? '',
		tradingName: profile?.tradingName ?? '',

		// Address
		addressLine1: profile?.addressLine1 ?? '',
		addressLine2: profile?.addressLine2 ?? '',
		city: profile?.city ?? '',
		state: profile?.state ?? '',
		postcode: profile?.postcode ?? '',
		country: profile?.country ?? 'Australia',

		// Banking
		bankName: profile?.bankName ?? '',
		bsb: profile?.bsb ?? '',
		accountNumber: profile?.accountNumber ?? '',
		accountName: profile?.accountName ?? '',

		// Tax & GST
		gstRegistered: profile?.gstRegistered ?? true,
		taxFileNumber: profile?.taxFileNumber ?? '',
		gstRate: profile?.gstRate ?? '10.00',

		// Document Defaults
		defaultPaymentTerms: (profile?.defaultPaymentTerms as 'DUE_ON_RECEIPT' | 'NET_7' | 'NET_14' | 'NET_30') ?? 'NET_14',
		invoicePrefix: profile?.invoicePrefix ?? 'INV',
		invoiceFooter: profile?.invoiceFooter ?? '',
		contractPrefix: profile?.contractPrefix ?? 'CON',
		contractFooter: profile?.contractFooter ?? '',
		proposalPrefix: profile?.proposalPrefix ?? 'PROP'
	});

	let isSaving = $state(false);
	let error = $state('');

	// Payment terms options
	const paymentTermsOptions = [
		{ value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
		{ value: 'NET_7', label: 'Net 7 (Due in 7 days)' },
		{ value: 'NET_14', label: 'Net 14 (Due in 14 days)' },
		{ value: 'NET_30', label: 'Net 30 (Due in 30 days)' }
	];

	// Australian states
	const australianStates = [
		{ value: '', label: 'Select state' },
		{ value: 'ACT', label: 'Australian Capital Territory' },
		{ value: 'NSW', label: 'New South Wales' },
		{ value: 'NT', label: 'Northern Territory' },
		{ value: 'QLD', label: 'Queensland' },
		{ value: 'SA', label: 'South Australia' },
		{ value: 'TAS', label: 'Tasmania' },
		{ value: 'VIC', label: 'Victoria' },
		{ value: 'WA', label: 'Western Australia' }
	];

	async function handleSave() {
		isSaving = true;
		error = '';

		try {
			await updateAgencyProfile(formData);
			await invalidateAll();
			toast.success('Profile updated');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save profile';
			toast.error('Save failed', error);
		} finally {
			isSaving = false;
		}
	}

	// Format BSB as user types (XXX-XXX)
	function formatBsb(event: Event) {
		const input = event.target as HTMLInputElement;
		let value = input.value.replace(/\D/g, '').slice(0, 6);
		if (value.length > 3) {
			value = value.slice(0, 3) + '-' + value.slice(3);
		}
		formData.bsb = value;
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold">Agency Profile</h1>
		<p class="text-base-content/70 mt-1">
			Business registration, address, and banking details for documents
		</p>
	</div>

	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	<!-- Business Registration -->
	<SettingsSection
		title="Business Registration"
		description="Australian Business Number and company details"
		icon={Building2}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="ABN" hint="Australian Business Number (11 digits)">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="12 345 678 901"
					maxlength="14"
					bind:value={formData.abn}
				/>
			</FormField>

			<FormField label="ACN" hint="Australian Company Number (optional)">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="123 456 789"
					maxlength="11"
					bind:value={formData.acn}
				/>
			</FormField>

			<FormField label="Legal Entity Name" hint="Registered business name">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="My Business Pty Ltd"
					bind:value={formData.legalEntityName}
				/>
			</FormField>

			<FormField label="Trading Name" hint="Name you operate under (if different)">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="My Business"
					bind:value={formData.tradingName}
				/>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Address -->
	<SettingsSection
		title="Business Address"
		description="Address shown on invoices and contracts"
		icon={MapPin}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<FormField label="Address Line 1">
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder="123 Business Street"
						bind:value={formData.addressLine1}
					/>
				</FormField>
			</div>

			<div class="sm:col-span-2">
				<FormField label="Address Line 2" hint="Suite, unit, building (optional)">
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder="Suite 100"
						bind:value={formData.addressLine2}
					/>
				</FormField>
			</div>

			<FormField label="City">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="Sydney"
					bind:value={formData.city}
				/>
			</FormField>

			<FormField label="State">
				<select class="select select-bordered w-full" bind:value={formData.state}>
					{#each australianStates as state}
						<option value={state.value}>{state.label}</option>
					{/each}
				</select>
			</FormField>

			<FormField label="Postcode">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="2000"
					maxlength="4"
					bind:value={formData.postcode}
				/>
			</FormField>

			<FormField label="Country">
				<input
					type="text"
					class="input input-bordered w-full"
					bind:value={formData.country}
				/>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Banking Details -->
	<SettingsSection
		title="Banking Details"
		description="Bank account for invoices (displayed for EFT payments)"
		icon={Landmark}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="Bank Name">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="Commonwealth Bank"
					bind:value={formData.bankName}
				/>
			</FormField>

			<FormField label="Account Name">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="My Business Pty Ltd"
					bind:value={formData.accountName}
				/>
			</FormField>

			<FormField label="BSB" hint="6-digit bank/branch code">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="123-456"
					value={formData.bsb}
					oninput={formatBsb}
				/>
			</FormField>

			<FormField label="Account Number">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="12345678"
					bind:value={formData.accountNumber}
				/>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Tax & GST -->
	<SettingsSection
		title="Tax & GST"
		description="GST registration and tax settings"
		icon={Receipt}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label class="label cursor-pointer justify-start gap-3">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={formData.gstRegistered}
					/>
					<span class="label-text">Registered for GST</span>
				</label>
			</div>

			{#if formData.gstRegistered}
				<FormField label="GST Rate (%)" hint="Standard Australian GST is 10%">
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder="10.00"
						bind:value={formData.gstRate}
					/>
				</FormField>
			{/if}

			<FormField label="Tax File Number" hint="Optional - for your records only">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="123 456 789"
					maxlength="11"
					bind:value={formData.taxFileNumber}
				/>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Document Defaults -->
	<SettingsSection
		title="Document Defaults"
		description="Prefixes and settings for proposals, contracts, and invoices"
		icon={FileText}
	>
		<div class="grid gap-4 sm:grid-cols-3">
			<FormField label="Proposal Prefix" hint="e.g., PROP-2025-0001">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="PROP"
					maxlength="10"
					bind:value={formData.proposalPrefix}
				/>
			</FormField>

			<FormField label="Contract Prefix" hint="e.g., CON-2025-0001">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="CON"
					maxlength="10"
					bind:value={formData.contractPrefix}
				/>
			</FormField>

			<FormField label="Invoice Prefix" hint="e.g., INV-2025-0001">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="INV"
					maxlength="10"
					bind:value={formData.invoicePrefix}
				/>
			</FormField>

			<div class="sm:col-span-3">
				<FormField label="Default Payment Terms">
					<select
						class="select select-bordered w-full"
						bind:value={formData.defaultPaymentTerms}
					>
						{#each paymentTermsOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</FormField>
			</div>

			<div class="sm:col-span-3">
				<FormField label="Invoice Footer" hint="Text to appear at the bottom of invoices">
					<textarea
						class="textarea textarea-bordered w-full"
						rows="3"
						placeholder="Thank you for your business. Payment is due within the terms stated above."
						bind:value={formData.invoiceFooter}
					></textarea>
				</FormField>
			</div>

			<div class="sm:col-span-3">
				<FormField label="Contract Footer" hint="Text to appear at the bottom of contracts">
					<textarea
						class="textarea textarea-bordered w-full"
						rows="3"
						placeholder="This agreement constitutes the entire understanding between the parties."
						bind:value={formData.contractFooter}
					></textarea>
				</FormField>
			</div>
		</div>
	</SettingsSection>

	<!-- Save Button -->
	<div class="flex justify-end gap-3">
		<button type="button" class="btn btn-primary" onclick={handleSave} disabled={isSaving}>
			{#if isSaving}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			Save Changes
		</button>
	</div>
</div>

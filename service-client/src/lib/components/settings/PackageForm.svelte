<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createAgencyPackage,
		updateAgencyPackage,
		type AgencyPackageData
	} from '$lib/api/agency-packages.remote';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import FormField from '$lib/components/settings/FormField.svelte';
	import { Package, DollarSign, Clock, FileText, Star, X, Plus } from 'lucide-svelte';

	interface Props {
		package?: AgencyPackageData;
		agencySlug: string;
	}

	let { package: existingPackage, agencySlug }: Props = $props();

	let isEditing = $derived(!!existingPackage);

	// Form state
	let formData = $state<{
		name: string;
		slug: string;
		description: string;
		pricingModel: 'subscription' | 'lump_sum' | 'hybrid';
		setupFee: string;
		monthlyPrice: string;
		oneTimePrice: string;
		hostingFee: string;
		minimumTermMonths: number;
		cancellationFeeType: 'none' | 'fixed' | 'remaining_balance' | null;
		cancellationFeeAmount: string;
		includedFeatures: string[];
		maxPages: number | null;
		isFeatured: boolean;
		isActive: boolean;
	}>({
		name: existingPackage?.name ?? '',
		slug: existingPackage?.slug ?? '',
		description: existingPackage?.description ?? '',
		pricingModel: (existingPackage?.pricingModel as 'subscription' | 'lump_sum' | 'hybrid') ?? 'subscription',
		setupFee: existingPackage?.setupFee ?? '0.00',
		monthlyPrice: existingPackage?.monthlyPrice ?? '0.00',
		oneTimePrice: existingPackage?.oneTimePrice ?? '0.00',
		hostingFee: existingPackage?.hostingFee ?? '0.00',
		minimumTermMonths: existingPackage?.minimumTermMonths ?? 12,
		cancellationFeeType: (existingPackage?.cancellationFeeType as 'none' | 'fixed' | 'remaining_balance' | null) ?? 'none',
		cancellationFeeAmount: existingPackage?.cancellationFeeAmount ?? '0.00',
		includedFeatures: (existingPackage?.includedFeatures as string[]) ?? [],
		maxPages: existingPackage?.maxPages ?? null,
		isFeatured: existingPackage?.isFeatured ?? false,
		isActive: existingPackage?.isActive ?? true
	});

	let isSaving = $state(false);
	let error = $state('');
	let newFeature = $state('');

	const toast = getToast();

	// Pricing model options
	const pricingModels = [
		{ value: 'subscription', label: 'Monthly Subscription', description: 'Recurring monthly fee' },
		{ value: 'lump_sum', label: 'One-Time Payment', description: 'Single upfront payment' },
		{
			value: 'hybrid',
			label: 'Hybrid',
			description: 'Setup fee + monthly subscription'
		}
	];

	// Cancellation fee options
	const cancellationFeeTypes = [
		{ value: 'none', label: 'No cancellation fee' },
		{ value: 'fixed', label: 'Fixed amount' },
		{ value: 'remaining_balance', label: 'Remaining contract balance' }
	];

	// Generate slug from name
	function generateSlug() {
		if (!formData.slug || formData.slug === generateSlugFromName(existingPackage?.name ?? '')) {
			formData.slug = generateSlugFromName(formData.name);
		}
	}

	function generateSlugFromName(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 50);
	}

	// Add feature
	function addFeature() {
		if (newFeature.trim()) {
			formData.includedFeatures = [...formData.includedFeatures, newFeature.trim()];
			newFeature = '';
		}
	}

	// Remove feature
	function removeFeature(index: number) {
		formData.includedFeatures = formData.includedFeatures.filter((_, i) => i !== index);
	}

	// Handle form submission
	async function handleSubmit() {
		if (!formData.name.trim()) {
			error = 'Package name is required';
			return;
		}

		isSaving = true;
		error = '';

		try {
			if (isEditing && existingPackage) {
				await updateAgencyPackage({
					packageId: existingPackage.id,
					...formData,
					maxPages: formData.maxPages || undefined,
					cancellationFeeType: formData.cancellationFeeType ?? undefined
				});
				await invalidateAll();
				toast.success('Package updated');
			} else {
				await createAgencyPackage({
					...formData,
					maxPages: formData.maxPages || undefined,
					cancellationFeeType: formData.cancellationFeeType ?? undefined
				});
				toast.success('Package created');
				goto(`/${agencySlug}/settings/packages`);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save package';
			toast.error('Save failed', error);
		} finally {
			isSaving = false;
		}
	}
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	<!-- Basic Info -->
	<SettingsSection title="Package Details" description="Basic information about this package" icon={Package}>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="Package Name" required>
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="Starter Website"
					bind:value={formData.name}
					oninput={generateSlug}
				/>
			</FormField>

			<FormField label="Slug" hint="URL-friendly identifier">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="starter-website"
					bind:value={formData.slug}
				/>
			</FormField>

			<div class="sm:col-span-2">
				<FormField label="Description">
					<textarea
						class="textarea textarea-bordered w-full"
						rows="3"
						placeholder="Perfect for small businesses looking to establish their online presence."
						bind:value={formData.description}
					></textarea>
				</FormField>
			</div>

			<div class="sm:col-span-2 flex flex-wrap gap-4">
				<label class="label cursor-pointer gap-3">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={formData.isFeatured}
					/>
					<span class="label-text flex items-center gap-1">
						<Star class="h-4 w-4 text-warning" />
						Featured package
					</span>
				</label>

				<label class="label cursor-pointer gap-3">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						bind:checked={formData.isActive}
					/>
					<span class="label-text">Active (available for proposals)</span>
				</label>
			</div>
		</div>
	</SettingsSection>

	<!-- Pricing Model -->
	<SettingsSection title="Pricing" description="How this package is priced" icon={DollarSign}>
		<div class="space-y-4">
			<!-- Pricing model selection -->
			<div class="grid gap-3 sm:grid-cols-3">
				{#each pricingModels as model}
					<label
						class="card bg-base-200 cursor-pointer transition-all hover:bg-base-300"
						class:ring-2={formData.pricingModel === model.value}
						class:ring-primary={formData.pricingModel === model.value}
					>
						<div class="card-body p-4">
							<div class="flex items-start gap-3">
								<input
									type="radio"
									name="pricingModel"
									class="radio radio-primary mt-1"
									value={model.value}
									bind:group={formData.pricingModel}
								/>
								<div>
									<div class="font-medium">{model.label}</div>
									<div class="text-sm text-base-content/60">{model.description}</div>
								</div>
							</div>
						</div>
					</label>
				{/each}
			</div>

			<!-- Price fields based on model -->
			<div class="grid gap-4 sm:grid-cols-2 pt-4">
				{#if formData.pricingModel === 'subscription' || formData.pricingModel === 'hybrid'}
					<FormField label="Monthly Price" hint="Recurring monthly fee">
						<div class="input input-bordered flex items-center gap-2">
							<span class="text-base-content/50">$</span>
							<input
								type="text"
								class="grow bg-transparent outline-none"
								placeholder="299.00"
								bind:value={formData.monthlyPrice}
							/>
						</div>
					</FormField>
				{/if}

				{#if formData.pricingModel === 'lump_sum'}
					<FormField label="One-Time Price" hint="Single payment amount">
						<div class="input input-bordered flex items-center gap-2">
							<span class="text-base-content/50">$</span>
							<input
								type="text"
								class="grow bg-transparent outline-none"
								placeholder="2999.00"
								bind:value={formData.oneTimePrice}
							/>
						</div>
					</FormField>
				{/if}

				{#if formData.pricingModel === 'hybrid'}
					<FormField label="Setup Fee" hint="One-time setup cost">
						<div class="input input-bordered flex items-center gap-2">
							<span class="text-base-content/50">$</span>
							<input
								type="text"
								class="grow bg-transparent outline-none"
								placeholder="500.00"
								bind:value={formData.setupFee}
							/>
						</div>
					</FormField>
				{/if}

				<FormField label="Hosting Fee" hint="Monthly hosting/maintenance">
					<div class="input input-bordered flex items-center gap-2">
						<span class="text-base-content/50">$</span>
						<input
							type="text"
							class="grow bg-transparent outline-none"
							placeholder="49.00"
							bind:value={formData.hostingFee}
						/>
					</div>
				</FormField>
			</div>
		</div>
	</SettingsSection>

	<!-- Contract Terms -->
	<SettingsSection title="Contract Terms" description="Minimum term and cancellation policy" icon={Clock}>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="Minimum Term (Months)">
				<input
					type="number"
					class="input input-bordered w-full"
					min="1"
					max="60"
					bind:value={formData.minimumTermMonths}
				/>
			</FormField>

			<FormField label="Max Pages" hint="Leave empty for unlimited">
				<input
					type="number"
					class="input input-bordered w-full"
					min="1"
					placeholder="Unlimited"
					bind:value={formData.maxPages}
				/>
			</FormField>

			<FormField label="Cancellation Fee Type">
				<select class="select select-bordered w-full" bind:value={formData.cancellationFeeType}>
					{#each cancellationFeeTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</FormField>

			{#if formData.cancellationFeeType === 'fixed'}
				<FormField label="Cancellation Fee Amount">
					<div class="input input-bordered flex items-center gap-2">
						<span class="text-base-content/50">$</span>
						<input
							type="text"
							class="grow bg-transparent outline-none"
							placeholder="500.00"
							bind:value={formData.cancellationFeeAmount}
						/>
					</div>
				</FormField>
			{/if}
		</div>
	</SettingsSection>

	<!-- Included Features -->
	<SettingsSection title="Included Features" description="What's included in this package" icon={FileText}>
		<div class="space-y-4">
			<!-- Add feature input -->
			<div class="flex gap-2">
				<input
					type="text"
					class="input input-bordered flex-1"
					placeholder="Enter a feature..."
					bind:value={newFeature}
					onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
				/>
				<button type="button" class="btn btn-primary" onclick={addFeature}>
					<Plus class="h-4 w-4" />
					Add
				</button>
			</div>

			<!-- Feature list -->
			{#if formData.includedFeatures.length > 0}
				<ul class="space-y-2">
					{#each formData.includedFeatures as feature, index}
						<li class="flex items-center gap-2 p-2 bg-base-200 rounded-lg">
							<span class="flex-1">{feature}</span>
							<button
								type="button"
								class="btn btn-ghost btn-sm btn-square"
								onclick={() => removeFeature(index)}
							>
								<X class="h-4 w-4" />
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-base-content/60 text-sm">No features added yet.</p>
			{/if}
		</div>
	</SettingsSection>

	<!-- Form Actions -->
	<div class="flex justify-end gap-3">
		<a href="/{agencySlug}/settings/packages" class="btn btn-ghost">Cancel</a>
		<button type="submit" class="btn btn-primary" disabled={isSaving}>
			{#if isSaving}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			{isEditing ? 'Save Changes' : 'Create Package'}
		</button>
	</div>
</form>

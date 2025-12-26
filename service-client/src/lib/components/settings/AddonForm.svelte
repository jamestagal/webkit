<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		createAgencyAddon,
		updateAgencyAddon,
		type AgencyAddonData
	} from '$lib/api/agency-addons.remote';
	import { getActivePackages } from '$lib/api/agency-packages.remote';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import FormField from '$lib/components/settings/FormField.svelte';
	import { PlusSquare, DollarSign, Package } from 'lucide-svelte';

	interface Props {
		addon?: AgencyAddonData;
		agencySlug: string;
	}

	let { addon: existingAddon, agencySlug }: Props = $props();

	let isEditing = $derived(!!existingAddon);

	// Form state
	let formData = $state<{
		name: string;
		slug: string;
		description: string;
		price: string;
		pricingType: 'one_time' | 'monthly' | 'per_unit';
		unitLabel: string;
		availablePackages: string[];
		isActive: boolean;
	}>({
		name: existingAddon?.name ?? '',
		slug: existingAddon?.slug ?? '',
		description: existingAddon?.description ?? '',
		price: existingAddon?.price ?? '0.00',
		pricingType: (existingAddon?.pricingType as 'one_time' | 'monthly' | 'per_unit') ?? 'one_time',
		unitLabel: existingAddon?.unitLabel ?? '',
		availablePackages: (existingAddon?.availablePackages as string[]) ?? [],
		isActive: existingAddon?.isActive ?? true
	});

	let isSaving = $state(false);
	let error = $state('');
	let packages = $state<{ slug: string; name: string }[]>([]);

	const toast = getToast();

	// Load available packages
	$effect(() => {
		loadPackages();
	});

	async function loadPackages() {
		try {
			const pkgs = await getActivePackages();
			packages = pkgs.map((p) => ({ slug: p.slug, name: p.name }));
		} catch {
			// Ignore error, packages will be empty
		}
	}

	// Pricing type options
	const pricingTypes = [
		{ value: 'one_time', label: 'One-Time', description: 'Single payment' },
		{ value: 'monthly', label: 'Monthly', description: 'Recurring fee' },
		{ value: 'per_unit', label: 'Per Unit', description: 'Based on quantity' }
	];

	// Generate slug from name
	function generateSlug() {
		if (!formData.slug || formData.slug === generateSlugFromName(existingAddon?.name ?? '')) {
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

	// Toggle package selection
	function togglePackage(slug: string) {
		if (formData.availablePackages.includes(slug)) {
			formData.availablePackages = formData.availablePackages.filter((s) => s !== slug);
		} else {
			formData.availablePackages = [...formData.availablePackages, slug];
		}
	}

	// Handle form submission
	async function handleSubmit() {
		if (!formData.name.trim()) {
			error = 'Add-on name is required';
			return;
		}

		if (!formData.price || parseFloat(formData.price) <= 0) {
			error = 'Price must be greater than 0';
			return;
		}

		isSaving = true;
		error = '';

		try {
			if (isEditing && existingAddon) {
				await updateAgencyAddon({
					addonId: existingAddon.id,
					...formData,
					unitLabel: formData.pricingType === 'per_unit' ? formData.unitLabel : undefined
				});
				await invalidateAll();
				toast.success('Add-on updated');
			} else {
				await createAgencyAddon({
					...formData,
					unitLabel: formData.pricingType === 'per_unit' ? formData.unitLabel : undefined
				});
				toast.success('Add-on created');
				goto(`/${agencySlug}/settings/addons`);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save add-on';
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
	<SettingsSection title="Add-on Details" description="Basic information about this add-on" icon={PlusSquare}>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="Add-on Name" required>
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="Extra Page"
					bind:value={formData.name}
					oninput={generateSlug}
				/>
			</FormField>

			<FormField label="Slug" hint="URL-friendly identifier">
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="extra-page"
					bind:value={formData.slug}
				/>
			</FormField>

			<div class="sm:col-span-2">
				<FormField label="Description">
					<textarea
						class="textarea textarea-bordered w-full"
						rows="2"
						placeholder="Add additional pages to your website package."
						bind:value={formData.description}
					></textarea>
				</FormField>
			</div>

			<div class="sm:col-span-2">
				<label class="label cursor-pointer justify-start gap-3">
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

	<!-- Pricing -->
	<SettingsSection title="Pricing" description="How this add-on is priced" icon={DollarSign}>
		<div class="space-y-4">
			<!-- Pricing type selection -->
			<div class="grid gap-3 sm:grid-cols-3">
				{#each pricingTypes as type}
					<label
						class="card bg-base-200 cursor-pointer transition-all hover:bg-base-300"
						class:ring-2={formData.pricingType === type.value}
						class:ring-primary={formData.pricingType === type.value}
					>
						<div class="card-body p-4">
							<div class="flex items-start gap-3">
								<input
									type="radio"
									name="pricingType"
									class="radio radio-primary mt-1"
									value={type.value}
									bind:group={formData.pricingType}
								/>
								<div>
									<div class="font-medium">{type.label}</div>
									<div class="text-sm text-base-content/60">{type.description}</div>
								</div>
							</div>
						</div>
					</label>
				{/each}
			</div>

			<!-- Price input -->
			<div class="grid gap-4 sm:grid-cols-2 pt-4">
				<FormField label="Price" required>
					<div class="input input-bordered flex items-center gap-2">
						<span class="text-base-content/50">$</span>
						<input
							type="text"
							class="grow bg-transparent outline-none"
							placeholder="99.00"
							bind:value={formData.price}
						/>
						{#if formData.pricingType === 'monthly'}
							<span class="text-base-content/50">/month</span>
						{:else if formData.pricingType === 'per_unit'}
							<span class="text-base-content/50">/{formData.unitLabel || 'unit'}</span>
						{/if}
					</div>
				</FormField>

				{#if formData.pricingType === 'per_unit'}
					<FormField label="Unit Label" hint="e.g., page, hour, revision">
						<input
							type="text"
							class="input input-bordered w-full"
							placeholder="page"
							bind:value={formData.unitLabel}
						/>
					</FormField>
				{/if}
			</div>
		</div>
	</SettingsSection>

	<!-- Package Availability -->
	<SettingsSection
		title="Package Availability"
		description="Which packages can include this add-on"
		icon={Package}
	>
		<div class="space-y-4">
			{#if packages.length === 0}
				<p class="text-base-content/60">
					No active packages found. This add-on will be available for all packages.
				</p>
			{:else}
				<p class="text-sm text-base-content/60 mb-3">
					Select packages, or leave empty to make available for all packages.
				</p>
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each packages as pkg}
						<label
							class="flex items-center gap-3 p-3 rounded-lg bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
							class:ring-2={formData.availablePackages.includes(pkg.slug)}
							class:ring-primary={formData.availablePackages.includes(pkg.slug)}
						>
							<input
								type="checkbox"
								class="checkbox checkbox-primary checkbox-sm"
								checked={formData.availablePackages.includes(pkg.slug)}
								onchange={() => togglePackage(pkg.slug)}
							/>
							<span class="font-medium">{pkg.name}</span>
						</label>
					{/each}
				</div>
				{#if formData.availablePackages.length === 0}
					<p class="text-sm text-primary">
						Available for all packages
					</p>
				{:else}
					<p class="text-sm text-base-content/60">
						Available for {formData.availablePackages.length} package{formData.availablePackages.length !== 1 ? 's' : ''}
					</p>
				{/if}
			{/if}
		</div>
	</SettingsSection>

	<!-- Form Actions -->
	<div class="flex justify-end gap-3">
		<a href="/{agencySlug}/settings/addons" class="btn btn-ghost">Cancel</a>
		<button type="submit" class="btn btn-primary" disabled={isSaving}>
			{#if isSaving}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			{isEditing ? 'Save Changes' : 'Create Add-on'}
		</button>
	</div>
</form>

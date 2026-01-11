<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateAgencyProfile } from '$lib/api/agency-profile.remote';

	const toast = getToast();
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import FormField from '$lib/components/settings/FormField.svelte';
	import { Share2, Type, Quote } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Extract initial values (wrapped in function to signal intentional non-reactive capture)
	function getInitialFormData() {
		return {
			tagline: data.profile?.tagline ?? '',
			brandFont: data.profile?.brandFont ?? '',
			socialLinkedin: data.profile?.socialLinkedin ?? '',
			socialFacebook: data.profile?.socialFacebook ?? '',
			socialInstagram: data.profile?.socialInstagram ?? '',
			socialTwitter: data.profile?.socialTwitter ?? ''
		};
	}

	// Form state - initialized once, maintains user edits until save
	let formData = $state(getInitialFormData());

	let isSaving = $state(false);
	let error = $state('');

	// Common font options
	const fontOptions = [
		{ value: '', label: 'Default (System)' },
		{ value: 'Inter', label: 'Inter' },
		{ value: 'Roboto', label: 'Roboto' },
		{ value: 'Open Sans', label: 'Open Sans' },
		{ value: 'Lato', label: 'Lato' },
		{ value: 'Montserrat', label: 'Montserrat' },
		{ value: 'Poppins', label: 'Poppins' },
		{ value: 'Raleway', label: 'Raleway' },
		{ value: 'Playfair Display', label: 'Playfair Display' },
		{ value: 'Source Sans Pro', label: 'Source Sans Pro' }
	];

	async function handleSave() {
		isSaving = true;
		error = '';

		try {
			await updateAgencyProfile(formData);
			await invalidateAll();
			toast.success('Branding updated');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save branding';
			toast.error('Save failed', error);
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold">Branding</h1>
		<p class="text-base-content/70 mt-1">Customize your agency's appearance and social presence</p>
	</div>

	{#if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{/if}

	<!-- Tagline -->
	<SettingsSection
		title="Tagline"
		description="A short phrase that describes your agency"
		icon={Quote}
	>
		<FormField label="Tagline" hint="Appears on proposals and documents">
			<input
				type="text"
				class="input input-bordered w-full"
				placeholder="Building digital experiences that matter"
				bind:value={formData.tagline}
			/>
		</FormField>
	</SettingsSection>

	<!-- Typography -->
	<SettingsSection
		title="Typography"
		description="Font used in generated documents"
		icon={Type}
	>
		<FormField label="Brand Font" hint="Font for proposals, contracts, and invoices">
			<select class="select select-bordered w-full" bind:value={formData.brandFont}>
				{#each fontOptions as font}
					<option value={font.value}>{font.label}</option>
				{/each}
			</select>
		</FormField>
	</SettingsSection>

	<!-- Social Links -->
	<SettingsSection
		title="Social Links"
		description="Connect your social media profiles"
		icon={Share2}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormField label="LinkedIn">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">linkedin.com/company/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-company"
						bind:value={formData.socialLinkedin}
					/>
				</label>
			</FormField>

			<FormField label="Facebook">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">facebook.com/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-page"
						bind:value={formData.socialFacebook}
					/>
				</label>
			</FormField>

			<FormField label="Instagram">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">instagram.com/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-handle"
						bind:value={formData.socialInstagram}
					/>
				</label>
			</FormField>

			<FormField label="X (Twitter)">
				<label class="input input-bordered flex items-center gap-1">
					<span class="text-base-content/50 text-sm whitespace-nowrap">x.com/</span>
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent outline-none"
						placeholder="your-handle"
						bind:value={formData.socialTwitter}
					/>
				</label>
			</FormField>
		</div>
	</SettingsSection>

	<!-- Current Branding Info -->
	<SettingsSection title="Current Branding" description="Your agency's current brand settings">
		<div class="grid gap-4 sm:grid-cols-3">
			{#if data.agency?.logoUrl}
				<div class="flex flex-col items-center gap-2">
					<span class="text-sm text-base-content/60">Logo</span>
					<img
						src={data.agency.logoUrl}
						alt="Agency logo"
						class="h-16 w-auto object-contain"
					/>
				</div>
			{/if}

			{#if data.agency?.primaryColor}
				<div class="flex flex-col items-center gap-2">
					<span class="text-sm text-base-content/60">Primary Color</span>
					<div class="flex items-center gap-2">
						<div
							class="h-8 w-8 rounded-lg border border-base-300"
							style="background-color: {data.agency.primaryColor}"
						></div>
						<span class="font-mono text-sm">{data.agency.primaryColor}</span>
					</div>
				</div>
			{/if}

			{#if data.agency?.secondaryColor}
				<div class="flex flex-col items-center gap-2">
					<span class="text-sm text-base-content/60">Secondary Color</span>
					<div class="flex items-center gap-2">
						<div
							class="h-8 w-8 rounded-lg border border-base-300"
							style="background-color: {data.agency.secondaryColor}"
						></div>
						<span class="font-mono text-sm">{data.agency.secondaryColor}</span>
					</div>
				</div>
			{/if}
		</div>
		<p class="mt-4 text-sm text-base-content/60">
			Logo and colors are managed in the main agency settings.
		</p>
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

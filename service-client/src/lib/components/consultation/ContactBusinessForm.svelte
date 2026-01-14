<script lang="ts">
	import type { ContactBusiness } from '$lib/types/consultation';
	import { INDUSTRY_OPTIONS, BUSINESS_TYPE_OPTIONS } from '$lib/config/consultation-options';
	import { formatAustralianPhone } from '$lib/utils/phone';

	interface Props {
		data: ContactBusiness;
		errors?: Record<string, string>;
		disabled?: boolean;
	}

	let { data = $bindable(), errors = {}, disabled = false }: Props = $props();

	// Phone formatting
	function handlePhoneInput(e: Event) {
		const input = e.target as HTMLInputElement;
		data.phone = formatAustralianPhone(input.value);
	}

	// URL auto-prefix
	function handleUrlBlur(field: 'website' | 'linkedin' | 'facebook' | 'instagram') {
		let value = field === 'website' ? data.website : data.social_media[field];
		if (value && !value.startsWith('http')) {
			value = 'https://' + value;
			if (field === 'website') {
				data.website = value;
			} else {
				data.social_media[field] = value;
			}
		}
	}
</script>

<div class="space-y-6">
	<!-- Contact Details -->
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="form-control">
			<label class="label" for="business_name">
				<span class="label-text">Business Name</span>
			</label>
			<input
				type="text"
				id="business_name"
				bind:value={data.business_name}
				class="input input-bordered"
				autocomplete="organization"
				{disabled}
			/>
		</div>

		<div class="form-control">
			<label class="label" for="contact_person">
				<span class="label-text">Contact Person</span>
			</label>
			<input
				type="text"
				id="contact_person"
				bind:value={data.contact_person}
				class="input input-bordered"
				autocomplete="name"
				{disabled}
			/>
		</div>

		<div class="form-control">
			<label class="label" for="email">
				<span class="label-text">Email Address *</span>
			</label>
			<input
				type="email"
				id="email"
				bind:value={data.email}
				class="input input-bordered"
				class:input-error={errors.email}
				autocomplete="email"
				required
				{disabled}
			/>
			{#if errors.email}
				<label class="label"><span class="label-text-alt text-error">{errors.email}</span></label>
			{/if}
		</div>

		<div class="form-control">
			<label class="label" for="phone">
				<span class="label-text">Phone Number</span>
			</label>
			<input
				type="tel"
				id="phone"
				value={data.phone ?? ''}
				oninput={handlePhoneInput}
				class="input input-bordered"
				placeholder="0412 345 678"
				autocomplete="tel"
				{disabled}
			/>
		</div>

		<div class="form-control sm:col-span-2">
			<label class="label" for="website">
				<span class="label-text">Website URL</span>
			</label>
			<input
				type="url"
				id="website"
				bind:value={data.website}
				onblur={() => handleUrlBlur('website')}
				class="input input-bordered"
				placeholder="https://example.com"
				autocomplete="url"
				{disabled}
			/>
		</div>
	</div>

	<!-- Social Media -->
	<div class="collapse collapse-arrow bg-base-200">
		<input type="checkbox" />
		<div class="collapse-title font-medium">Social Media Profiles (optional)</div>
		<div class="collapse-content space-y-3">
			<div class="flex items-center gap-3">
				<span class="w-24 text-sm text-gray-500">LinkedIn</span>
				<input
					type="url"
					bind:value={data.social_media.linkedin}
					onblur={() => handleUrlBlur('linkedin')}
					class="input input-bordered input-sm flex-1"
					placeholder="https://linkedin.com/company/..."
					{disabled}
				/>
			</div>
			<div class="flex items-center gap-3">
				<span class="w-24 text-sm text-gray-500">Facebook</span>
				<input
					type="url"
					bind:value={data.social_media.facebook}
					onblur={() => handleUrlBlur('facebook')}
					class="input input-bordered input-sm flex-1"
					placeholder="https://facebook.com/..."
					{disabled}
				/>
			</div>
			<div class="flex items-center gap-3">
				<span class="w-24 text-sm text-gray-500">Instagram</span>
				<input
					type="url"
					bind:value={data.social_media.instagram}
					onblur={() => handleUrlBlur('instagram')}
					class="input input-bordered input-sm flex-1"
					placeholder="https://instagram.com/..."
					{disabled}
				/>
			</div>
		</div>
	</div>

	<!-- Business Context -->
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="form-control">
			<label class="label" for="industry">
				<span class="label-text">Industry *</span>
			</label>
			<select
				id="industry"
				bind:value={data.industry}
				class="select select-bordered"
				class:select-error={errors.industry}
				required
				{disabled}
			>
				<option value="">Select industry...</option>
				{#each INDUSTRY_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			{#if errors.industry}
				<label class="label"
					><span class="label-text-alt text-error">{errors.industry}</span></label
				>
			{/if}
		</div>

		<div class="form-control">
			<label class="label" for="business_type">
				<span class="label-text">Business Type *</span>
			</label>
			<select
				id="business_type"
				bind:value={data.business_type}
				class="select select-bordered"
				class:select-error={errors.business_type}
				required
				{disabled}
			>
				<option value="">Select type...</option>
				{#each BUSINESS_TYPE_OPTIONS as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			{#if errors.business_type}
				<label class="label"
					><span class="label-text-alt text-error">{errors.business_type}</span></label
				>
			{/if}
		</div>
	</div>
</div>

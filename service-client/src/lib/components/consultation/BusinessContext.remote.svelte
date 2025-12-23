<script lang="ts">
	/**
	 * Business Context Form - Remote Functions Implementation
	 *
	 * Pattern: Form Enhancement with SvelteKit Remote Functions
	 * Cognitive Load: 14
	 * - Remote function import: 1
	 * - Field bindings (6 main fields): 6
	 * - Array field management (digital_presence, marketing_channels): 4
	 * - Validation display: 2
	 * - Loading states: 1
	 *
	 * Uses saveBusinessContext remote function with automatic validation
	 */

	import { saveBusinessContext } from '$lib/api/consultation.remote';
	import type { Consultation } from '$lib/types/consultation';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import { X, AlertCircle, CheckCircle, AlertTriangle, Plus } from 'lucide-svelte';

	// Props
	let {
		consultation,
		onNext = () => {}
	}: {
		consultation: Consultation;
		onNext?: () => void;
	} = $props();

	// Local state for array fields (not directly supported by remote function fields)
	let digitalPresence = $state<string[]>(consultation.parsed_business_context?.digital_presence ?? []);
	let marketingChannels = $state<string[]>(consultation.parsed_business_context?.marketing_channels ?? []);
	let newDigitalPresence = $state('');
	let newMarketingChannel = $state('');

	// Derived state
	let canAddDigitalPresence = $derived(newDigitalPresence.trim().length > 0);
	let canAddMarketingChannel = $derived(newMarketingChannel.trim().length > 0);

	// Predefined options
	const industryOptions = [
		{ value: '', label: 'Select an industry' },
		{ value: 'technology', label: 'Technology' },
		{ value: 'healthcare', label: 'Healthcare' },
		{ value: 'finance', label: 'Finance & Banking' },
		{ value: 'retail', label: 'Retail & E-commerce' },
		{ value: 'education', label: 'Education' },
		{ value: 'manufacturing', label: 'Manufacturing' },
		{ value: 'real-estate', label: 'Real Estate' },
		{ value: 'hospitality', label: 'Hospitality & Tourism' },
		{ value: 'automotive', label: 'Automotive' },
		{ value: 'agriculture', label: 'Agriculture' },
		{ value: 'non-profit', label: 'Non-Profit' },
		{ value: 'government', label: 'Government' },
		{ value: 'consulting', label: 'Consulting' },
		{ value: 'media', label: 'Media & Entertainment' },
		{ value: 'other', label: 'Other' }
	];

	const businessTypeOptions = [
		{ value: '', label: 'Select business type' },
		{ value: 'startup', label: 'Startup' },
		{ value: 'small-business', label: 'Small Business' },
		{ value: 'mid-market', label: 'Mid-Market Company' },
		{ value: 'enterprise', label: 'Enterprise' },
		{ value: 'non-profit', label: 'Non-Profit Organization' },
		{ value: 'government', label: 'Government Agency' },
		{ value: 'freelancer', label: 'Freelancer/Solopreneur' }
	];

	const commonDigitalPresences = [
		'Website',
		'LinkedIn',
		'Facebook',
		'Instagram',
		'Twitter',
		'YouTube',
		'TikTok',
		'Google My Business',
		'Yelp',
		'Amazon',
		'Shopify'
	];

	const commonMarketingChannels = [
		'SEO/Organic Search',
		'Google Ads',
		'Facebook Ads',
		'Instagram Ads',
		'LinkedIn Ads',
		'Email Marketing',
		'Content Marketing',
		'Social Media',
		'Word of Mouth',
		'Referrals',
		'Trade Shows',
		'Print Advertising',
		'Radio',
		'TV',
		'Direct Mail',
		'Cold Calling',
		'Influencer Marketing'
	];

	// Digital presence management
	function addDigitalPresence(): void {
		if (newDigitalPresence.trim() && !digitalPresence.includes(newDigitalPresence.trim())) {
			digitalPresence = [...digitalPresence, newDigitalPresence.trim()];
			newDigitalPresence = '';
		}
	}

	function removeDigitalPresence(item: string): void {
		digitalPresence = digitalPresence.filter((p) => p !== item);
	}

	function addCommonDigitalPresence(item: string): void {
		if (!digitalPresence.includes(item)) {
			digitalPresence = [...digitalPresence, item];
		}
	}

	// Marketing channels management
	function addMarketingChannel(): void {
		if (newMarketingChannel.trim() && !marketingChannels.includes(newMarketingChannel.trim())) {
			marketingChannels = [...marketingChannels, newMarketingChannel.trim()];
			newMarketingChannel = '';
		}
	}

	function removeMarketingChannel(item: string): void {
		marketingChannels = marketingChannels.filter((c) => c !== item);
	}

	function addCommonMarketingChannel(item: string): void {
		if (!marketingChannels.includes(item)) {
			marketingChannels = [...marketingChannels, item];
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-base-content text-2xl font-bold">Business Context</h2>
		<p class="text-base-content/70 mt-1 text-sm">
			Help us understand your business and current digital presence.
		</p>
	</div>

	<!-- Form with Remote Function Enhancement -->
	<form
		method="POST"
		use:saveBusinessContext.enhance
		onsubmit={() => {
			setTimeout(() => {
				if (!saveBusinessContext.pending) {
					onNext();
				}
			}, 100);
		}}
	>
		<!-- Form Fields -->
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
			<!-- Industry -->
			<div class="sm:col-span-2">
				<label class="mb-2 block text-sm font-medium">Industry *</label>
				<select
					{...saveBusinessContext.fields.industry.as('select')}
					value={consultation.parsed_business_context?.industry ?? ''}
					required
					class="select w-full"
					disabled={saveBusinessContext.pending}
				>
					{#each industryOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				{#each saveBusinessContext.fields.industry.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Business Type -->
			<div>
				<label class="mb-2 block text-sm font-medium">Business Type *</label>
				<select
					{...saveBusinessContext.fields.business_type.as('select')}
					value={consultation.parsed_business_context?.business_type ?? ''}
					required
					class="select w-full"
					disabled={saveBusinessContext.pending}
				>
					{#each businessTypeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				{#each saveBusinessContext.fields.business_type.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Team Size -->
			<div>
				<label class="floating-label">
					<span>Team Size *</span>
					<input
						{...saveBusinessContext.fields.team_size.as('number')}
						value={consultation.parsed_business_context?.team_size ?? ''}
						placeholder="Number of employees/team members"
						min="1"
						max="10000"
						required
						class="input w-full"
						disabled={saveBusinessContext.pending}
					/>
				</label>
				{#each saveBusinessContext.fields.team_size.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Current Platform -->
			<div class="sm:col-span-2">
				<label class="floating-label">
					<span>Current Platform/Website</span>
					<input
						{...saveBusinessContext.fields.current_platform.as('text')}
						value={consultation.parsed_business_context?.current_platform ?? ''}
						placeholder="e.g., WordPress, Shopify, Custom solution, None"
						class="input w-full"
						disabled={saveBusinessContext.pending}
					/>
				</label>
				{#each saveBusinessContext.fields.current_platform.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>
		</div>

		<!-- Digital Presence -->
		<div class="mt-6">
			<label class="text-base-content mb-2 block text-sm font-medium">
				Digital Presence
				<span class="text-base-content/60 font-normal">(Optional)</span>
			</label>
			<p class="text-base-content/70 mb-3 text-sm">
				Where does your business currently have an online presence?
			</p>

			<!-- Quick Add Buttons -->
			<div class="mb-3 flex flex-wrap gap-2">
				{#each commonDigitalPresences as presence}
					{#if !digitalPresence.includes(presence)}
						<button
							type="button"
							onclick={() => addCommonDigitalPresence(presence)}
							disabled={saveBusinessContext.pending}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							+ {presence}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Custom Input -->
			<div class="mb-3 flex space-x-2">
				<Input
					bind:value={newDigitalPresence}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addDigitalPresence();
						}
					}}
					placeholder="Add custom digital presence"
					disabled={saveBusinessContext.pending}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addDigitalPresence}
					disabled={saveBusinessContext.pending || !canAddDigitalPresence}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</div>

			<!-- Selected Items -->
			{#if digitalPresence.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each digitalPresence as presence}
						<span
							class="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
						>
							{presence}
							<button
								type="button"
								onclick={() => removeDigitalPresence(presence)}
								disabled={saveBusinessContext.pending}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-400 hover:text-blue-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Hidden input for array data -->
			{#if digitalPresence.length > 0}
				<input
					type="hidden"
					name="digital_presence"
					value={JSON.stringify(digitalPresence)}
				/>
			{/if}
		</div>

		<!-- Marketing Channels -->
		<div class="mt-6">
			<label class="text-base-content mb-2 block text-sm font-medium">
				Current Marketing Channels
				<span class="text-base-content/60 font-normal">(Optional)</span>
			</label>
			<p class="text-base-content/70 mb-3 text-sm">
				How do you currently reach and acquire customers?
			</p>

			<!-- Quick Add Buttons -->
			<div class="mb-3 flex flex-wrap gap-2">
				{#each commonMarketingChannels as channel}
					{#if !marketingChannels.includes(channel)}
						<button
							type="button"
							onclick={() => addCommonMarketingChannel(channel)}
							disabled={saveBusinessContext.pending}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							+ {channel}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Custom Input -->
			<div class="mb-3 flex space-x-2">
				<Input
					bind:value={newMarketingChannel}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addMarketingChannel();
						}
					}}
					placeholder="Add custom marketing channel"
					disabled={saveBusinessContext.pending}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addMarketingChannel}
					disabled={saveBusinessContext.pending || !canAddMarketingChannel}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</div>

			<!-- Selected Items -->
			{#if marketingChannels.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each marketingChannels as channel}
						<span
							class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
						>
							{channel}
							<button
								type="button"
								onclick={() => removeMarketingChannel(channel)}
								disabled={saveBusinessContext.pending}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-green-400 hover:text-green-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Hidden input for array data -->
			{#if marketingChannels.length > 0}
				<input
					type="hidden"
					name="marketing_channels"
					value={JSON.stringify(marketingChannels)}
				/>
			{/if}
		</div>

		<!-- Form Status Indicator -->
		<div class="mt-6 flex items-center space-x-2 text-sm">
			{#if saveBusinessContext.pending}
				<div class="text-info flex items-center space-x-1">
					<svg
						class="h-5 w-5 animate-spin"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span class="text-sm">Saving...</span>
				</div>
			{:else if saveBusinessContext.fields.industry.value && saveBusinessContext.fields.business_type.value}
				<CheckCircle class="text-success h-5 w-5" />
				<span class="text-success">Business context is complete</span>
			{:else}
				<AlertTriangle class="text-warning h-5 w-5" />
				<span class="text-warning">Please complete required fields (Industry & Business Type)</span>
			{/if}
		</div>

		<!-- Submit Button (Hidden) -->
		<button type="submit" class="hidden">Save & Continue</button>
	</form>
</div>

<script lang="ts">
	import type { BusinessContext } from "$lib/types/consultation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import Input from "$lib/components/Input.svelte";
	import Select from "$lib/components/Select.svelte";
	import Button from "$lib/components/Button.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import { X, AlertCircle, CheckCircle, AlertTriangle, Plus } from "lucide-svelte";

	// Props
	let {
		data = $bindable({}),
		errors = [],
		disabled = false,
	}: {
		data: BusinessContext;
		errors?: string[];
		disabled?: boolean;
	} = $props();

	// Local form state with runes
	let industry = $state(data.industry || "");
	let businessType = $state(data.business_type || "");
	let teamSize = $state(data.team_size || 1);
	let currentPlatform = $state(data.current_platform || "");
	let digitalPresence = $state<string[]>(data.digital_presence || []);
	let marketingChannels = $state<string[]>(data.marketing_channels || []);

	// Temporary input values for adding new items
	let newDigitalPresence = $state("");
	let newMarketingChannel = $state("");

	// Predefined options
	const industryOptions = [
		{ value: "", label: "Select an industry" },
		{ value: "technology", label: "Technology" },
		{ value: "healthcare", label: "Healthcare" },
		{ value: "finance", label: "Finance & Banking" },
		{ value: "retail", label: "Retail & E-commerce" },
		{ value: "education", label: "Education" },
		{ value: "manufacturing", label: "Manufacturing" },
		{ value: "real-estate", label: "Real Estate" },
		{ value: "hospitality", label: "Hospitality & Tourism" },
		{ value: "automotive", label: "Automotive" },
		{ value: "agriculture", label: "Agriculture" },
		{ value: "non-profit", label: "Non-Profit" },
		{ value: "government", label: "Government" },
		{ value: "consulting", label: "Consulting" },
		{ value: "media", label: "Media & Entertainment" },
		{ value: "other", label: "Other" },
	];

	const businessTypeOptions = [
		{ value: "", label: "Select business type" },
		{ value: "startup", label: "Startup" },
		{ value: "small-business", label: "Small Business" },
		{ value: "mid-market", label: "Mid-Market Company" },
		{ value: "enterprise", label: "Enterprise" },
		{ value: "non-profit", label: "Non-Profit Organization" },
		{ value: "government", label: "Government Agency" },
		{ value: "freelancer", label: "Freelancer/Solopreneur" },
	];

	const commonDigitalPresences = [
		"Website",
		"LinkedIn",
		"Facebook",
		"Instagram",
		"Twitter",
		"YouTube",
		"TikTok",
		"Google My Business",
		"Yelp",
		"Amazon",
		"Shopify",
	];

	const commonMarketingChannels = [
		"SEO/Organic Search",
		"Google Ads",
		"Facebook Ads",
		"Instagram Ads",
		"LinkedIn Ads",
		"Email Marketing",
		"Content Marketing",
		"Social Media",
		"Word of Mouth",
		"Referrals",
		"Trade Shows",
		"Print Advertising",
		"Radio",
		"TV",
		"Direct Mail",
		"Cold Calling",
		"Influencer Marketing",
	];

	// Validation state
	let teamSizeError = $state("");

	// Derived validation
	let isTeamSizeValid = $derived(() => {
		return teamSize >= 1 && teamSize <= 10000;
	});

	let isFormValid = $derived(() => {
		return industry.length > 0 && businessType.length > 0 && isTeamSizeValid;
	});

	// Update parent data manually when fields change
	function updateParentData() {
		data.industry = industry || undefined;
		data.business_type = businessType || undefined;
		data.team_size = teamSize || undefined;
		data.current_platform = currentPlatform || undefined;
		data.digital_presence = digitalPresence.length > 0 ? digitalPresence : undefined;
		data.marketing_channels = marketingChannels.length > 0 ? marketingChannels : undefined;
	}

	// Call update on field changes
	function handleFieldUpdate() {
		updateParentData();
	}

	// Update validation errors
	$effect(() => {
		teamSizeError = !isTeamSizeValid ? "Team size must be between 1 and 10,000" : "";
	});

	// Digital presence management
	function addDigitalPresence(): void {
		if (newDigitalPresence.trim() && !digitalPresence.includes(newDigitalPresence.trim())) {
			digitalPresence = [...digitalPresence, newDigitalPresence.trim()];
			newDigitalPresence = "";
			handleFieldUpdate();
		}
	}

	function removeDigitalPresence(item: string): void {
		digitalPresence = digitalPresence.filter((p) => p !== item);
		handleFieldUpdate();
	}

	function addCommonDigitalPresence(item: string): void {
		if (!digitalPresence.includes(item)) {
			digitalPresence = [...digitalPresence, item];
			handleFieldUpdate();
		}
	}

	// Marketing channels management
	function addMarketingChannel(): void {
		if (newMarketingChannel.trim() && !marketingChannels.includes(newMarketingChannel.trim())) {
			marketingChannels = [...marketingChannels, newMarketingChannel.trim()];
			newMarketingChannel = "";
			handleFieldUpdate();
		}
	}

	function removeMarketingChannel(item: string): void {
		marketingChannels = marketingChannels.filter((c) => c !== item);
		handleFieldUpdate();
	}

	function addCommonMarketingChannel(item: string): void {
		if (!marketingChannels.includes(item)) {
			marketingChannels = [...marketingChannels, item];
			handleFieldUpdate();
		}
	}

	// Handle keyboard events for adding items
	function handleDigitalPresenceKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addDigitalPresence();
		}
	}

	function handleMarketingChannelKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addMarketingChannel();
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

	<!-- Error Summary -->
	{#if errors.length > 0}
		<div class="rounded-md bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<AlertCircle class="h-5 w-5 text-red-400" />
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Please correct the following errors:</h3>
					<div class="mt-2 text-sm text-red-700">
						<ul class="list-inside list-disc">
							{#each errors as error}
								<li>{error}</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Form Fields -->
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		<!-- Industry -->
		<div class="sm:col-span-2">
			<Select
				bind:value={industry}
				onchange={handleFieldUpdate}
				label="Industry"
				options={industryOptions}
				{disabled}
				required={true}
			/>
		</div>

		<!-- Business Type -->
		<div>
			<Select
				bind:value={businessType}
				onchange={handleFieldUpdate}
				label="Business Type"
				options={businessTypeOptions}
				{disabled}
				required={true}
			/>
		</div>

		<!-- Team Size -->
		<div>
			<label class="floating-label">
				<span>Team Size *</span>
				<input
					bind:value={teamSize}
					onblur={handleFieldUpdate}
					type="number"
					placeholder="Number of employees/team members"
					min="1"
					max="10000"
					{disabled}
					required={true}
					class="input w-full"
					class:input-error={teamSizeError}
				/>
				{#if teamSizeError}<div class="text-error mt-1 text-sm">{teamSizeError}</div>{/if}
			</label>
		</div>

		<!-- Current Platform -->
		<div class="sm:col-span-2">
			<label class="floating-label">
				<span>Current Platform/Website</span>
				<input
					bind:value={currentPlatform}
					onblur={handleFieldUpdate}
					placeholder="e.g., WordPress, Shopify, Custom solution, None"
					{disabled}
					class="input w-full"
				/>
			</label>
		</div>
	</div>

	<!-- Digital Presence -->
	<div>
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
						{disabled}
						class="btn btn-outline btn-sm"
					>
						+ {presence}
					</button>
				{/if}
			{/each}
		</div>

		<!-- Custom Input -->
		<div class="mb-3 flex space-x-2">
			<input
				bind:value={newDigitalPresence}
				onkeydown={handleDigitalPresenceKeydown}
				placeholder="Add custom digital presence"
				{disabled}
				class="input flex-1"
			/>
			<button
				type="button"
				class="btn btn-primary"
				onclick={addDigitalPresence}
				disabled={disabled || !newDigitalPresence.trim()}
			>
				<Plus class="mr-1 h-4 w-4" />
				Add
			</button>
		</div>

		<!-- Selected Items -->
		{#if digitalPresence.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each digitalPresence as presence}
					<span class="badge badge-primary gap-2">
						{presence}
						<button
							type="button"
							onclick={() => removeDigitalPresence(presence)}
							{disabled}
							class="hover:text-primary-content disabled:opacity-50"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Marketing Channels -->
	<div>
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
						{disabled}
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
				onkeydown={handleMarketingChannelKeydown}
				placeholder="Add custom marketing channel"
				{disabled}
				class="flex-1"
			/>
			<Button
				variant="primary"
				onclick={addMarketingChannel}
				disabled={disabled || !newMarketingChannel.trim()}
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
							{disabled}
							class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-green-400 hover:text-green-600 disabled:opacity-50"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Form Status Indicator -->
	<div class="flex items-center space-x-2 text-sm">
		{#if isFormValid}
			<CheckCircle class="text-success h-5 w-5" />
			<span class="text-success">Business context is complete</span>
		{:else}
			<AlertTriangle class="text-warning h-5 w-5" />
			<span class="text-warning">Please complete required fields (Industry & Business Type)</span>
		{/if}

		{#if consultationStore.formState.isAutoSaving}
			<div class="text-info flex items-center space-x-1">
				<Spinner size={16} />
				<span class="text-sm">Saving...</span>
			</div>
		{:else if consultationStore.formState.lastSaved}
			<span class="opacity-60">
				Saved {consultationStore.formState.lastSaved.toLocaleTimeString()}
			</span>
		{/if}
	</div>
</div>

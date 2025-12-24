<script lang="ts">
	import type { BusinessContext } from "$lib/types/consultation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import { getAgencyConfig } from "$lib/stores/agency-config.svelte";
	import Select from "$lib/components/Select.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import { X, AlertCircle, CheckCircle, AlertTriangle, Plus } from "lucide-svelte";
	import Button from "$lib/components/Button.svelte";

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

	// Get agency config for configurable options
	const agencyConfig = getAgencyConfig();

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

	// Use agency config with defaults fallback
	let industryOptions = $derived([
		{ value: "", label: "Select an industry" },
		...agencyConfig.industry.map((opt) => ({ value: opt.value, label: opt.label })),
	]);

	let businessTypeOptions = $derived([
		{ value: "", label: "Select business type" },
		...agencyConfig.business_type.map((opt) => ({ value: opt.value, label: opt.label })),
	]);

	let commonDigitalPresences = $derived(
		agencyConfig.digital_presence.map((opt) => opt.label)
	);

	let commonMarketingChannels = $derived(
		agencyConfig.marketing_channels.map((opt) => opt.label)
	);

	// Validation state
	let teamSizeError = $state("");

	// Derived validation
	let isTeamSizeValid = $derived(teamSize >= 1 && teamSize <= 10000);

	let isFormValid = $derived(industry.length > 0 && businessType.length > 0 && isTeamSizeValid);

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
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						+ {presence}
					</button>
				{/if}
			{/each}
		</div>

		<!-- Custom Input -->
		<div class="mb-3 flex gap-2">
			<input
				type="text"
				bind:value={newDigitalPresence}
				onkeydown={handleDigitalPresenceKeydown}
				placeholder="Add custom digital presence"
				{disabled}
				class="flex-1 rounded-xl border border-base-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
			/>
			<Button
				variant="primary"
				onclick={addDigitalPresence}
				disabled={disabled || newDigitalPresence.trim().length === 0}
			>
				<Plus class="h-4 w-4" />
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
							{disabled}
							class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-400 hover:text-blue-600 disabled:opacity-50"
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
		<div class="mb-3 flex gap-2">
			<input
				type="text"
				bind:value={newMarketingChannel}
				onkeydown={handleMarketingChannelKeydown}
				placeholder="Add custom marketing channel"
				{disabled}
				class="flex-1 rounded-xl border border-base-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
			/>
			<Button
				variant="primary"
				onclick={addMarketingChannel}
				disabled={disabled || newMarketingChannel.trim().length === 0}
			>
				<Plus class="h-4 w-4" />
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

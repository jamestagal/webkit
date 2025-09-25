<script lang="ts">
	import type { ContactInfo } from "$lib/types/consultation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import Input from "$lib/components/Input.svelte";
	import Textarea from "$lib/components/Textarea.svelte";
	import Button from "$lib/components/Button.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-svelte";

	// Props
	let {
		data = $bindable({}),
		errors = [],
		disabled = false,
	}: {
		data: ContactInfo;
		errors?: string[];
		disabled?: boolean;
	} = $props();

	// Local form state with runes
	let businessName = $state(data.business_name || "");
	let contactPerson = $state(data.contact_person || "");
	let email = $state(data.email || "");
	let phone = $state(data.phone || "");
	let website = $state(data.website || "");
	let socialMediaJson = $state(JSON.stringify(data.social_media || {}, null, 2));

	// Validation state
	let emailError = $state("");
	let websiteError = $state("");
	let socialMediaError = $state("");

	// Derived validation
	let isEmailValid = $derived(() => {
		if (!email) return true; // Optional field
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	});

	let isWebsiteValid = $derived(() => {
		if (!website) return true; // Optional field
		try {
			new URL(website);
			return true;
		} catch {
			return false;
		}
	});

	let parsedSocialMedia = $derived(() => {
		if (!socialMediaJson.trim()) return {};
		try {
			return JSON.parse(socialMediaJson);
		} catch {
			return null;
		}
	});

	let isSocialMediaValid = $derived(() => parsedSocialMedia !== null);

	let isFormValid = $derived(() => isEmailValid && isWebsiteValid && isSocialMediaValid);

	// Update parent data immediately but without triggering effects
	function updateParentData() {
		data.business_name = businessName.trim() || undefined;
		data.contact_person = contactPerson.trim() || undefined;
		data.email = email.trim() || undefined;
		data.phone = phone.trim() || undefined;
		data.website = website.trim() || undefined;
		data.social_media =
			parsedSocialMedia && Object.keys(parsedSocialMedia).length > 0
				? parsedSocialMedia
				: undefined;
	}

	// Call update only on blur/change events, not in reactive effect
	function handleFieldUpdate() {
		if (isFormValid) {
			updateParentData();
		}
	}

	// Update validation errors
	$effect(() => {
		emailError = !isEmailValid ? "Please enter a valid email address" : "";
		websiteError = !isWebsiteValid ? "Please enter a valid website URL" : "";
		socialMediaError = !isSocialMediaValid ? "Invalid JSON format" : "";
	});

	// Focus management
	let businessNameRef: HTMLInputElement;

	$effect(() => {
		// Focus first field when component mounts
		if (businessNameRef) {
			businessNameRef.focus();
		}
	});

	// Handle social media shortcuts
	function addSocialMediaPlatform(platform: string): void {
		try {
			const current = JSON.parse(socialMediaJson || "{}");
			current[platform] = "";
			socialMediaJson = JSON.stringify(current, null, 2);
		} catch {
			socialMediaJson = JSON.stringify({ [platform]: "" }, null, 2);
		}
	}

	// Auto-format phone number
	function formatPhoneNumber(value: string): string {
		const cleaned = value.replace(/\D/g, "");
		const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
		if (match) {
			return `(${match[1]}) ${match[2]}-${match[3]}`;
		}
		return value;
	}

	// Handle phone input
	function handlePhoneInput(event: Event): void {
		const target = event.target as HTMLInputElement;
		const formatted = formatPhoneNumber(target.value);
		phone = formatted;
		target.value = formatted;
	}

	// Handle phone blur
	function handlePhoneBlur(): void {
		handleFieldUpdate();
	}

	// Handle website input - auto-add protocol
	function handleWebsiteBlur(): void {
		if (website && !website.match(/^https?:\/\//)) {
			website = "https://" + website;
		}
		handleFieldUpdate();
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-2xl font-bold text-gray-900">Contact Information</h2>
		<p class="mt-1 text-sm text-gray-600">Tell us about your business and how we can reach you.</p>
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
		<!-- Business Name -->
		<div class="sm:col-span-2">
			<Input
				bind:ref={businessNameRef}
				bind:value={businessName}
				onblur={handleFieldUpdate}
				label="Business Name"
				placeholder="Your company or organization name"
				{disabled}
				autocomplete="organization"
			/>
		</div>

		<!-- Contact Person -->
		<div class="sm:col-span-2">
			<Input
				bind:value={contactPerson}
				onblur={handleFieldUpdate}
				label="Contact Person"
				placeholder="Primary contact person"
				{disabled}
				autocomplete="name"
			/>
		</div>

		<!-- Email -->
		<div>
			<Input
				bind:value={email}
				onblur={handleFieldUpdate}
				type="email"
				label="Email Address"
				placeholder="contact@company.com"
				{disabled}
				required={true}
				error={emailError}
				autocomplete="email"
			/>
		</div>

		<!-- Phone -->
		<div>
			<Input
				value={phone}
				oninput={handlePhoneInput}
				onblur={handlePhoneBlur}
				type="tel"
				label="Phone Number"
				placeholder="(555) 123-4567"
				{disabled}
				autocomplete="tel"
			/>
		</div>

		<!-- Website -->
		<div class="sm:col-span-2">
			<Input
				bind:value={website}
				onblur={handleWebsiteBlur}
				type="url"
				label="Website"
				placeholder="https://www.company.com"
				{disabled}
				error={websiteError}
				autocomplete="url"
			/>
		</div>

		<!-- Social Media -->
		<div class="sm:col-span-2">
			<label class="mb-2 block text-sm font-medium text-gray-700">
				Social Media Profiles
				<span class="font-normal text-gray-500">(Optional)</span>
			</label>

			<!-- Quick Add Buttons -->
			<div class="mb-3 flex flex-wrap gap-2">
				<Button variant="outline" onclick={() => addSocialMediaPlatform("linkedin")} {disabled}>
					LinkedIn
				</Button>
				<Button variant="outline" onclick={() => addSocialMediaPlatform("twitter")} {disabled}>
					Twitter
				</Button>
				<Button variant="outline" onclick={() => addSocialMediaPlatform("facebook")} {disabled}>
					Facebook
				</Button>
				<Button variant="outline" onclick={() => addSocialMediaPlatform("instagram")} {disabled}>
					Instagram
				</Button>
			</div>

			<Textarea
				bind:value={socialMediaJson}
				onblur={handleFieldUpdate}
				label="Social Media JSON"
				placeholder={'{\n  "linkedin": "https://linkedin.com/company/yourcompany",\n  "twitter": "https://twitter.com/yourcompany"\n}'}
				rows={4}
				{disabled}
				error={socialMediaError}
				class="font-mono text-sm"
			/>
			<p class="mt-1 text-sm text-gray-500">
				Add your social media profiles in JSON format. Use the buttons above for quick setup.
			</p>
		</div>
	</div>

	<!-- Form Status Indicator -->
	<div class="flex items-center space-x-2 text-sm">
		{#if isFormValid}
			<CheckCircle class="h-5 w-5 text-green-500" />
			<span class="text-green-700">Contact information is complete</span>
		{:else}
			<AlertTriangle class="h-5 w-5 text-yellow-500" />
			<span class="text-yellow-700">Please review and complete the form</span>
		{/if}

		{#if consultationStore.formState.isAutoSaving}
			<div class="flex items-center space-x-1 text-blue-600">
				<Spinner size={16} />
				<span class="text-sm">Saving...</span>
			</div>
		{:else if consultationStore.formState.lastSaved}
			<span class="text-gray-500">
				Saved {consultationStore.formState.lastSaved.toLocaleTimeString()}
			</span>
		{/if}
	</div>
</div>

<style>
	/* Custom JSON editor styling */
	:global(.font-mono) {
		font-family: "Monaco", "Menlo", "Ubuntu Mono", "Consolas", "source-code-pro", monospace;
	}
</style>

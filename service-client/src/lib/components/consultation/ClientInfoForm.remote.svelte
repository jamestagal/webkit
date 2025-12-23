<script lang="ts">
	/**
	 * Contact Information Form - Remote Functions Implementation
	 *
	 * Pattern: Form Enhancement with SvelteKit Remote Functions
	 * Cognitive Load: 12
	 * - Remote function import: 1
	 * - Field bindings (6 fields × 1): 6
	 * - Validation display: 2
	 * - Loading states: 1
	 * - Event handlers: 2
	 *
	 * Uses saveContactInfo remote function with:
	 * - Automatic validation via Zod schema
	 * - Progressive enhancement (works without JS)
	 * - Loading states via .pending property
	 * - Validation errors via .issues() method
	 */

	import { saveContactInfo } from '$lib/api/consultation.remote';
	import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-svelte';
	import type { Consultation } from '$lib/types/consultation';

	// Props
	let {
		consultation,
		onNext = () => {}
	}: {
		consultation: Consultation;
		onNext?: () => void;
	} = $props();

	// Local state for non-schema fields
	let socialMediaJson = $state(
		consultation.parsed_contact_info?.social_media
			? JSON.stringify(consultation.parsed_contact_info.social_media, null, 2)
			: '{}'
	);

	// Derived state for social media validation
	let parsedSocialMedia = $derived.by(() => {
		if (!socialMediaJson.trim()) return {};
		try {
			return JSON.parse(socialMediaJson);
		} catch {
			return null;
		}
	});

	let isSocialMediaValid = $derived(parsedSocialMedia !== null);

	// Handle social media shortcuts
	function addSocialMediaPlatform(platform: string): void {
		try {
			const current = JSON.parse(socialMediaJson || '{}');
			current[platform] = '';
			socialMediaJson = JSON.stringify(current, null, 2);
		} catch {
			socialMediaJson = JSON.stringify({ [platform]: '' }, null, 2);
		}
	}

	// Auto-format phone number
	function formatPhoneNumber(value: string): string {
		const cleaned = value.replace(/\D/g, '');
		const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
		if (match) {
			return `(${match[1]}) ${match[2]}-${match[3]}`;
		}
		return value;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-2xl font-bold">Contact Information</h2>
		<p class="mt-1 text-sm opacity-70">Tell us about your business and how we can reach you.</p>
	</div>

	<!-- Form with Remote Function Enhancement -->
	<form
		method="POST"
		use:saveContactInfo.enhance
		onsubmit={() => {
			setTimeout(() => {
				if (!saveContactInfo.pending) {
					onNext();
				}
			}, 100);
		}}
	>
		<!-- Form Fields -->
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
			<!-- Business Name -->
			<div class="sm:col-span-2">
				<label class="floating-label">
					<span>Business Name</span>
					<input
						{...saveContactInfo.fields.business_name.as('text')}
						value={consultation.parsed_contact_info?.business_name ?? ''}
						placeholder="Your company or organization name"
						autocomplete="organization"
						class="input w-full"
						disabled={saveContactInfo.pending}
					/>
				</label>
				<!-- Validation Errors -->
				{#each saveContactInfo.fields.business_name.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Contact Person -->
			<div class="sm:col-span-2">
				<label class="floating-label">
					<span>Contact Person</span>
					<input
						{...saveContactInfo.fields.contact_person.as('text')}
						value={consultation.parsed_contact_info?.contact_person ?? ''}
						placeholder="Primary contact person"
						autocomplete="name"
						class="input w-full"
						disabled={saveContactInfo.pending}
					/>
				</label>
				{#each saveContactInfo.fields.contact_person.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Email -->
			<div>
				<label class="floating-label">
					<span>Email Address *</span>
					<input
						{...saveContactInfo.fields.email.as('email')}
						value={consultation.parsed_contact_info?.email ?? ''}
						placeholder="contact@company.com"
						required
						autocomplete="email"
						class="input w-full"
						disabled={saveContactInfo.pending}
					/>
				</label>
				{#each saveContactInfo.fields.email.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Phone -->
			<div>
				<label class="floating-label">
					<span>Phone Number</span>
					<input
						{...saveContactInfo.fields.phone.as('tel')}
						value={consultation.parsed_contact_info?.phone ?? ''}
						placeholder="(555) 123-4567"
						autocomplete="tel"
						class="input w-full"
						disabled={saveContactInfo.pending}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							target.value = formatPhoneNumber(target.value);
						}}
					/>
				</label>
				{#each saveContactInfo.fields.phone.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Website -->
			<div class="sm:col-span-2">
				<label class="floating-label">
					<span>Website</span>
					<input
						{...saveContactInfo.fields.website.as('url')}
						value={consultation.parsed_contact_info?.website ?? ''}
						placeholder="https://www.company.com"
						autocomplete="url"
						class="input w-full"
						disabled={saveContactInfo.pending}
						onblur={(e) => {
							const target = e.target as HTMLInputElement;
							if (target.value && !target.value.match(/^https?:\/\//)) {
								target.value = 'https://' + target.value;
							}
						}}
					/>
				</label>
				{#each saveContactInfo.fields.website.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Social Media -->
			<div class="sm:col-span-2">
				<label class="mb-2 block text-sm font-medium">
					Social Media Profiles
					<span class="font-normal opacity-60">(Optional)</span>
				</label>

				<!-- Quick Add Buttons -->
				<div class="mb-3 flex flex-wrap gap-2">
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() => addSocialMediaPlatform('linkedin')}
						disabled={saveContactInfo.pending}
					>
						LinkedIn
					</button>
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() => addSocialMediaPlatform('twitter')}
						disabled={saveContactInfo.pending}
					>
						Twitter
					</button>
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() => addSocialMediaPlatform('facebook')}
						disabled={saveContactInfo.pending}
					>
						Facebook
					</button>
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() => addSocialMediaPlatform('instagram')}
						disabled={saveContactInfo.pending}
					>
						Instagram
					</button>
				</div>

				<label class="floating-label">
					<span>Social Media JSON</span>
					<textarea
						bind:value={socialMediaJson}
						placeholder={'{\n  "linkedin": "https://linkedin.com/company/yourcompany",\n  "twitter": "https://twitter.com/yourcompany"\n}'}
						rows={4}
						class="textarea w-full font-mono text-sm"
						class:textarea-error={!isSocialMediaValid}
						disabled={saveContactInfo.pending}
					></textarea>
					{#if !isSocialMediaValid}
						<div class="text-error mt-1 text-sm">Invalid JSON format</div>
					{/if}
				</label>
				<!-- Hidden input to pass social_media to remote function -->
				{#if isSocialMediaValid && Object.keys(parsedSocialMedia).length > 0}
					<input
						type="hidden"
						name="social_media"
						value={JSON.stringify(parsedSocialMedia)}
					/>
				{/if}
				<p class="mt-1 text-sm opacity-60">
					Add your social media profiles in JSON format. Use the buttons above for quick setup.
				</p>
			</div>
		</div>

		<!-- Form Status Indicator -->
		<div class="mt-6 flex items-center space-x-2 text-sm">
			{#if saveContactInfo.pending}
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
			{:else if saveContactInfo.fields.email.value}
				<CheckCircle class="text-success h-5 w-5" />
				<span class="text-success">Contact information ready</span>
			{:else}
				<AlertTriangle class="text-warning h-5 w-5" />
				<span class="text-warning">Please enter your contact information</span>
			{/if}
		</div>

		<!-- Submit Button (Hidden - form submits via Next button in parent) -->
		<button type="submit" class="hidden">Save & Continue</button>
	</form>
</div>

<style>
	/* Custom JSON editor styling */
	:global(.font-mono) {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
	}
</style>

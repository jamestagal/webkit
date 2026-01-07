<script lang="ts">
	import type { QuestionnaireResponses } from '$lib/api/questionnaire.types';

	interface Props {
		responses: QuestionnaireResponses;
		onchange: () => void;
		disabled?: boolean;
	}

	let { responses = $bindable(), onchange, disabled = false }: Props = $props();

	function handleInput() {
		onchange();
	}

	function handleRadioChange(value: 'yes' | 'no') {
		responses.google_analytics = value;
		onchange();
	}

	function handleCheckboxChange(field: 'other_services_interest' | 'marketing_permissions', value: string, checked: boolean) {
		const currentValues = responses[field] || [];
		if (checked) {
			responses[field] = [...currentValues, value];
		} else {
			responses[field] = currentValues.filter((v) => v !== value);
		}
		onchange();
	}

	// Options for checkboxes
	const serviceOptions = [
		{ value: 'seo', label: 'Search Engine Optimization (SEO)' },
		{ value: 'social_media', label: 'Social Media Management' },
		{ value: 'ppc', label: 'Pay-Per-Click Advertising (Google Ads)' },
		{ value: 'content', label: 'Content Writing/Marketing' },
		{ value: 'branding', label: 'Branding & Logo Design' }
	];

	const marketingOptions = [
		{ value: 'email', label: 'Email' },
		{ value: 'phone', label: 'Phone' },
		{ value: 'sms', label: 'SMS' }
	];
</script>

<div class="space-y-6">
	<p class="text-base-content/70">
		Just a few more details to help us deliver your project successfully.
	</p>

	<!-- Timeline -->
	<div class="form-control">
		<label class="label" for="timeline">
			<span class="label-text">Timeline / Desired Launch Date <span class="text-error">*</span></span>
		</label>
		<input
			type="text"
			id="timeline"
			class="input input-bordered w-full"
			bind:value={responses.timeline}
			oninput={handleInput}
			{disabled}
			placeholder="e.g., ASAP, Within 4 weeks, By March 2025, No rush"
		/>
		<label class="label">
			<span class="label-text-alt text-base-content/60">When would you like the website to be live?</span>
		</label>
	</div>

	<!-- Google Analytics -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">Would you like Google Analytics set up? <span class="text-error">*</span></span>
		</label>
		<div class="flex flex-wrap gap-4">
			<label class="label cursor-pointer gap-2">
				<input
					type="radio"
					name="google_analytics"
					class="radio radio-primary"
					checked={responses.google_analytics === 'yes'}
					onchange={() => handleRadioChange('yes')}
					{disabled}
				/>
				<span class="label-text">Yes</span>
			</label>
			<label class="label cursor-pointer gap-2">
				<input
					type="radio"
					name="google_analytics"
					class="radio radio-primary"
					checked={responses.google_analytics === 'no'}
					onchange={() => handleRadioChange('no')}
					{disabled}
				/>
				<span class="label-text">No</span>
			</label>
		</div>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Track website visitors and their behavior</span>
		</label>
	</div>

	<!-- Referral Source -->
	<div class="form-control">
		<label class="label" for="referral_source">
			<span class="label-text">How did you hear about us?</span>
		</label>
		<input
			type="text"
			id="referral_source"
			class="input input-bordered w-full"
			bind:value={responses.referral_source}
			oninput={handleInput}
			{disabled}
			placeholder="e.g., Google search, Referral from [name], Social media"
		/>
	</div>

	<!-- Other Services Interest -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">Are you interested in any other services?</span>
		</label>
		<div class="space-y-2">
			{#each serviceOptions as option (option.value)}
				<label class="label cursor-pointer justify-start gap-3">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						checked={(responses.other_services_interest || []).includes(option.value)}
						onchange={(e) => handleCheckboxChange('other_services_interest', option.value, e.currentTarget.checked)}
						{disabled}
					/>
					<span class="label-text">{option.label}</span>
				</label>
			{/each}
		</div>
	</div>

	<!-- Marketing Permissions -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">How may we contact you for marketing purposes?</span>
		</label>
		<div class="flex flex-wrap gap-4">
			{#each marketingOptions as option (option.value)}
				<label class="label cursor-pointer gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-primary"
						checked={(responses.marketing_permissions || []).includes(option.value)}
						onchange={(e) => handleCheckboxChange('marketing_permissions', option.value, e.currentTarget.checked)}
						{disabled}
					/>
					<span class="label-text">{option.label}</span>
				</label>
			{/each}
		</div>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Optional - We respect your privacy</span>
		</label>
	</div>

	<!-- Submit Notice -->
	<div class="alert alert-info mt-8">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>
		<div>
			<p class="font-medium">Ready to submit?</p>
			<p class="text-sm">Review your answers and click "Submit Questionnaire" when you're done. You can navigate back to previous sections using the sidebar.</p>
		</div>
	</div>
</div>

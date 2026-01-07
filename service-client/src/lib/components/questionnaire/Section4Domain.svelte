<script lang="ts">
	import type { QuestionnaireResponses } from '$lib/api/questionnaire.remote';

	interface Props {
		responses: QuestionnaireResponses;
		onchange: () => void;
		disabled?: boolean;
	}

	let { responses = $bindable(), onchange, disabled = false }: Props = $props();

	function handleInput() {
		onchange();
	}

	function handleRadioChange(field: 'has_domain' | 'has_google_business', value: 'yes' | 'no') {
		responses[field] = value;
		onchange();
	}
</script>

<div class="space-y-6">
	<p class="text-base-content/70">
		Tell us about your existing domain and online presence.
	</p>

	<!-- Has Domain -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">Do you already have a domain name? <span class="text-error">*</span></span>
		</label>
		<div class="flex flex-wrap gap-4">
			<label class="label cursor-pointer gap-2">
				<input
					type="radio"
					name="has_domain"
					class="radio radio-primary"
					checked={responses.has_domain === 'yes'}
					onchange={() => handleRadioChange('has_domain', 'yes')}
					{disabled}
				/>
				<span class="label-text">Yes, I have a domain</span>
			</label>
			<label class="label cursor-pointer gap-2">
				<input
					type="radio"
					name="has_domain"
					class="radio radio-primary"
					checked={responses.has_domain === 'no'}
					onchange={() => handleRadioChange('has_domain', 'no')}
					{disabled}
				/>
				<span class="label-text">No, I need one</span>
			</label>
		</div>
	</div>

	<!-- Domain Name (conditional) -->
	{#if responses.has_domain === 'yes'}
		<div class="form-control">
			<label class="label" for="domain_name">
				<span class="label-text">Domain Name</span>
			</label>
			<input
				type="text"
				id="domain_name"
				class="input input-bordered w-full"
				bind:value={responses.domain_name}
				oninput={handleInput}
				{disabled}
				placeholder="yourbusiness.com.au"
			/>
			<label class="label">
				<span class="label-text-alt text-base-content/60">Enter your existing domain name (without http://)</span>
			</label>
		</div>
	{/if}

	<!-- Has Google Business -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">Do you have a Google Business Profile? <span class="text-error">*</span></span>
		</label>
		<div class="flex flex-wrap gap-4">
			<label class="label cursor-pointer gap-2">
				<input
					type="radio"
					name="has_google_business"
					class="radio radio-primary"
					checked={responses.has_google_business === 'yes'}
					onchange={() => handleRadioChange('has_google_business', 'yes')}
					{disabled}
				/>
				<span class="label-text">Yes</span>
			</label>
			<label class="label cursor-pointer gap-2">
				<input
					type="radio"
					name="has_google_business"
					class="radio radio-primary"
					checked={responses.has_google_business === 'no'}
					onchange={() => handleRadioChange('has_google_business', 'no')}
					{disabled}
				/>
				<span class="label-text">No</span>
			</label>
		</div>
		<label class="label">
			<span class="label-text-alt text-base-content/60">
				Google Business Profile helps customers find you on Google Search and Maps
			</span>
		</label>
	</div>
</div>

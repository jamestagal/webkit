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
</script>

<div class="space-y-6">
	<p class="text-base-content/70">
		Help us understand your design preferences so we can create a website that reflects your brand.
	</p>

	<!-- Competitor Websites -->
	<div class="form-control">
		<label class="label" for="competitor_websites">
			<span class="label-text">Competitor Websites</span>
		</label>
		<textarea
			id="competitor_websites"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.competitor_websites}
			oninput={handleInput}
			{disabled}
			placeholder="List your main competitors' websites:&#10;www.competitor1.com&#10;www.competitor2.com"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">This helps us understand your industry's online presence</span>
		</label>
	</div>

	<!-- Reference Websites -->
	<div class="form-control">
		<label class="label" for="reference_websites">
			<span class="label-text">Websites you like (for inspiration) <span class="text-error">*</span></span>
		</label>
		<textarea
			id="reference_websites"
			class="textarea textarea-bordered w-full min-h-[120px]"
			bind:value={responses.reference_websites}
			oninput={handleInput}
			{disabled}
			placeholder="List 2-5 websites you like and what you like about them:&#10;&#10;www.example1.com - Love the clean layout&#10;www.example2.com - Great use of images&#10;www.example3.com - Like the color scheme"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">These don't need to be in your industry</span>
		</label>
	</div>

	<!-- Aesthetic Description -->
	<div class="form-control">
		<label class="label" for="aesthetic_description">
			<span class="label-text">Describe your desired look and feel <span class="text-error">*</span></span>
		</label>
		<textarea
			id="aesthetic_description"
			class="textarea textarea-bordered w-full min-h-[120px]"
			bind:value={responses.aesthetic_description}
			oninput={handleInput}
			{disabled}
			placeholder="Describe the style you're looking for:&#10;&#10;e.g., Modern and minimal, Professional and corporate, Warm and friendly, Bold and energetic, Elegant and sophisticated"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Use words that describe the feeling you want visitors to have</span>
		</label>
	</div>

	<!-- Branding Guidelines -->
	<div class="form-control">
		<label class="label" for="branding_guidelines">
			<span class="label-text">Existing Branding Guidelines</span>
		</label>
		<textarea
			id="branding_guidelines"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.branding_guidelines}
			oninput={handleInput}
			{disabled}
			placeholder="Do you have existing brand colors, fonts, or style guides?&#10;&#10;e.g., Primary color: #1a5f7a, Secondary: #57c5b6, Font: Open Sans"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Share any brand colors, fonts, or design guidelines you have</span>
		</label>
	</div>

	<!-- Additional Design Details -->
	<div class="form-control">
		<label class="label" for="additional_design_details">
			<span class="label-text">Additional Design Notes</span>
		</label>
		<textarea
			id="additional_design_details"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.additional_design_details}
			oninput={handleInput}
			{disabled}
			placeholder="Any other design preferences, requirements, or things to avoid?"
		></textarea>
	</div>
</div>

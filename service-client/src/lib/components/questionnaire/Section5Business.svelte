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
		Help us understand your business so we can tell your story effectively on your website.
	</p>

	<!-- Business Story -->
	<div class="form-control">
		<label class="label" for="business_story">
			<span class="label-text">Tell us your story/background <span class="text-error">*</span></span>
		</label>
		<textarea
			id="business_story"
			class="textarea textarea-bordered w-full min-h-[150px]"
			bind:value={responses.business_story}
			oninput={handleInput}
			{disabled}
			placeholder="How did your business start? What's your mission? What drives you?"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">This will help us write your About page</span>
		</label>
	</div>

	<!-- Business Emails -->
	<div class="form-control">
		<label class="label" for="business_emails">
			<span class="label-text">Business Email Addresses</span>
		</label>
		<textarea
			id="business_emails"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.business_emails}
			oninput={handleInput}
			{disabled}
			placeholder="info@yourbusiness.com&#10;sales@yourbusiness.com&#10;support@yourbusiness.com"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">List all email addresses you want to use on the website</span>
		</label>
	</div>

	<!-- Areas Served -->
	<div class="form-control">
		<label class="label" for="areas_served">
			<span class="label-text">Areas/Regions Served <span class="text-error">*</span></span>
		</label>
		<textarea
			id="areas_served"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.areas_served}
			oninput={handleInput}
			{disabled}
			placeholder="e.g., Sydney Metropolitan Area, All of NSW, Australia-wide, International"
		></textarea>
	</div>

	<!-- Target Customers -->
	<div class="form-control">
		<label class="label" for="target_customers">
			<span class="label-text">Who are your target customers? <span class="text-error">*</span></span>
		</label>
		<textarea
			id="target_customers"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.target_customers}
			oninput={handleInput}
			{disabled}
			placeholder="Describe your ideal customers - age, demographics, industries, or specific types of businesses"
		></textarea>
	</div>

	<!-- Top Services -->
	<div class="form-control">
		<label class="label" for="top_services">
			<span class="label-text">Top 3-4 Services/Products <span class="text-error">*</span></span>
		</label>
		<textarea
			id="top_services"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.top_services}
			oninput={handleInput}
			{disabled}
			placeholder="1. Service/Product One&#10;2. Service/Product Two&#10;3. Service/Product Three&#10;4. Service/Product Four"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Your most important or popular offerings</span>
		</label>
	</div>

	<!-- Other Services -->
	<div class="form-control">
		<label class="label" for="other_services">
			<span class="label-text">Other Services/Products</span>
		</label>
		<textarea
			id="other_services"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.other_services}
			oninput={handleInput}
			{disabled}
			placeholder="List any additional services or products you offer"
		></textarea>
	</div>

	<!-- Differentiators -->
	<div class="form-control">
		<label class="label" for="differentiators">
			<span class="label-text">What sets you apart from competitors? <span class="text-error">*</span></span>
		</label>
		<textarea
			id="differentiators"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.differentiators}
			oninput={handleInput}
			{disabled}
			placeholder="What makes your business unique? Why should customers choose you?"
		></textarea>
	</div>

	<!-- Statistics/Awards -->
	<div class="form-control">
		<label class="label" for="statistics_awards">
			<span class="label-text">Statistics, Awards, or Achievements</span>
		</label>
		<textarea
			id="statistics_awards"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.statistics_awards}
			oninput={handleInput}
			{disabled}
			placeholder="e.g., 15+ years experience, 500+ happy customers, Award-winning service"
		></textarea>
	</div>

	<!-- Additional Details -->
	<div class="form-control">
		<label class="label" for="additional_business_details">
			<span class="label-text">Additional Details</span>
		</label>
		<textarea
			id="additional_business_details"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.additional_business_details}
			oninput={handleInput}
			{disabled}
			placeholder="Anything else you'd like us to know about your business?"
		></textarea>
	</div>
</div>

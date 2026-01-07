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
</script>

<div class="space-y-6">
	<p class="text-base-content/70">
		Tell us what content and functionality you want on your website.
	</p>

	<!-- Pages Wanted -->
	<div class="form-control">
		<label class="label" for="pages_wanted">
			<span class="label-text">What pages do you want on your website? <span class="text-error">*</span></span>
		</label>
		<textarea
			id="pages_wanted"
			class="textarea textarea-bordered w-full min-h-[120px]"
			bind:value={responses.pages_wanted}
			oninput={handleInput}
			{disabled}
			placeholder="e.g.,&#10;- Home&#10;- About Us&#10;- Services (with individual service pages)&#10;- Portfolio/Gallery&#10;- Testimonials&#10;- Contact"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">List all the pages you'd like to have</span>
		</label>
	</div>

	<!-- Customer Actions -->
	<div class="form-control">
		<label class="label" for="customer_actions">
			<span class="label-text">What actions do you want visitors to take? <span class="text-error">*</span></span>
		</label>
		<textarea
			id="customer_actions"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.customer_actions}
			oninput={handleInput}
			{disabled}
			placeholder="e.g., Call us, Submit enquiry form, Book appointment, Request quote, Sign up for newsletter"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">These become your main calls-to-action</span>
		</label>
	</div>

	<!-- Key Information -->
	<div class="form-control">
		<label class="label" for="key_information">
			<span class="label-text">What key information must visitors see? <span class="text-error">*</span></span>
		</label>
		<textarea
			id="key_information"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.key_information}
			oninput={handleInput}
			{disabled}
			placeholder="What's the most important information visitors need to know?"
		></textarea>
	</div>

	<!-- Calls to Action -->
	<div class="form-control">
		<label class="label" for="calls_to_action">
			<span class="label-text">Primary Call-to-Action Text <span class="text-error">*</span></span>
		</label>
		<textarea
			id="calls_to_action"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.calls_to_action}
			oninput={handleInput}
			{disabled}
			placeholder="e.g., 'Get a Free Quote', 'Book Now', 'Contact Us Today', 'Start Your Project'"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">The main button text visitors will see</span>
		</label>
	</div>

	<!-- Regularly Updated Content -->
	<div class="form-control">
		<label class="label" for="regularly_updated_content">
			<span class="label-text">Will you have regularly updated content?</span>
		</label>
		<textarea
			id="regularly_updated_content"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.regularly_updated_content}
			oninput={handleInput}
			{disabled}
			placeholder="e.g., Blog posts, News updates, Case studies, Portfolio additions"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Content you plan to add or update regularly</span>
		</label>
	</div>

	<!-- Additional Content Details -->
	<div class="form-control">
		<label class="label" for="additional_content_details">
			<span class="label-text">Additional Content Details</span>
		</label>
		<textarea
			id="additional_content_details"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.additional_content_details}
			oninput={handleInput}
			{disabled}
			placeholder="Any other content requirements or ideas?"
		></textarea>
	</div>
</div>

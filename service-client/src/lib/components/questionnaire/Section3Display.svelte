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
		This information will be displayed publicly on your website. It may differ from your registered business details.
	</p>

	<!-- Displayed Business Name -->
	<div class="form-control">
		<label class="label" for="displayed_business_name">
			<span class="label-text">Business Name to Display <span class="text-error">*</span></span>
		</label>
		<input
			type="text"
			id="displayed_business_name"
			class="input input-bordered w-full"
			bind:value={responses.displayed_business_name}
			oninput={handleInput}
			{disabled}
			placeholder="Your Brand Name"
		/>
		<label class="label">
			<span class="label-text-alt text-base-content/60">This can be a trading name or brand name</span>
		</label>
	</div>

	<!-- Displayed Address -->
	<div class="form-control">
		<label class="label" for="displayed_address">
			<span class="label-text">Address to Display</span>
		</label>
		<textarea
			id="displayed_address"
			class="textarea textarea-bordered w-full min-h-[80px]"
			bind:value={responses.displayed_address}
			oninput={handleInput}
			{disabled}
			placeholder="123 Main Street, Suburb, State"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Leave blank if you don't want to display an address</span>
		</label>
	</div>

	<!-- Phone Number -->
	<div class="form-control">
		<label class="label" for="displayed_phone">
			<span class="label-text">Phone Number</span>
		</label>
		<input
			type="tel"
			id="displayed_phone"
			class="input input-bordered w-full"
			bind:value={responses.displayed_phone}
			oninput={handleInput}
			{disabled}
			placeholder="04XX XXX XXX or (02) XXXX XXXX"
		/>
	</div>

	<!-- Display Email -->
	<div class="form-control">
		<label class="label" for="displayed_email">
			<span class="label-text">Email to Display</span>
		</label>
		<input
			type="email"
			id="displayed_email"
			class="input input-bordered w-full"
			bind:value={responses.displayed_email}
			oninput={handleInput}
			{disabled}
			placeholder="contact@yourbusiness.com"
		/>
		<label class="label">
			<span class="label-text-alt text-base-content/60">This can be different from your personal email</span>
		</label>
	</div>

	<!-- Social Media -->
	<div class="form-control">
		<label class="label" for="social_media_accounts">
			<span class="label-text">Social Media Accounts</span>
		</label>
		<textarea
			id="social_media_accounts"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.social_media_accounts}
			oninput={handleInput}
			{disabled}
			placeholder="Facebook: facebook.com/yourbusiness&#10;Instagram: @yourbusiness&#10;LinkedIn: linkedin.com/company/yourbusiness"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">List each social media platform and your handle/URL</span>
		</label>
	</div>

	<!-- Opening Hours -->
	<div class="form-control">
		<label class="label" for="opening_hours">
			<span class="label-text">Opening Hours</span>
		</label>
		<textarea
			id="opening_hours"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.opening_hours}
			oninput={handleInput}
			{disabled}
			placeholder="Monday - Friday: 9am - 5pm&#10;Saturday: 10am - 2pm&#10;Sunday: Closed"
		></textarea>
	</div>
</div>

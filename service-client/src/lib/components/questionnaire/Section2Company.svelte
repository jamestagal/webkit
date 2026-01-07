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
		Tell us about your company for our records.
	</p>

	<!-- Company Name -->
	<div class="form-control">
		<label class="label" for="company_name">
			<span class="label-text">Company Name <span class="text-error">*</span></span>
		</label>
		<input
			type="text"
			id="company_name"
			class="input input-bordered w-full"
			bind:value={responses.company_name}
			oninput={handleInput}
			{disabled}
			placeholder="Your Company Pty Ltd"
		/>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Your registered business name</span>
		</label>
	</div>

	<!-- Registered Address -->
	<div class="form-control">
		<label class="label" for="registered_address">
			<span class="label-text">Registered Business Address <span class="text-error">*</span></span>
		</label>
		<textarea
			id="registered_address"
			class="textarea textarea-bordered w-full min-h-[100px]"
			bind:value={responses.registered_address}
			oninput={handleInput}
			{disabled}
			placeholder="123 Business Street&#10;City, State 1234"
		></textarea>
		<label class="label">
			<span class="label-text-alt text-base-content/60">Your official business address for legal documents</span>
		</label>
	</div>
</div>

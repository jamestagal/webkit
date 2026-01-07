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
		Please provide your contact information so we can reach you during the project.
	</p>

	<!-- First Name -->
	<div class="form-control">
		<label class="label" for="first_name">
			<span class="label-text">First Name <span class="text-error">*</span></span>
		</label>
		<input
			type="text"
			id="first_name"
			class="input input-bordered w-full"
			bind:value={responses.first_name}
			oninput={handleInput}
			{disabled}
			placeholder="Enter your first name"
		/>
	</div>

	<!-- Last Name -->
	<div class="form-control">
		<label class="label" for="last_name">
			<span class="label-text">Last Name <span class="text-error">*</span></span>
		</label>
		<input
			type="text"
			id="last_name"
			class="input input-bordered w-full"
			bind:value={responses.last_name}
			oninput={handleInput}
			{disabled}
			placeholder="Enter your last name"
		/>
	</div>

	<!-- Email -->
	<div class="form-control">
		<label class="label" for="email">
			<span class="label-text">Email Address <span class="text-error">*</span></span>
		</label>
		<input
			type="email"
			id="email"
			class="input input-bordered w-full"
			bind:value={responses.email}
			oninput={handleInput}
			{disabled}
			placeholder="your@email.com"
		/>
		<label class="label">
			<span class="label-text-alt text-base-content/60">We'll use this to send project updates</span>
		</label>
	</div>
</div>

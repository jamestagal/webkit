<script lang="ts">
	/**
	 * Consultation Form Page
	 *
	 * Uses SvelteKit remote functions for data loading and mutations.
	 * Data is fetched using the getOrCreateConsultation and getDraft remote functions.
	 */

	import ConsultationPage from '$lib/components/consultation/ConsultationPage.svelte';
	import { getOrCreateConsultation, getDraft } from '$lib/api/consultation.remote';

	// Load consultation using remote function
	const consultation = await getOrCreateConsultation();

	// Load draft if consultation exists
	const draft = consultation?.id ? await getDraft(consultation.id) : null;
</script>

<ConsultationPage {consultation} {draft} />

<script lang="ts">
	/**
	 * Consultation Edit Page
	 *
	 * Loads an existing consultation for editing.
	 * Works for both draft and completed consultations.
	 */

	import { page } from '$app/state';
	import ConsultationPage from '$lib/components/consultation/ConsultationPage.svelte';
	import { getConsultation, getDraft } from '$lib/api/consultation.remote';

	// Get consultation ID from URL params
	const consultationId = page.params.id;

	// Load the existing consultation
	const consultation = await getConsultation(consultationId);

	// Load draft if exists
	const draft = await getDraft(consultationId);
</script>

<ConsultationPage {consultation} {draft} />

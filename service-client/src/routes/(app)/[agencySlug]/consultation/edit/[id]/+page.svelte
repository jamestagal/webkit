<script lang="ts">
	/**
	 * Agency-Scoped Consultation Edit Page v2
	 *
	 * Loads an existing consultation for editing.
	 * Works for both draft and completed consultations.
	 */

	import { page } from '$app/state';
	import ConsultationPage from '$lib/components/consultation/ConsultationPage.svelte';
	import { getConsultation } from '$lib/api/consultation.remote';

	// Get agency ID from parent layout data
	const agencyId = page.data.currentAgency?.id;

	// Redirect if no agency context
	if (!agencyId) {
		throw new Error('No agency context available');
	}

	// Get consultation ID from URL params
	const consultationId = page.params.id;

	// Load the existing consultation
	const consultation = await getConsultation(consultationId);
</script>

<ConsultationPage {consultation} {agencyId} />

<script lang="ts">
	/**
	 * Agency-Scoped Consultation Form Page v2
	 *
	 * Uses the ConsultationPage component with the new 4-step form.
	 */

	import { page } from '$app/state';
	import ConsultationPage from '$lib/components/consultation/ConsultationPage.svelte';
	import { getExistingDraftConsultation } from '$lib/api/consultation.remote';

	// Get agency ID from parent layout data
	const agencyId = page.data.currentAgency?.id;

	// Redirect if no agency context
	if (!agencyId) {
		throw new Error('No agency context available');
	}

	// Load existing draft consultation (READ-ONLY - doesn't create)
	// Will be null if no draft exists yet
	const consultation = await getExistingDraftConsultation();
</script>

<ConsultationPage {consultation} {agencyId} />

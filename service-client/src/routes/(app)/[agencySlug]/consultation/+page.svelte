<script lang="ts">
	/**
	 * Agency-Scoped Consultation Form Page
	 *
	 * Uses the same ConsultationPage component as the original route,
	 * but within the agency context.
	 */

	import ConsultationPage from '$lib/components/consultation/ConsultationPage.svelte';
	import { getExistingDraftConsultation, getDraft } from '$lib/api/consultation.remote';

	// Load existing draft consultation (READ-ONLY - doesn't create)
	// Will be null if no draft exists yet
	const consultation = await getExistingDraftConsultation();

	// Load draft if consultation exists
	const draft = consultation?.id ? await getDraft(consultation.id) : null;
</script>

<ConsultationPage {consultation} {draft} />

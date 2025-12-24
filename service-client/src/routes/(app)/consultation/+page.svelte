<script lang="ts">
	/**
	 * Consultation Form Page
	 *
	 * Uses SvelteKit remote functions for data loading and mutations.
	 * Implements lazy creation pattern - consultation is only created when
	 * user clicks "Next" on the first step, not on page load.
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

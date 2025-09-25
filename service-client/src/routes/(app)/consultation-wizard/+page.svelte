<script lang="ts">
  import ConsultationWizard from '$lib/components/consultation/ConsultationWizard.svelte';
  import { goto } from '$app/navigation';
  import type { Consultation } from '$lib/types/consultation';

  function handleConsultationComplete(consultation: Consultation) {
    // Redirect to a success page or back to dashboard
    goto('/consultation/success');
  }
</script>

<svelte:head>
  <title>Project Consultation | PropGen</title>
  <meta name="description" content="Tell us about your project needs through our comprehensive consultation form." />
</svelte:head>

<ConsultationWizard
  onComplete={handleConsultationComplete}
  showStepIndicator={true}
  showProgressBar={true}
  autoSave={true}
/>
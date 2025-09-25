<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import ClientInfoForm from "$lib/components/consultation/ClientInfoForm.svelte";
	import BusinessContext from "$lib/components/consultation/BusinessContext.svelte";
	import PainPointsCapture from "$lib/components/consultation/PainPointsCapture.svelte";
	import GoalsObjectives from "$lib/components/consultation/GoalsObjectives.svelte";
	import MultiStepForm from "$lib/components/consultation/MultiStepForm.svelte";
	import { toast } from "$lib/components/shared/Toast.svelte";

	// Form data - simple state management
	let contactInfoData = $state({});
	let businessContextData = $state({});
	let painPointsData = $state({});
	let goalsObjectivesData = $state({});

	// Initialize consultation
	onMount(async () => {
		await consultationStore.initialize();

		// Initialize form data from store
		contactInfoData = consultationStore.formState.data.contact_info || {};
		businessContextData = consultationStore.formState.data.business_context || {};
		painPointsData = consultationStore.formState.data.pain_points || {};
		goalsObjectivesData = consultationStore.formState.data.goals_objectives || {};
	});


	// Define the steps
	const steps = [
		{
			id: "contact_info",
			title: "Contact Information",
		},
		{
			id: "business_context",
			title: "Business Context",
		},
		{
			id: "pain_points",
			title: "Pain Points",
		},
		{
			id: "goals_objectives",
			title: "Goals & Objectives",
		}
	];

	function handleStepChange(newStepIndex: number, oldStepIndex: number) {
		// Save data from the step we're leaving
		const oldStep = steps[oldStepIndex];
		if (oldStep?.id === 'contact_info') {
			consultationStore.updateSectionData('contact_info', contactInfoData);
		} else if (oldStep?.id === 'business_context') {
			consultationStore.updateSectionData('business_context', businessContextData);
		} else if (oldStep?.id === 'pain_points') {
			consultationStore.updateSectionData('pain_points', painPointsData);
		} else if (oldStep?.id === 'goals_objectives') {
			consultationStore.updateSectionData('goals_objectives', goalsObjectivesData);
		}
	}

	async function handleComplete() {
		try {
			// Save all form data before completing
			consultationStore.updateSectionData('contact_info', contactInfoData);
			consultationStore.updateSectionData('business_context', businessContextData);
			consultationStore.updateSectionData('pain_points', painPointsData);
			consultationStore.updateSectionData('goals_objectives', goalsObjectivesData);

			await consultationStore.save();
			toast.success("Consultation completed successfully!");
			goto("/consultation/success");
		} catch (error) {
			toast.error("Failed to save consultation. Please try again.");
		}
	}
</script>

<MultiStepForm {steps} onComplete={handleComplete} onStepChange={handleStepChange} showProgress={true}>
	{#snippet contact_info()}
		<ClientInfoForm bind:data={contactInfoData} />
	{/snippet}

	{#snippet business_context()}
		<BusinessContext bind:data={businessContextData} />
	{/snippet}

	{#snippet pain_points()}
		<PainPointsCapture bind:data={painPointsData} />
	{/snippet}

	{#snippet goals_objectives()}
		<GoalsObjectives bind:data={goalsObjectivesData} />
	{/snippet}
</MultiStepForm>
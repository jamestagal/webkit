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

	// Form data - initialize with empty objects to prevent reactive loops
	let contactInfoData = $state({});
	let businessContextData = $state({});
	let painPointsData = $state({});
	let goalsObjectivesData = $state({});

	// Track if we're initializing to prevent reactive loops during setup
	let isInitializing = $state(true);

	// Initialize consultation
	onMount(async () => {
		await consultationStore.initialize();

		// Only update if we have actual data from the store, and do it non-reactively
		const storeData = consultationStore.formState.data;
		if (storeData.contact_info && Object.keys(storeData.contact_info).length > 0) {
			contactInfoData = { ...storeData.contact_info };
		}
		if (storeData.business_context && Object.keys(storeData.business_context).length > 0) {
			businessContextData = { ...storeData.business_context };
		}
		if (storeData.pain_points && Object.keys(storeData.pain_points).length > 0) {
			painPointsData = { ...storeData.pain_points };
		}
		if (storeData.goals_objectives && Object.keys(storeData.goals_objectives).length > 0) {
			goalsObjectivesData = { ...storeData.goals_objectives };
		}

		// Mark initialization as complete
		isInitializing = false;
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
		},
	];

	function handleStepChange(newStepIndex: number, oldStepIndex: number) {
		// Prevent execution during initialization to avoid reactive loops
		if (isInitializing) {
			return;
		}

		// Save data from the step we're leaving
		const oldStep = steps[oldStepIndex];
		if (oldStep?.id === "contact_info") {
			consultationStore.updateSectionData("contact_info", contactInfoData);
		} else if (oldStep?.id === "business_context") {
			consultationStore.updateSectionData("business_context", businessContextData);
		} else if (oldStep?.id === "pain_points") {
			consultationStore.updateSectionData("pain_points", painPointsData);
		} else if (oldStep?.id === "goals_objectives") {
			consultationStore.updateSectionData("goals_objectives", goalsObjectivesData);
		}
	}

	async function handleComplete() {
		console.log("[Page] handleComplete called", { isInitializing });
		// Prevent execution during initialization
		if (isInitializing) {
			console.log("[Page] Blocked by isInitializing");
			return;
		}

		try {
			// Save all form data before completing
			console.log("[Page] Updating section data");
			consultationStore.updateSectionData("contact_info", contactInfoData);
			consultationStore.updateSectionData("business_context", businessContextData);
			consultationStore.updateSectionData("pain_points", painPointsData);
			consultationStore.updateSectionData("goals_objectives", goalsObjectivesData);

			console.log("[Page] Calling save()");
			const success = await consultationStore.save();
			console.log("[Page] Save result:", success);
			if (!success) {
				toast.error("Failed to save consultation. Please try again.");
				return;
			}
			toast.success("Consultation completed successfully!");
			goto("/consultation/success");
		} catch (error) {
			console.error("Error completing consultation:", error);
			toast.error("Failed to save consultation. Please try again.");
		}
	}
</script>

<MultiStepForm
	{steps}
	onComplete={handleComplete}
	onStepChange={handleStepChange}
	showProgress={true}
>
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

<script lang="ts">
	import type { PainPoints, UrgencyLevel } from "$lib/types/consultation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
	import { getAgencyConfig } from "$lib/stores/agency-config.svelte";
	import Input from "$lib/components/Input.svelte";
	import Select from "$lib/components/Select.svelte";
	import Textarea from "$lib/components/Textarea.svelte";
	import Button from "$lib/components/Button.svelte";
	import Spinner from "$lib/components/Spinner.svelte";
	import { X, AlertCircle, CheckCircle, AlertTriangle, Plus } from "lucide-svelte";

	// Props
	let {
		data = $bindable({}),
		errors = [],
		disabled = false,
	}: {
		data: PainPoints;
		errors?: string[];
		disabled?: boolean;
	} = $props();

	// Get agency config for configurable options
	const agencyConfig = getAgencyConfig();

	// Local form state with runes
	let primaryChallenges = $state<string[]>(data.primary_challenges || []);
	let technicalIssues = $state<string[]>(data.technical_issues || []);
	let urgencyLevel = $state<UrgencyLevel | undefined>(data.urgency_level);
	let impactAssessment = $state(data.impact_assessment || "");
	let currentSolutionGaps = $state<string[]>(data.current_solution_gaps || []);

	// Temporary input values
	let newChallenge = $state("");
	let newTechnicalIssue = $state("");
	let newSolutionGap = $state("");


	// Derived state for button disabled logic (ensures reactivity)
	let canAddChallenge = $derived(newChallenge.trim().length > 0);
	let canAddTechnicalIssue = $derived(newTechnicalIssue.trim().length > 0);
	let canAddSolutionGap = $derived(newSolutionGap.trim().length > 0);

	// Use agency config with defaults fallback
	let urgencyOptions = $derived([
		{ value: "", label: "Select urgency level" },
		...agencyConfig.urgency_level.map((opt) => ({ value: opt.value, label: opt.label })),
	]);

	let commonChallenges = $derived(
		agencyConfig.primary_challenges.map((opt) => opt.label)
	);

	let commonTechnicalIssues = $derived(
		agencyConfig.technical_issues.map((opt) => opt.label)
	);

	let commonSolutionGaps = $derived(
		agencyConfig.solution_gaps.map((opt) => opt.label)
	);

	// Validation state
	let impactAssessmentError = $state("");

	// Derived validation
	let isFormValid = $derived(primaryChallenges.length > 0 && urgencyLevel !== undefined);

	// Update parent data manually
	function updateParentData() {
		data.primary_challenges = primaryChallenges.length > 0 ? primaryChallenges : undefined;
		data.technical_issues = technicalIssues.length > 0 ? technicalIssues : undefined;
		data.urgency_level = urgencyLevel;
		data.impact_assessment = impactAssessment.trim() || undefined;
		data.current_solution_gaps = currentSolutionGaps.length > 0 ? currentSolutionGaps : undefined;
	}

	// Call update on field changes
	function handleFieldUpdate() {
		updateParentData();
	}

	// Primary challenges management
	function addChallenge(): void {
		if (newChallenge.trim() && !primaryChallenges.includes(newChallenge.trim())) {
			primaryChallenges = [...primaryChallenges, newChallenge.trim()];
			newChallenge = "";
			handleFieldUpdate();
		}
	}

	function removeChallenge(challenge: string): void {
		primaryChallenges = primaryChallenges.filter((c) => c !== challenge);
		handleFieldUpdate();
	}

	function addCommonChallenge(challenge: string): void {
		if (!primaryChallenges.includes(challenge)) {
			primaryChallenges = [...primaryChallenges, challenge];
			handleFieldUpdate();
		}
	}

	// Technical issues management
	function addTechnicalIssue(): void {
		if (newTechnicalIssue.trim() && !technicalIssues.includes(newTechnicalIssue.trim())) {
			technicalIssues = [...technicalIssues, newTechnicalIssue.trim()];
			newTechnicalIssue = "";
			handleFieldUpdate();
		}
	}

	function removeTechnicalIssue(issue: string): void {
		technicalIssues = technicalIssues.filter((i) => i !== issue);
		handleFieldUpdate();
	}

	function addCommonTechnicalIssue(issue: string): void {
		if (!technicalIssues.includes(issue)) {
			technicalIssues = [...technicalIssues, issue];
			handleFieldUpdate();
		}
	}

	// Solution gaps management
	function addSolutionGap(): void {
		if (newSolutionGap.trim() && !currentSolutionGaps.includes(newSolutionGap.trim())) {
			currentSolutionGaps = [...currentSolutionGaps, newSolutionGap.trim()];
			newSolutionGap = "";
			handleFieldUpdate();
		}
	}

	function removeSolutionGap(gap: string): void {
		currentSolutionGaps = currentSolutionGaps.filter((g) => g !== gap);
		handleFieldUpdate();
	}

	function addCommonSolutionGap(gap: string): void {
		if (!currentSolutionGaps.includes(gap)) {
			currentSolutionGaps = [...currentSolutionGaps, gap];
			handleFieldUpdate();
		}
	}

	// Handle keyboard events
	function handleChallengeKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addChallenge();
		}
	}

	function handleTechnicalIssueKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addTechnicalIssue();
		}
	}

	function handleSolutionGapKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addSolutionGap();
		}
	}

	// Get urgency level color class
	function getUrgencyColorClass(level: UrgencyLevel | undefined): string {
		switch (level) {
			case "low":
				return "text-green-700 bg-green-100";
			case "medium":
				return "text-yellow-700 bg-yellow-100";
			case "high":
				return "text-orange-700 bg-orange-100";
			case "critical":
				return "text-red-700 bg-red-100";
			default:
				return "text-gray-700 bg-gray-100";
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-base-content text-2xl font-bold">Pain Points & Challenges</h2>
		<p class="text-base-content/70 mt-1 text-sm">
			Help us understand the current challenges and issues you're facing.
		</p>
	</div>

	<!-- Error Summary -->
	{#if errors.length > 0}
		<div class="rounded-md bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Please correct the following errors:</h3>
					<div class="mt-2 text-sm text-red-700">
						<ul class="list-inside list-disc">
							{#each errors as error}
								<li>{error}</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Primary Challenges -->
	<div>
		<label class="text-base-content mb-2 block text-sm font-medium">Primary Challenges *</label>
		<p class="text-base-content/70 mb-3 text-sm">
			What are the main business challenges you're currently facing?
		</p>

		<!-- Quick Add Buttons -->
		<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
			{#each commonChallenges as challenge}
				{#if !primaryChallenges.includes(challenge)}
					<button
						type="button"
						onclick={() => addCommonChallenge(challenge)}
						{disabled}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						+ {challenge}
					</button>
				{/if}
			{/each}
		</div>

		<!-- Custom Input -->
		<div class="mb-3 flex space-x-2">
			<Input
				bind:value={newChallenge}
				onkeydown={handleChallengeKeydown}
				placeholder="Add a custom challenge"
				{disabled}
				class="flex-1"
			/>
			<Button variant="primary" onclick={addChallenge} disabled={disabled || !canAddChallenge}>
				<Plus class="mr-1 h-4 w-4" />
				Add
			</Button>
		</div>

		<!-- Selected Items -->
		{#if primaryChallenges.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each primaryChallenges as challenge}
					<span
						class="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
					>
						{challenge}
						<button
							type="button"
							onclick={() => removeChallenge(challenge)}
							{disabled}
							class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-red-400 hover:text-red-600 disabled:opacity-50"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Technical Issues -->
	<div>
		<label class="text-base-content mb-2 block text-sm font-medium">
			Technical Issues
			<span class="text-base-content/60 font-normal">(Optional)</span>
		</label>
		<p class="text-base-content/70 mb-3 text-sm">
			Are there any specific technical problems you're experiencing?
		</p>

		<!-- Quick Add Buttons -->
		<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
			{#each commonTechnicalIssues as issue}
				{#if !technicalIssues.includes(issue)}
					<button
						type="button"
						onclick={() => addCommonTechnicalIssue(issue)}
						{disabled}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						+ {issue}
					</button>
				{/if}
			{/each}
		</div>

		<!-- Custom Input -->
		<div class="mb-3 flex space-x-2">
			<Input
				bind:value={newTechnicalIssue}
				onkeydown={handleTechnicalIssueKeydown}
				placeholder="Add a technical issue"
				{disabled}
				class="flex-1"
			/>
			<Button
				variant="primary"
				onclick={addTechnicalIssue}
				disabled={disabled || !canAddTechnicalIssue}
			>
				<Plus class="mr-1 h-4 w-4" />
				Add
			</Button>
		</div>

		<!-- Selected Items -->
		{#if technicalIssues.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each technicalIssues as issue}
					<span
						class="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800"
					>
						{issue}
						<button
							type="button"
							onclick={() => removeTechnicalIssue(issue)}
							{disabled}
							class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-orange-400 hover:text-orange-600 disabled:opacity-50"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Urgency Level -->
	<div>
		<Select
			bind:value={urgencyLevel}
			onchange={handleFieldUpdate}
			label="Urgency Level"
			options={urgencyOptions}
			{disabled}
			required={true}
		/>
		{#if urgencyLevel}
			<div class="mt-2">
				<span
					class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getUrgencyColorClass(
						urgencyLevel,
					)}"
				>
					{urgencyLevel.toUpperCase()}: {urgencyOptions
						.find((o) => o.value === urgencyLevel)
						?.label.split(" - ")[1] || ""}
				</span>
			</div>
		{/if}
	</div>

	<!-- Impact Assessment -->
	<div>
		<Textarea
			bind:value={impactAssessment}
			onblur={handleFieldUpdate}
			label="Impact Assessment"
			placeholder="How are these challenges affecting your business? What's the cost of not addressing them?"
			rows={4}
			{disabled}
			error={impactAssessmentError}
		/>
		<p class="mt-1 text-sm text-gray-500">
			Describe the business impact of these challenges (e.g., lost revenue, reduced efficiency,
			customer dissatisfaction).
		</p>
	</div>

	<!-- Current Solution Gaps -->
	<div>
		<label class="text-base-content mb-2 block text-sm font-medium">
			Current Solution Gaps
			<span class="text-base-content/60 font-normal">(Optional)</span>
		</label>
		<p class="text-base-content/70 mb-3 text-sm">
			What's missing from your current solutions or systems?
		</p>

		<!-- Quick Add Buttons -->
		<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
			{#each commonSolutionGaps as gap}
				{#if !currentSolutionGaps.includes(gap)}
					<button
						type="button"
						onclick={() => addCommonSolutionGap(gap)}
						{disabled}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						+ {gap}
					</button>
				{/if}
			{/each}
		</div>

		<!-- Custom Input -->
		<div class="mb-3 flex space-x-2">
			<Input
				bind:value={newSolutionGap}
				onkeydown={handleSolutionGapKeydown}
				placeholder="Add a solution gap"
				{disabled}
				class="flex-1"
			/>
			<Button
				variant="primary"
				onclick={addSolutionGap}
				disabled={disabled || !canAddSolutionGap}
			>
				<Plus class="mr-1 h-4 w-4" />
				Add
			</Button>
		</div>

		<!-- Selected Items -->
		{#if currentSolutionGaps.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each currentSolutionGaps as gap}
					<span
						class="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800"
					>
						{gap}
						<button
							type="button"
							onclick={() => removeSolutionGap(gap)}
							{disabled}
							class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-purple-400 hover:text-purple-600 disabled:opacity-50"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Form Status Indicator -->
	<div class="flex items-center space-x-2 text-sm">
		{#if isFormValid}
			<CheckCircle class="h-5 w-5 text-green-500" />
			<span class="text-green-700">Pain points assessment is complete</span>
		{:else}
			<AlertTriangle class="h-5 w-5 text-yellow-500" />
			<span class="text-yellow-700">
				Please add at least one challenge and select urgency level
			</span>
		{/if}

		{#if consultationStore.formState.isAutoSaving}
			<div class="flex items-center space-x-1 text-blue-600">
				<Spinner size={16} />
				<span class="text-sm">Saving...</span>
			</div>
		{:else if consultationStore.formState.lastSaved}
			<span class="text-gray-500">
				Saved {consultationStore.formState.lastSaved.toLocaleTimeString()}
			</span>
		{/if}
	</div>
</div>

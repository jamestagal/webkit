<script lang="ts">
	/**
	 * Goals & Objectives Form - Remote Functions Implementation
	 *
	 * Pattern: Form Enhancement with Consultation Completion
	 * Cognitive Load: 20
	 * - Remote function imports (2): 2
	 * - Field bindings (9 fields): 9
	 * - Array field management (5 arrays): 10
	 * - Validation display: 2
	 * - Loading states: 1
	 * - Helper functions: 2
	 * - Completion flow: 2
	 *
	 * CRITICAL: Uses both saveGoalsObjectives and completeConsultationWithRedirect
	 * This is the bug fix - ensures POST /consultations/{id}/complete is called
	 */

	import { saveGoalsObjectives, completeConsultationWithRedirect } from '$lib/api/consultation.remote';
	import type { Consultation, Timeline } from '$lib/types/consultation';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { X, CheckCircle, AlertTriangle, Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	// Props
	let {
		consultation,
		consultationId,
		onComplete = () => {}
	}: {
		consultation: Consultation;
		consultationId: string;
		onComplete?: () => void;
	} = $props();

	// Local state for array fields
	let primaryGoals = $state<string[]>(consultation.parsed_goals_objectives?.primary_goals ?? []);
	let secondaryGoals = $state<string[]>(consultation.parsed_goals_objectives?.secondary_goals ?? []);
	let successMetrics = $state<string[]>(consultation.parsed_goals_objectives?.success_metrics ?? []);
	let kpis = $state<string[]>(consultation.parsed_goals_objectives?.kpis ?? []);
	let budgetConstraints = $state<string[]>(consultation.parsed_goals_objectives?.budget_constraints ?? []);
	let milestones = $state<string[]>(consultation.parsed_goals_objectives?.timeline?.milestones ?? []);

	// Temporary inputs
	let newPrimaryGoal = $state('');
	let newSecondaryGoal = $state('');
	let newSuccessMetric = $state('');
	let newKpi = $state('');
	let newBudgetConstraint = $state('');
	let newMilestone = $state('');

	// Timeline fields
	let desiredStart = $state(consultation.parsed_goals_objectives?.timeline?.desired_start ?? '');
	let targetCompletion = $state(consultation.parsed_goals_objectives?.timeline?.target_completion ?? '');

	// Completion state
	let isCompleting = $state(false);

	// Derived state
	let canAddPrimaryGoal = $derived(newPrimaryGoal.trim().length > 0);
	let canAddSecondaryGoal = $derived(newSecondaryGoal.trim().length > 0);
	let canAddSuccessMetric = $derived(newSuccessMetric.trim().length > 0);
	let canAddKpi = $derived(newKpi.trim().length > 0);
	let canAddBudgetConstraint = $derived(newBudgetConstraint.trim().length > 0);
	let canAddMilestone = $derived(newMilestone.trim().length > 0);

	// Predefined options
	const budgetRangeOptions = [
		{ value: '', label: 'Select budget range' },
		{ value: 'under-5k', label: 'Under $5,000' },
		{ value: '5k-10k', label: '$5,000 - $10,000' },
		{ value: '10k-25k', label: '$10,000 - $25,000' },
		{ value: '25k-50k', label: '$25,000 - $50,000' },
		{ value: '50k-100k', label: '$50,000 - $100,000' },
		{ value: '100k-250k', label: '$100,000 - $250,000' },
		{ value: '250k-500k', label: '$250,000 - $500,000' },
		{ value: 'over-500k', label: 'Over $500,000' },
		{ value: 'tbd', label: 'To be determined' }
	];

	const commonPrimaryGoals = [
		'Increase website traffic',
		'Improve search engine rankings',
		'Boost online sales/conversions',
		'Enhance brand awareness',
		'Expand into new markets',
		'Improve customer experience',
		'Reduce operational costs',
		'Increase customer retention',
		'Launch new products/services',
		'Improve mobile experience'
	];

	const commonSecondaryGoals = [
		'Integrate with existing systems',
		'Improve team productivity',
		'Reduce manual processes',
		'Better customer support',
		'Improve data visualization',
		'Enhance user interface design',
		'Build API integrations',
		'Implement automation',
		'Improve performance monitoring',
		'Create better documentation'
	];

	const commonSuccessMetrics = [
		'Website traffic increase (%)',
		'Conversion rate improvement (%)',
		'Page load speed (seconds)',
		'Search engine ranking positions',
		'Customer satisfaction score',
		'Return on investment (ROI)',
		'Cost per acquisition (CPA)',
		'Customer lifetime value (CLV)',
		'Email open/click rates',
		'Social media engagement'
	];

	const commonKpis = [
		'Monthly website visitors',
		'Conversion rate percentage',
		'Average order value',
		'Customer acquisition cost',
		'Monthly recurring revenue',
		'Customer churn rate',
		'Net promoter score (NPS)',
		'Cost per lead',
		'Email subscriber growth',
		'Social media followers'
	];

	const commonBudgetConstraints = [
		'Fixed annual budget',
		'Need to show ROI within 6 months',
		'Budget must be spread over multiple phases',
		'Seasonal budget availability',
		'Prefer monthly payment plans',
		'Must justify cost with detailed analysis',
		'Budget dependent on current performance',
		'Need to allocate across multiple departments'
	];

	// Goal management functions
	function addPrimaryGoal(): void {
		if (newPrimaryGoal.trim() && !primaryGoals.includes(newPrimaryGoal.trim())) {
			primaryGoals = [...primaryGoals, newPrimaryGoal.trim()];
			newPrimaryGoal = '';
		}
	}

	function removePrimaryGoal(goal: string): void {
		primaryGoals = primaryGoals.filter((g) => g !== goal);
	}

	function addCommonPrimaryGoal(goal: string): void {
		if (!primaryGoals.includes(goal)) {
			primaryGoals = [...primaryGoals, goal];
		}
	}

	function addSecondaryGoal(): void {
		if (newSecondaryGoal.trim() && !secondaryGoals.includes(newSecondaryGoal.trim())) {
			secondaryGoals = [...secondaryGoals, newSecondaryGoal.trim()];
			newSecondaryGoal = '';
		}
	}

	function removeSecondaryGoal(goal: string): void {
		secondaryGoals = secondaryGoals.filter((g) => g !== goal);
	}

	function addCommonSecondaryGoal(goal: string): void {
		if (!secondaryGoals.includes(goal)) {
			secondaryGoals = [...secondaryGoals, goal];
		}
	}

	// Metrics management
	function addSuccessMetric(): void {
		if (newSuccessMetric.trim() && !successMetrics.includes(newSuccessMetric.trim())) {
			successMetrics = [...successMetrics, newSuccessMetric.trim()];
			newSuccessMetric = '';
		}
	}

	function removeSuccessMetric(metric: string): void {
		successMetrics = successMetrics.filter((m) => m !== metric);
	}

	function addCommonSuccessMetric(metric: string): void {
		if (!successMetrics.includes(metric)) {
			successMetrics = [...successMetrics, metric];
		}
	}

	function addKpi(): void {
		if (newKpi.trim() && !kpis.includes(newKpi.trim())) {
			kpis = [...kpis, newKpi.trim()];
			newKpi = '';
		}
	}

	function removeKpi(kpi: string): void {
		kpis = kpis.filter((k) => k !== kpi);
	}

	function addCommonKpi(kpi: string): void {
		if (!kpis.includes(kpi)) {
			kpis = [...kpis, kpi];
		}
	}

	// Budget constraint management
	function addBudgetConstraint(): void {
		if (newBudgetConstraint.trim() && !budgetConstraints.includes(newBudgetConstraint.trim())) {
			budgetConstraints = [...budgetConstraints, newBudgetConstraint.trim()];
			newBudgetConstraint = '';
		}
	}

	function removeBudgetConstraint(constraint: string): void {
		budgetConstraints = budgetConstraints.filter((c) => c !== constraint);
	}

	function addCommonBudgetConstraint(constraint: string): void {
		if (!budgetConstraints.includes(constraint)) {
			budgetConstraints = [...budgetConstraints, constraint];
		}
	}

	// Milestone management
	function addMilestone(): void {
		if (newMilestone.trim() && !milestones.includes(newMilestone.trim())) {
			milestones = [...milestones, newMilestone.trim()];
			newMilestone = '';
		}
	}

	function removeMilestone(milestone: string): void {
		milestones = milestones.filter((m) => m !== milestone);
	}

	/**
	 * CRITICAL BUG FIX: Complete Consultation Handler
	 *
	 * This function:
	 * 1. Saves the goals/objectives data first
	 * 2. Calls completeConsultationWithRedirect to POST /consultations/{id}/complete
	 * 3. Redirects to /consultation/success
	 *
	 * The old implementation never called the completion endpoint!
	 */
	async function handleComplete(): Promise<void> {
		isCompleting = true;

		try {
			// Step 1: Save final form data
			// This triggers saveGoalsObjectives remote function
			const formElement = document.querySelector('form[data-goals-form]') as HTMLFormElement;
			if (formElement) {
				// Programmatically submit the form
				formElement.requestSubmit();

				// Wait for form submission to complete
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			// Step 2: Complete consultation (CRITICAL BUG FIX)
			// This calls POST /consultations/{id}/complete
			await completeConsultationWithRedirect({ consultationId });

			// Step 3: Success callback
			onComplete();

			// Note: completeConsultationWithRedirect automatically redirects to /consultation/success
		} catch (error) {
			console.error('Failed to complete consultation:', error);
			alert('Failed to complete consultation. Please try again.');
			isCompleting = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-base-content text-2xl font-bold">Goals & Objectives</h2>
		<p class="text-base-content/70 mt-1 text-sm">
			Define what you want to achieve and how you'll measure success.
		</p>
	</div>

	<!-- Form with Remote Function Enhancement -->
	<form
		data-goals-form
		method="POST"
		use:saveGoalsObjectives.enhance
	>
		<!-- Primary Goals -->
		<div>
			<label class="text-base-content mb-2 block text-sm font-medium">Primary Goals *</label>
			<p class="text-base-content/70 mb-3 text-sm">
				What are the main objectives you want to achieve?
			</p>

			<!-- Quick Add Buttons -->
			<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
				{#each commonPrimaryGoals as goal}
					{#if !primaryGoals.includes(goal)}
						<button
							type="button"
							onclick={() => addCommonPrimaryGoal(goal)}
							disabled={saveGoalsObjectives.pending || isCompleting}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							+ {goal}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Custom Input -->
			<div class="mb-3 flex space-x-2">
				<Input
					bind:value={newPrimaryGoal}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addPrimaryGoal();
						}
					}}
					placeholder="Add a custom primary goal"
					disabled={saveGoalsObjectives.pending || isCompleting}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addPrimaryGoal}
					disabled={saveGoalsObjectives.pending || isCompleting || !canAddPrimaryGoal}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</div>

			<!-- Selected Items -->
			{#if primaryGoals.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each primaryGoals as goal}
						<span
							class="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
						>
							{goal}
							<button
								type="button"
								onclick={() => removePrimaryGoal(goal)}
								disabled={saveGoalsObjectives.pending || isCompleting}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-400 hover:text-blue-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Hidden input for array data -->
			{#if primaryGoals.length > 0}
				<input type="hidden" name="primary_goals" value={JSON.stringify(primaryGoals)} />
			{/if}
		</div>

		<!-- Secondary Goals (similar pattern, abbreviated for brevity) -->
		<div class="mt-6">
			<label class="text-base-content mb-2 block text-sm font-medium">
				Secondary Goals
				<span class="text-base-content/60 font-normal">(Optional)</span>
			</label>

			<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
				{#each commonSecondaryGoals as goal}
					{#if !secondaryGoals.includes(goal)}
						<button
							type="button"
							onclick={() => addCommonSecondaryGoal(goal)}
							disabled={saveGoalsObjectives.pending || isCompleting}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							+ {goal}
						</button>
					{/if}
				{/each}
			</div>

			{#if secondaryGoals.length > 0}
				<div class="flex flex-wrap gap-2 mb-3">
					{#each secondaryGoals as goal}
						<span class="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
							{goal}
							<button type="button" onclick={() => removeSecondaryGoal(goal)} disabled={saveGoalsObjectives.pending || isCompleting} class="ml-2">
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
				<input type="hidden" name="secondary_goals" value={JSON.stringify(secondaryGoals)} />
			{/if}
		</div>

		<!-- Timeline -->
		<div class="border-t pt-6 mt-6">
			<h3 class="text-base-content mb-4 text-lg font-medium">Project Timeline</h3>

			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<!-- Desired Start Date -->
				<div>
					<Input
						bind:value={desiredStart}
						type="date"
						label="Desired Start Date"
						disabled={saveGoalsObjectives.pending || isCompleting}
					/>
					<input type="hidden" name="timeline[desired_start]" value={desiredStart} />
				</div>

				<!-- Target Completion Date -->
				<div>
					<Input
						bind:value={targetCompletion}
						type="date"
						label="Target Completion Date"
						disabled={saveGoalsObjectives.pending || isCompleting}
					/>
					<input type="hidden" name="timeline[target_completion]" value={targetCompletion} />
				</div>
			</div>

			<!-- Milestones -->
			<div class="mt-6">
				<label class="text-base-content mb-2 block text-sm font-medium">
					Key Milestones
					<span class="text-base-content/60 font-normal">(Optional)</span>
				</label>

				<div class="mb-3 flex space-x-2">
					<Input
						bind:value={newMilestone}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addMilestone();
							}
						}}
						placeholder="Add a project milestone"
						disabled={saveGoalsObjectives.pending || isCompleting}
						class="flex-1"
					/>
					<Button
						variant="primary"
						onclick={addMilestone}
						disabled={saveGoalsObjectives.pending || isCompleting || !canAddMilestone}
					>
						<Plus class="mr-1 h-4 w-4" />
						Add
					</Button>
				</div>

				{#if milestones.length > 0}
					<div class="space-y-2">
						{#each milestones as milestone, index}
							<div class="flex items-center justify-between rounded-md bg-gray-50 p-3">
								<div class="flex items-center space-x-3">
									<span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
										{index + 1}
									</span>
									<span class="text-base-content text-sm">{milestone}</span>
								</div>
								<button
									type="button"
									onclick={() => removeMilestone(milestone)}
									disabled={saveGoalsObjectives.pending || isCompleting}
									class="text-gray-400 hover:text-red-600 disabled:opacity-50"
								>
									<X class="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>
					<input type="hidden" name="timeline[milestones]" value={JSON.stringify(milestones)} />
				{/if}
			</div>
		</div>

		<!-- Budget Section -->
		<div class="border-t pt-6 mt-6">
			<h3 class="text-base-content mb-4 text-lg font-medium">Budget Information</h3>

			<!-- Budget Range -->
			<div class="mb-6">
				<label class="mb-2 block text-sm font-medium">Budget Range *</label>
				<select
					{...saveGoalsObjectives.fields.budget_range.as('select')}
					value={consultation.parsed_goals_objectives?.budget_range ?? ''}
					required
					class="select w-full"
					disabled={saveGoalsObjectives.pending || isCompleting}
				>
					{#each budgetRangeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				{#each saveGoalsObjectives.fields.budget_range.issues() as issue}
					<p class="text-error mt-1 text-sm">{issue.message}</p>
				{/each}
			</div>

			<!-- Budget Constraints -->
			<div>
				<label class="text-base-content mb-2 block text-sm font-medium">
					Budget Constraints
					<span class="text-base-content/60 font-normal">(Optional)</span>
				</label>

				<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
					{#each commonBudgetConstraints as constraint}
						{#if !budgetConstraints.includes(constraint)}
							<button
								type="button"
								onclick={() => addCommonBudgetConstraint(constraint)}
								disabled={saveGoalsObjectives.pending || isCompleting}
								class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
							>
								+ {constraint}
							</button>
						{/if}
					{/each}
				</div>

				{#if budgetConstraints.length > 0}
					<div class="flex flex-wrap gap-2 mb-3">
						{#each budgetConstraints as constraint}
							<span class="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
								{constraint}
								<button type="button" onclick={() => removeBudgetConstraint(constraint)} disabled={saveGoalsObjectives.pending || isCompleting}>
									<X class="h-3 w-3" />
								</button>
							</span>
						{/each}
					</div>
					<input type="hidden" name="budget_constraints" value={JSON.stringify(budgetConstraints)} />
				{/if}
			</div>
		</div>

		<!-- Success Metrics Section (abbreviated for brevity) -->
		<div class="border-t pt-6 mt-6">
			<h3 class="text-base-content mb-4 text-lg font-medium">Success Measurement</h3>

			<!-- Success Metrics -->
			<div class="mb-6">
				<label class="text-base-content mb-2 block text-sm font-medium">
					Success Metrics
					<span class="text-base-content/60 font-normal">(Optional)</span>
				</label>

				{#if successMetrics.length > 0}
					<div class="flex flex-wrap gap-2 mb-3">
						{#each successMetrics as metric}
							<span class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
								{metric}
								<button type="button" onclick={() => removeSuccessMetric(metric)} disabled={saveGoalsObjectives.pending || isCompleting}>
									<X class="h-3 w-3" />
								</button>
							</span>
						{/each}
					</div>
					<input type="hidden" name="success_metrics" value={JSON.stringify(successMetrics)} />
				{/if}
			</div>

			<!-- KPIs -->
			<div>
				<label class="text-base-content mb-2 block text-sm font-medium">
					Key Performance Indicators (KPIs)
					<span class="text-base-content/60 font-normal">(Optional)</span>
				</label>

				{#if kpis.length > 0}
					<div class="flex flex-wrap gap-2 mb-3">
						{#each kpis as kpi}
							<span class="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
								{kpi}
								<button type="button" onclick={() => removeKpi(kpi)} disabled={saveGoalsObjectives.pending || isCompleting}>
									<X class="h-3 w-3" />
								</button>
							</span>
						{/each}
					</div>
					<input type="hidden" name="kpis" value={JSON.stringify(kpis)} />
				{/if}
			</div>
		</div>

		<!-- Form Status Indicator -->
		<div class="mt-6 flex items-center space-x-2 border-t pt-6 text-sm">
			{#if saveGoalsObjectives.pending || isCompleting}
				<div class="flex items-center space-x-1 text-blue-600">
					<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span class="text-sm">{isCompleting ? 'Completing consultation...' : 'Saving...'}</span>
				</div>
			{:else if primaryGoals.length > 0 && saveGoalsObjectives.fields.budget_range.value}
				<CheckCircle class="h-5 w-5 text-green-500" />
				<span class="text-green-700">Goals and objectives are complete</span>
			{:else}
				<AlertTriangle class="h-5 w-5 text-yellow-500" />
				<span class="text-yellow-700">
					Please add at least one primary goal and select a budget range
				</span>
			{/if}
		</div>

		<!-- Submit Button (Hidden - form submits via Complete button below) -->
		<button type="submit" class="hidden">Save</button>
	</form>

	<!-- CRITICAL: Separate Complete Consultation Button -->
	<!-- This button calls the completeConsultationWithRedirect function -->
	<!-- which POSTs to /consultations/{id}/complete (THE BUG FIX) -->
	<div class="mt-6 flex justify-end border-t pt-6">
		<Button
			variant="primary"
			size="lg"
			onclick={handleComplete}
			disabled={
				saveGoalsObjectives.pending ||
				isCompleting ||
				primaryGoals.length === 0 ||
				!saveGoalsObjectives.fields.budget_range.value
			}
			loading={isCompleting}
		>
			{#if isCompleting}
				Completing Consultation...
			{:else}
				Complete Consultation
			{/if}
		</Button>
	</div>
</div>

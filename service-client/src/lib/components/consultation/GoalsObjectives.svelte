<script lang="ts">
	import type { GoalsObjectives, Timeline } from "$lib/types/consultation";
	import { consultationStore } from "$lib/stores/consultation.svelte";
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
		data: GoalsObjectives;
		errors?: string[];
		disabled?: boolean;
	} = $props();

	// Local form state with runes
	let primaryGoals = $state<string[]>(data.primary_goals || []);
	let secondaryGoals = $state<string[]>(data.secondary_goals || []);
	let successMetrics = $state<string[]>(data.success_metrics || []);
	let kpis = $state<string[]>(data.kpis || []);
	let budgetRange = $state(data.budget_range || "");
	let budgetConstraints = $state<string[]>(data.budget_constraints || []);
	let timeline = $state<Timeline>(data.timeline || {});

	// Temporary input values
	let newPrimaryGoal = $state("");
	let newSecondaryGoal = $state("");
	let newSuccessMetric = $state("");
	let newKpi = $state("");
	let newBudgetConstraint = $state("");

	// Timeline fields
	let desiredStart = $state(timeline.desired_start || "");
	let targetCompletion = $state(timeline.target_completion || "");
	let milestones = $state<string[]>(timeline.milestones || []);
	let newMilestone = $state("");


	// Derived state for button disabled logic (ensures reactivity)
	let canAddPrimaryGoal = $derived(newPrimaryGoal.trim().length > 0);
	let canAddSecondaryGoal = $derived(newSecondaryGoal.trim().length > 0);
	let canAddSuccessMetric = $derived(newSuccessMetric.trim().length > 0);
	let canAddKpi = $derived(newKpi.trim().length > 0);
	let canAddBudgetConstraint = $derived(newBudgetConstraint.trim().length > 0);
	let canAddMilestone = $derived(newMilestone.trim().length > 0);
	// Predefined options
	const budgetRangeOptions = [
		{ value: "", label: "Select budget range" },
		{ value: "under-5k", label: "Under $5,000" },
		{ value: "5k-10k", label: "$5,000 - $10,000" },
		{ value: "10k-25k", label: "$10,000 - $25,000" },
		{ value: "25k-50k", label: "$25,000 - $50,000" },
		{ value: "50k-100k", label: "$50,000 - $100,000" },
		{ value: "100k-250k", label: "$100,000 - $250,000" },
		{ value: "250k-500k", label: "$250,000 - $500,000" },
		{ value: "over-500k", label: "Over $500,000" },
		{ value: "tbd", label: "To be determined" },
	];

	const commonPrimaryGoals = [
		"Increase website traffic",
		"Improve search engine rankings",
		"Boost online sales/conversions",
		"Enhance brand awareness",
		"Expand into new markets",
		"Improve customer experience",
		"Reduce operational costs",
		"Increase customer retention",
		"Launch new products/services",
		"Improve mobile experience",
		"Build stronger online presence",
		"Streamline business processes",
		"Improve data analytics",
		"Enhance security and compliance",
		"Scale business operations",
	];

	const commonSecondaryGoals = [
		"Integrate with existing systems",
		"Improve team productivity",
		"Reduce manual processes",
		"Better customer support",
		"Improve data visualization",
		"Enhance user interface design",
		"Build API integrations",
		"Implement automation",
		"Improve performance monitoring",
		"Create better documentation",
		"Establish backup procedures",
		"Enhance accessibility",
		"Implement A/B testing",
		"Create training materials",
		"Establish maintenance processes",
	];

	const commonSuccessMetrics = [
		"Website traffic increase (%)",
		"Conversion rate improvement (%)",
		"Page load speed (seconds)",
		"Search engine ranking positions",
		"Customer satisfaction score",
		"Return on investment (ROI)",
		"Cost per acquisition (CPA)",
		"Customer lifetime value (CLV)",
		"Email open/click rates",
		"Social media engagement",
		"Lead generation numbers",
		"Time on site increase",
		"Bounce rate reduction",
		"Mobile traffic increase",
		"Brand mention/awareness metrics",
	];

	const commonKpis = [
		"Monthly website visitors",
		"Conversion rate percentage",
		"Average order value",
		"Customer acquisition cost",
		"Monthly recurring revenue",
		"Customer churn rate",
		"Net promoter score (NPS)",
		"Cost per lead",
		"Email subscriber growth",
		"Social media followers",
		"Organic search traffic",
		"Page views per session",
		"Cart abandonment rate",
		"Support ticket volume",
		"System uptime percentage",
	];

	const commonBudgetConstraints = [
		"Fixed annual budget",
		"Need to show ROI within 6 months",
		"Budget must be spread over multiple phases",
		"Seasonal budget availability",
		"Need approval for amounts over $X",
		"Prefer monthly payment plans",
		"Must justify cost with detailed analysis",
		"Budget dependent on current performance",
		"Need to allocate across multiple departments",
		"Require detailed cost breakdown",
		"Budget review required quarterly",
		"Must compare with other vendor quotes",
		"Need to reserve budget for maintenance",
		"Prefer performance-based pricing",
		"Budget contingent on business growth",
	];

	// Derived validation
	let isFormValid = $derived(() => {
		return primaryGoals.length > 0 && budgetRange.length > 0;
	});

	// Update parent data manually
	function updateParentData() {
		// Update timeline object
		timeline = {
			desired_start: desiredStart || undefined,
			target_completion: targetCompletion || undefined,
			milestones: milestones.length > 0 ? milestones : undefined,
		};

		data.primary_goals = primaryGoals.length > 0 ? primaryGoals : undefined;
		data.secondary_goals = secondaryGoals.length > 0 ? secondaryGoals : undefined;
		data.success_metrics = successMetrics.length > 0 ? successMetrics : undefined;
		data.kpis = kpis.length > 0 ? kpis : undefined;
		data.budget_range = budgetRange || undefined;
		data.budget_constraints = budgetConstraints.length > 0 ? budgetConstraints : undefined;
		data.timeline = Object.keys(timeline).length > 0 ? timeline : undefined;
	}

	// Call update on field changes
	function handleFieldUpdate() {
		updateParentData();
	}

	// Goal management functions
	function addPrimaryGoal(): void {
		if (newPrimaryGoal.trim() && !primaryGoals.includes(newPrimaryGoal.trim())) {
			primaryGoals = [...primaryGoals, newPrimaryGoal.trim()];
			newPrimaryGoal = "";
			handleFieldUpdate();
		}
	}

	function removePrimaryGoal(goal: string): void {
		primaryGoals = primaryGoals.filter((g) => g !== goal);
		handleFieldUpdate();
	}

	function addCommonPrimaryGoal(goal: string): void {
		if (!primaryGoals.includes(goal)) {
			primaryGoals = [...primaryGoals, goal];
			handleFieldUpdate();
		}
	}

	function addSecondaryGoal(): void {
		if (newSecondaryGoal.trim() && !secondaryGoals.includes(newSecondaryGoal.trim())) {
			secondaryGoals = [...secondaryGoals, newSecondaryGoal.trim()];
			newSecondaryGoal = "";
			handleFieldUpdate();
		}
	}

	function removeSecondaryGoal(goal: string): void {
		secondaryGoals = secondaryGoals.filter((g) => g !== goal);
		handleFieldUpdate();
	}

	function addCommonSecondaryGoal(goal: string): void {
		if (!secondaryGoals.includes(goal)) {
			secondaryGoals = [...secondaryGoals, goal];
			handleFieldUpdate();
		}
	}

	// Metrics management functions
	function addSuccessMetric(): void {
		if (newSuccessMetric.trim() && !successMetrics.includes(newSuccessMetric.trim())) {
			successMetrics = [...successMetrics, newSuccessMetric.trim()];
			newSuccessMetric = "";
			handleFieldUpdate();
		}
	}

	function removeSuccessMetric(metric: string): void {
		successMetrics = successMetrics.filter((m) => m !== metric);
		handleFieldUpdate();
	}

	function addCommonSuccessMetric(metric: string): void {
		if (!successMetrics.includes(metric)) {
			successMetrics = [...successMetrics, metric];
			handleFieldUpdate();
		}
	}

	function addKpi(): void {
		if (newKpi.trim() && !kpis.includes(newKpi.trim())) {
			kpis = [...kpis, newKpi.trim()];
			newKpi = "";
			handleFieldUpdate();
		}
	}

	function removeKpi(kpi: string): void {
		kpis = kpis.filter((k) => k !== kpi);
		handleFieldUpdate();
	}

	function addCommonKpi(kpi: string): void {
		if (!kpis.includes(kpi)) {
			kpis = [...kpis, kpi];
			handleFieldUpdate();
		}
	}

	// Budget constraint management
	function addBudgetConstraint(): void {
		if (newBudgetConstraint.trim() && !budgetConstraints.includes(newBudgetConstraint.trim())) {
			budgetConstraints = [...budgetConstraints, newBudgetConstraint.trim()];
			newBudgetConstraint = "";
			handleFieldUpdate();
		}
	}

	function removeBudgetConstraint(constraint: string): void {
		budgetConstraints = budgetConstraints.filter((c) => c !== constraint);
		handleFieldUpdate();
	}

	function addCommonBudgetConstraint(constraint: string): void {
		if (!budgetConstraints.includes(constraint)) {
			budgetConstraints = [...budgetConstraints, constraint];
			handleFieldUpdate();
		}
	}

	// Milestone management
	function addMilestone(): void {
		if (newMilestone.trim() && !milestones.includes(newMilestone.trim())) {
			milestones = [...milestones, newMilestone.trim()];
			newMilestone = "";
			handleFieldUpdate();
		}
	}

	function removeMilestone(milestone: string): void {
		milestones = milestones.filter((m) => m !== milestone);
		handleFieldUpdate();
	}

	// Keyboard event handlers
	function handlePrimaryGoalKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addPrimaryGoal();
		}
	}

	function handleSecondaryGoalKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addSecondaryGoal();
		}
	}

	function handleSuccessMetricKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addSuccessMetric();
		}
	}

	function handleKpiKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addKpi();
		}
	}

	function handleBudgetConstraintKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addBudgetConstraint();
		}
	}

	function handleMilestoneKeydown(event: KeyboardEvent): void {
		if (event.key === "Enter") {
			event.preventDefault();
			addMilestone();
		}
	}

	// Date validation
	function formatDateForInput(dateString: string): string {
		if (!dateString) return "";
		const date = new Date(dateString);
		return date.toISOString().split("T")[0];
	}

	function parseDateFromInput(dateString: string): string {
		if (!dateString) return "";
		return new Date(dateString).toISOString();
	}

	// Date change handlers
	function handleDesiredStartChange(e: Event): void {
		const target = e.target as HTMLInputElement;
		desiredStart = parseDateFromInput(target.value);
		handleFieldUpdate();
	}

	function handleTargetCompletionChange(e: Event): void {
		const target = e.target as HTMLInputElement;
		targetCompletion = parseDateFromInput(target.value);
		handleFieldUpdate();
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
						{disabled}
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
				onkeydown={handlePrimaryGoalKeydown}
				placeholder="Add a custom primary goal"
				{disabled}
				class="flex-1"
			/>
			<Button
				variant="primary"
				onclick={addPrimaryGoal}
				disabled={disabled || !canAddPrimaryGoal}
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
							{disabled}
							class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-400 hover:text-blue-600 disabled:opacity-50"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Secondary Goals -->
	<div>
		<label class="text-base-content mb-2 block text-sm font-medium">
			Secondary Goals
			<span class="text-base-content/60 font-normal">(Optional)</span>
		</label>
		<p class="text-base-content/70 mb-3 text-sm">
			Additional objectives that would be nice to achieve.
		</p>

		<!-- Quick Add Buttons -->
		<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
			{#each commonSecondaryGoals as goal}
				{#if !secondaryGoals.includes(goal)}
					<button
						type="button"
						onclick={() => addCommonSecondaryGoal(goal)}
						{disabled}
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
				bind:value={newSecondaryGoal}
				onkeydown={handleSecondaryGoalKeydown}
				placeholder="Add a secondary goal"
				{disabled}
				class="flex-1"
			/>
			<Button
				variant="primary"
				onclick={addSecondaryGoal}
				disabled={disabled || !canAddSecondaryGoal}
			>
				<Plus class="mr-1 h-4 w-4" />
				Add
			</Button>
		</div>

		<!-- Selected Items -->
		{#if secondaryGoals.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each secondaryGoals as goal}
					<span
						class="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800"
					>
						{goal}
						<button
							type="button"
							onclick={() => removeSecondaryGoal(goal)}
							{disabled}
							class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-indigo-400 hover:text-indigo-600 disabled:opacity-50"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Timeline -->
	<div class="border-t pt-6">
		<h3 class="text-base-content mb-4 text-lg font-medium">Project Timeline</h3>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
			<!-- Desired Start Date -->
			<div>
				<Input
					value={formatDateForInput(desiredStart)}
					oninput={handleDesiredStartChange}
					type="date"
					label="Desired Start Date"
					{disabled}
				/>
			</div>

			<!-- Target Completion Date -->
			<div>
				<Input
					value={formatDateForInput(targetCompletion)}
					oninput={handleTargetCompletionChange}
					type="date"
					label="Target Completion Date"
					{disabled}
				/>
			</div>
		</div>

		<!-- Milestones -->
		<div class="mt-6">
			<label class="text-base-content mb-2 block text-sm font-medium">
				Key Milestones
				<span class="text-base-content/60 font-normal">(Optional)</span>
			</label>
			<p class="text-base-content/70 mb-3 text-sm">
				Important checkpoints or deliverables throughout the project.
			</p>

			<!-- Add Milestone -->
			<div class="mb-3 flex space-x-2">
				<Input
					bind:value={newMilestone}
					onkeydown={handleMilestoneKeydown}
					placeholder="Add a project milestone"
					{disabled}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addMilestone}
					disabled={disabled || !canAddMilestone}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</div>

			<!-- Selected Milestones -->
			{#if milestones.length > 0}
				<div class="space-y-2">
					{#each milestones as milestone, index}
						<div class="flex items-center justify-between rounded-md bg-gray-50 p-3">
							<div class="flex items-center space-x-3">
								<span
									class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600"
								>
									{index + 1}
								</span>
								<span class="text-base-content text-sm">{milestone}</span>
							</div>
							<button
								type="button"
								onclick={() => removeMilestone(milestone)}
								{disabled}
								class="text-gray-400 hover:text-red-600 disabled:opacity-50"
							>
								<X class="h-4 w-4" />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Budget Section -->
	<div class="border-t pt-6">
		<h3 class="text-base-content mb-4 text-lg font-medium">Budget Information</h3>

		<!-- Budget Range -->
		<div class="mb-6">
			<Select
				bind:value={budgetRange}
				onchange={handleFieldUpdate}
				label="Budget Range"
				options={budgetRangeOptions}
				{disabled}
				required={true}
			/>
		</div>

		<!-- Budget Constraints -->
		<div>
			<label class="text-base-content mb-2 block text-sm font-medium">
				Budget Constraints
				<span class="text-base-content/60 font-normal">(Optional)</span>
			</label>
			<p class="text-base-content/70 mb-3 text-sm">
				Any specific requirements or limitations regarding budget and payments.
			</p>

			<!-- Quick Add Buttons -->
			<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
				{#each commonBudgetConstraints as constraint}
					{#if !budgetConstraints.includes(constraint)}
						<button
							type="button"
							onclick={() => addCommonBudgetConstraint(constraint)}
							{disabled}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							+ {constraint}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Custom Input -->
			<div class="mb-3 flex space-x-2">
				<Input
					bind:value={newBudgetConstraint}
					onkeydown={handleBudgetConstraintKeydown}
					placeholder="Add a budget constraint"
					{disabled}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addBudgetConstraint}
					disabled={disabled || !canAddBudgetConstraint}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</div>

			<!-- Selected Items -->
			{#if budgetConstraints.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each budgetConstraints as constraint}
						<span
							class="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800"
						>
							{constraint}
							<button
								type="button"
								onclick={() => removeBudgetConstraint(constraint)}
								{disabled}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-yellow-400 hover:text-yellow-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Success Metrics Section -->
	<div class="border-t pt-6">
		<h3 class="text-base-content mb-4 text-lg font-medium">Success Measurement</h3>

		<!-- Success Metrics -->
		<div class="mb-6">
			<label class="text-base-content mb-2 block text-sm font-medium">
				Success Metrics
				<span class="text-base-content/60 font-normal">(Optional)</span>
			</label>
			<p class="text-base-content/70 mb-3 text-sm">
				How will you measure the success of this project?
			</p>

			<!-- Quick Add Buttons -->
			<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
				{#each commonSuccessMetrics as metric}
					{#if !successMetrics.includes(metric)}
						<button
							type="button"
							onclick={() => addCommonSuccessMetric(metric)}
							{disabled}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							+ {metric}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Custom Input -->
			<div class="mb-3 flex space-x-2">
				<Input
					bind:value={newSuccessMetric}
					onkeydown={handleSuccessMetricKeydown}
					placeholder="Add a success metric"
					{disabled}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addSuccessMetric}
					disabled={disabled || !canAddSuccessMetric}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</div>

			<!-- Selected Items -->
			{#if successMetrics.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each successMetrics as metric}
						<span
							class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
						>
							{metric}
							<button
								type="button"
								onclick={() => removeSuccessMetric(metric)}
								{disabled}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-green-400 hover:text-green-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- KPIs -->
		<div>
			<label class="text-base-content mb-2 block text-sm font-medium">
				Key Performance Indicators (KPIs)
				<span class="text-base-content/60 font-normal">(Optional)</span>
			</label>
			<p class="text-base-content/70 mb-3 text-sm">
				Specific metrics you'll track regularly to monitor progress.
			</p>

			<!-- Quick Add Buttons -->
			<div class="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
				{#each commonKpis as kpi}
					{#if !kpis.includes(kpi)}
						<button
							type="button"
							onclick={() => addCommonKpi(kpi)}
							{disabled}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm leading-4 font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							+ {kpi}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Custom Input -->
			<div class="mb-3 flex space-x-2">
				<Input
					bind:value={newKpi}
					onkeydown={handleKpiKeydown}
					placeholder="Add a KPI"
					{disabled}
					class="flex-1"
				/>
				<Button variant="primary" onclick={addKpi} disabled={disabled || !canAddKpi}>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</div>

			<!-- Selected Items -->
			{#if kpis.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each kpis as kpi}
						<span
							class="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800"
						>
							{kpi}
							<button
								type="button"
								onclick={() => removeKpi(kpi)}
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
	</div>

	<!-- Form Status Indicator -->
	<div class="flex items-center space-x-2 border-t pt-6 text-sm">
		{#if isFormValid}
			<CheckCircle class="h-5 w-5 text-green-500" />
			<span class="text-green-700">Goals and objectives are complete</span>
		{:else}
			<AlertTriangle class="h-5 w-5 text-yellow-500" />
			<span class="text-yellow-700">
				Please add at least one primary goal and select a budget range
			</span>
		{/if}

		{#if consultationStore.formState.isAutoSaving}
			<div class="flex items-center space-x-1 text-blue-600">
				<Spinner size={16} />
				<span class="text-sm">Saving...</span>
			</div>
		{:else if consultationStore.formState.lastSaved}
			<span class="text-base-content/60">
				Saved {consultationStore.formState.lastSaved.toLocaleTimeString()}
			</span>
		{/if}
	</div>
</div>

<script lang="ts">
	/**
	 * Pain Points Form - Remote Functions Implementation
	 *
	 * Pattern: Form Enhancement with SvelteKit Remote Functions
	 * Cognitive Load: 16
	 * - Remote function import: 1
	 * - Field bindings (5 fields): 5
	 * - Array field management (3 arrays): 6
	 * - Validation display: 2
	 * - Loading states: 1
	 * - Helper functions: 1
	 *
	 * Uses savePainPoints remote function with automatic validation
	 */

	import { savePainPoints } from '$lib/api/consultation.remote';
	import type { Consultation, UrgencyLevel } from '$lib/types/consultation';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { X, CheckCircle, AlertTriangle, Plus } from 'lucide-svelte';

	// Props
	let {
		consultation,
		onNext = () => {}
	}: {
		consultation: Consultation;
		onNext?: () => void;
	} = $props();

	// Local state for array fields
	let primaryChallenges = $state<string[]>(consultation.parsed_pain_points?.primary_challenges ?? []);
	let technicalIssues = $state<string[]>(consultation.parsed_pain_points?.technical_issues ?? []);
	let currentSolutionGaps = $state<string[]>(consultation.parsed_pain_points?.current_solution_gaps ?? []);

	// Temporary inputs
	let newChallenge = $state('');
	let newTechnicalIssue = $state('');
	let newSolutionGap = $state('');

	// Derived state
	let canAddChallenge = $derived(newChallenge.trim().length > 0);
	let canAddTechnicalIssue = $derived(newTechnicalIssue.trim().length > 0);
	let canAddSolutionGap = $derived(newSolutionGap.trim().length > 0);

	// Predefined options
	const urgencyOptions = [
		{ value: '', label: 'Select urgency level' },
		{ value: 'low', label: 'Low - Can wait several months' },
		{ value: 'medium', label: 'Medium - Needed within 2-3 months' },
		{ value: 'high', label: 'High - Needed within 4-6 weeks' },
		{ value: 'critical', label: 'Critical - Needed immediately' }
	];

	const commonChallenges = [
		'Low website traffic',
		'Poor search engine rankings',
		'Outdated website design',
		'Slow website performance',
		'Low conversion rates',
		'Lack of mobile optimization',
		'Poor user experience',
		'Limited online presence',
		'Ineffective marketing campaigns',
		'High customer acquisition costs'
	];

	const commonTechnicalIssues = [
		'Website crashes frequently',
		'Slow loading times',
		'Database performance issues',
		'SSL certificate problems',
		'Email delivery issues',
		'Payment processing failures',
		'Form submission errors',
		'Mobile compatibility issues',
		'Browser compatibility problems',
		'Security vulnerabilities'
	];

	const commonSolutionGaps = [
		'Lack of CRM integration',
		'No email marketing automation',
		'Missing analytics tracking',
		'No A/B testing capabilities',
		'Limited SEO tools',
		'No social media integration',
		'Missing e-commerce features',
		'No customer support chat',
		'Limited reporting capabilities',
		'No backup solutions'
	];

	// Challenge management
	function addChallenge(): void {
		if (newChallenge.trim() && !primaryChallenges.includes(newChallenge.trim())) {
			primaryChallenges = [...primaryChallenges, newChallenge.trim()];
			newChallenge = '';
		}
	}

	function removeChallenge(challenge: string): void {
		primaryChallenges = primaryChallenges.filter((c) => c !== challenge);
	}

	function addCommonChallenge(challenge: string): void {
		if (!primaryChallenges.includes(challenge)) {
			primaryChallenges = [...primaryChallenges, challenge];
		}
	}

	// Technical issues management
	function addTechnicalIssue(): void {
		if (newTechnicalIssue.trim() && !technicalIssues.includes(newTechnicalIssue.trim())) {
			technicalIssues = [...technicalIssues, newTechnicalIssue.trim()];
			newTechnicalIssue = '';
		}
	}

	function removeTechnicalIssue(issue: string): void {
		technicalIssues = technicalIssues.filter((i) => i !== issue);
	}

	function addCommonTechnicalIssue(issue: string): void {
		if (!technicalIssues.includes(issue)) {
			technicalIssues = [...technicalIssues, issue];
		}
	}

	// Solution gaps management
	function addSolutionGap(): void {
		if (newSolutionGap.trim() && !currentSolutionGaps.includes(newSolutionGap.trim())) {
			currentSolutionGaps = [...currentSolutionGaps, newSolutionGap.trim()];
			newSolutionGap = '';
		}
	}

	function removeSolutionGap(gap: string): void {
		currentSolutionGaps = currentSolutionGaps.filter((g) => g !== gap);
	}

	function addCommonSolutionGap(gap: string): void {
		if (!currentSolutionGaps.includes(gap)) {
			currentSolutionGaps = [...currentSolutionGaps, gap];
		}
	}

	// Helper function for urgency color
	function getUrgencyColorClass(level: string | undefined): string {
		switch (level) {
			case 'low':
				return 'text-green-700 bg-green-100';
			case 'medium':
				return 'text-yellow-700 bg-yellow-100';
			case 'high':
				return 'text-orange-700 bg-orange-100';
			case 'critical':
				return 'text-red-700 bg-red-100';
			default:
				return 'text-gray-700 bg-gray-100';
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

	<!-- Form with Remote Function Enhancement -->
	<form
		method="POST"
		use:savePainPoints.enhance
		onsubmit={() => {
			// After successful submission (when not pending), move to next step
			setTimeout(() => {
				if (!savePainPoints.pending) {
					onNext();
				}
			}, 100);
		}}
	>
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
							disabled={savePainPoints.pending}
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
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addChallenge();
						}
					}}
					placeholder="Add a custom challenge"
					disabled={savePainPoints.pending}
					class="flex-1"
				/>
				<Button variant="primary" onclick={addChallenge} disabled={savePainPoints.pending || !canAddChallenge}>
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
								disabled={savePainPoints.pending}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-red-400 hover:text-red-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Hidden input for array data -->
			{#if primaryChallenges.length > 0}
				<input
					type="hidden"
					name="primary_challenges"
					value={JSON.stringify(primaryChallenges)}
				/>
			{/if}
		</div>

		<!-- Technical Issues -->
		<div class="mt-6">
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
							disabled={savePainPoints.pending}
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
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addTechnicalIssue();
						}
					}}
					placeholder="Add a technical issue"
					disabled={savePainPoints.pending}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addTechnicalIssue}
					disabled={savePainPoints.pending || !canAddTechnicalIssue}
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
								disabled={savePainPoints.pending}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-orange-400 hover:text-orange-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Hidden input for array data -->
			{#if technicalIssues.length > 0}
				<input
					type="hidden"
					name="technical_issues"
					value={JSON.stringify(technicalIssues)}
				/>
			{/if}
		</div>

		<!-- Urgency Level -->
		<div class="mt-6">
			<label class="mb-2 block text-sm font-medium">Urgency Level *</label>
			<select
				{...savePainPoints.fields.urgency_level.as('select')}
				value={consultation.parsed_pain_points?.urgency_level ?? ''}
				required
				class="select w-full"
				disabled={savePainPoints.pending}
			>
				{#each urgencyOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			{#each savePainPoints.fields.urgency_level.issues() as issue}
				<p class="text-error mt-1 text-sm">{issue.message}</p>
			{/each}

			{#if savePainPoints.fields.urgency_level.value}
				<div class="mt-2">
					<span
						class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getUrgencyColorClass(
							savePainPoints.fields.urgency_level.value
						)}"
					>
						{savePainPoints.fields.urgency_level.value.toUpperCase()}:
						{urgencyOptions
							.find((o) => o.value === savePainPoints.fields.urgency_level.value)
							?.label.split(' - ')[1] || ''}
					</span>
				</div>
			{/if}
		</div>

		<!-- Impact Assessment -->
		<div class="mt-6">
			<label class="floating-label">
				<span>Impact Assessment</span>
				<textarea
					{...savePainPoints.fields.impact_assessment.as('textarea')}
					value={consultation.parsed_pain_points?.impact_assessment ?? ''}
					placeholder="How are these challenges affecting your business? What's the cost of not addressing them?"
					rows={4}
					class="textarea w-full"
					disabled={savePainPoints.pending}
				></textarea>
			</label>
			{#each savePainPoints.fields.impact_assessment.issues() as issue}
				<p class="text-error mt-1 text-sm">{issue.message}</p>
			{/each}
			<p class="mt-1 text-sm text-gray-500">
				Describe the business impact of these challenges (e.g., lost revenue, reduced efficiency,
				customer dissatisfaction).
			</p>
		</div>

		<!-- Current Solution Gaps -->
		<div class="mt-6">
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
							disabled={savePainPoints.pending}
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
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							addSolutionGap();
						}
					}}
					placeholder="Add a solution gap"
					disabled={savePainPoints.pending}
					class="flex-1"
				/>
				<Button
					variant="primary"
					onclick={addSolutionGap}
					disabled={savePainPoints.pending || !canAddSolutionGap}
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
								disabled={savePainPoints.pending}
								class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-purple-400 hover:text-purple-600 disabled:opacity-50"
							>
								<X class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Hidden input for array data -->
			{#if currentSolutionGaps.length > 0}
				<input
					type="hidden"
					name="current_solution_gaps"
					value={JSON.stringify(currentSolutionGaps)}
				/>
			{/if}
		</div>

		<!-- Form Status Indicator -->
		<div class="mt-6 flex items-center space-x-2 text-sm">
			{#if savePainPoints.pending}
				<div class="flex items-center space-x-1 text-blue-600">
					<svg
						class="h-5 w-5 animate-spin"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span class="text-sm">Saving...</span>
				</div>
			{:else if primaryChallenges.length > 0 && savePainPoints.fields.urgency_level.value}
				<CheckCircle class="h-5 w-5 text-green-500" />
				<span class="text-green-700">Pain points assessment is complete</span>
			{:else}
				<AlertTriangle class="h-5 w-5 text-yellow-500" />
				<span class="text-yellow-700">
					Please add at least one challenge and select urgency level
				</span>
			{/if}
		</div>

		<!-- Submit Button (Hidden) -->
		<button type="submit" class="hidden">Save & Continue</button>
	</form>
</div>

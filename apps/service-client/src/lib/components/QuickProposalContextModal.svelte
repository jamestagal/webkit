<script lang="ts">
	/**
	 * QuickProposalContextModal — Phase A doctype-coupling-relaxation
	 *
	 * Captures the three fields validateContext() requires (industry, primary
	 * challenges, primary goals) directly on a proposal, without forcing the
	 * user back into a Consultation flow. Triggered when generateProposalWithAI
	 * throws AIErrorCode.CONTEXT_INSUFFICIENT.
	 *
	 * Cancel returns to the existing AIErrorDisplay surface so the
	 * "Edit Consultation" affordance stays reachable. Modal is purely additive.
	 */
	import { untrack } from 'svelte';
	import {
		INDUSTRY_OPTIONS,
		PRIMARY_CHALLENGES_OPTIONS,
		PRIMARY_GOALS_OPTIONS
	} from '$lib/config/consultation-options';

	interface Props {
		open: boolean;
		linkedConsultationId?: string | null;
		initialIndustry?: string | null;
		initialChallenges?: string[];
		initialGoals?: string[];
		onSubmit: (data: {
			industry: string;
			primaryChallenges: string[];
			primaryGoals: string[];
		}) => Promise<void>;
		onCancel: () => void;
		onLinkToConsultation?: () => void;
	}

	let {
		open,
		linkedConsultationId = null,
		initialIndustry = null,
		initialChallenges = [],
		initialGoals = [],
		onSubmit,
		onCancel,
		onLinkToConsultation
	}: Props = $props();

	// Industry: dropdown + free-text fallback when "Other".
	// Initial reads of props are intentional one-shot snapshots — wrap in
	// untrack() per the project's svelte5 reactivity convention to silence
	// state_referenced_locally warnings (see commit b80b237).
	const initialIndustryOption = untrack(() =>
		INDUSTRY_OPTIONS.find((o) => o.label === initialIndustry)
	);
	let industrySelect = $state(
		untrack(() =>
			initialIndustryOption
				? initialIndustryOption.value
				: initialIndustry
					? 'other'
					: ''
		)
	);
	let industryCustom = $state(
		untrack(() => (initialIndustryOption ? '' : initialIndustry || ''))
	);

	let challenges = $state<string[]>(untrack(() => [...initialChallenges]));
	let challengeCustom = $state('');

	let goals = $state<string[]>(untrack(() => [...initialGoals]));
	let goalCustom = $state('');

	let submitting = $state(false);

	const resolvedIndustry = $derived(
		industrySelect === 'other'
			? industryCustom.trim()
			: INDUSTRY_OPTIONS.find((o) => o.value === industrySelect)?.label || ''
	);

	const isValid = $derived(
		resolvedIndustry.length > 0 && challenges.length > 0 && goals.length > 0
	);

	function toggleChallenge(label: string) {
		const idx = challenges.indexOf(label);
		if (idx === -1) challenges.push(label);
		else challenges.splice(idx, 1);
	}

	function addChallengeCustom() {
		const value = challengeCustom.trim();
		if (!value) return;
		if (!challenges.includes(value)) challenges.push(value);
		challengeCustom = '';
	}

	function removeChallenge(label: string) {
		const idx = challenges.indexOf(label);
		if (idx !== -1) challenges.splice(idx, 1);
	}

	function toggleGoal(label: string) {
		const idx = goals.indexOf(label);
		if (idx === -1) goals.push(label);
		else goals.splice(idx, 1);
	}

	function addGoalCustom() {
		const value = goalCustom.trim();
		if (!value) return;
		if (!goals.includes(value)) goals.push(value);
		goalCustom = '';
	}

	function removeGoal(label: string) {
		const idx = goals.indexOf(label);
		if (idx !== -1) goals.splice(idx, 1);
	}

	async function handleSubmit() {
		if (!isValid || submitting) return;
		submitting = true;
		try {
			await onSubmit({
				industry: resolvedIndustry,
				primaryChallenges: [...challenges],
				primaryGoals: [...goals]
			});
		} finally {
			submitting = false;
		}
	}

	function handleCancel() {
		if (submitting) return;
		onCancel();
	}
</script>

{#if open}
	<div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="quick-context-title">
		<div class="modal-box max-w-2xl">
			<h3 id="quick-context-title" class="text-lg font-bold">Quick proposal context</h3>
			<p class="text-sm text-base-content/70 mt-1">
				For full discovery,
				{#if onLinkToConsultation}
					<button
						type="button"
						class="link link-primary"
						onclick={onLinkToConsultation}
						disabled={submitting}>start a Consultation</button
					>
				{:else}
					start a Consultation
				{/if}
				— these three fields are the minimum for AI generation.
			</p>

			<!-- Industry -->
			<div class="form-control mt-4">
				<label class="label" for="quick-context-industry">
					<span class="label-text font-semibold">Industry</span>
				</label>
				<select
					id="quick-context-industry"
					class="select select-bordered w-full"
					bind:value={industrySelect}
					disabled={submitting}
				>
					<option value="" disabled>Select an industry…</option>
					{#each INDUSTRY_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				{#if industrySelect === 'other'}
					<input
						type="text"
						class="input input-bordered w-full mt-2"
						placeholder="Type the industry…"
						bind:value={industryCustom}
						disabled={submitting}
					/>
				{/if}
			</div>

			<!-- Primary Challenges -->
			<div class="form-control mt-4">
				<div class="label">
					<span class="label-text font-semibold">Primary Challenges</span>
					<span class="label-text-alt text-base-content/60">
						{challenges.length} selected
					</span>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each PRIMARY_CHALLENGES_OPTIONS as opt (opt.value)}
						{@const selected = challenges.includes(opt.label)}
						<button
							type="button"
							class="badge badge-lg cursor-pointer {selected
								? 'badge-primary'
								: 'badge-outline'}"
							onclick={() => toggleChallenge(opt.label)}
							disabled={submitting}
						>
							{opt.label}
						</button>
					{/each}
				</div>
				{#if challenges.some((c) => !PRIMARY_CHALLENGES_OPTIONS.find((o) => o.label === c))}
					<div class="flex flex-wrap gap-2 mt-2">
						{#each challenges.filter((c) => !PRIMARY_CHALLENGES_OPTIONS.find((o) => o.label === c)) as custom (custom)}
							<span class="badge badge-lg badge-secondary gap-1">
								{custom}
								<button
									type="button"
									class="text-xs opacity-70 hover:opacity-100"
									onclick={() => removeChallenge(custom)}
									aria-label="Remove"
									disabled={submitting}>×</button
								>
							</span>
						{/each}
					</div>
				{/if}
				<div class="flex gap-2 mt-2">
					<input
						type="text"
						class="input input-bordered input-sm flex-1"
						placeholder="Add a custom challenge…"
						bind:value={challengeCustom}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addChallengeCustom();
							}
						}}
						disabled={submitting}
					/>
					<button
						type="button"
						class="btn btn-sm"
						onclick={addChallengeCustom}
						disabled={submitting || !challengeCustom.trim()}>Add</button
					>
				</div>
			</div>

			<!-- Primary Goals -->
			<div class="form-control mt-4">
				<div class="label">
					<span class="label-text font-semibold">Primary Goals</span>
					<span class="label-text-alt text-base-content/60">
						{goals.length} selected
					</span>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each PRIMARY_GOALS_OPTIONS as opt (opt.value)}
						{@const selected = goals.includes(opt.label)}
						<button
							type="button"
							class="badge badge-lg cursor-pointer {selected
								? 'badge-primary'
								: 'badge-outline'}"
							onclick={() => toggleGoal(opt.label)}
							disabled={submitting}
						>
							{opt.label}
						</button>
					{/each}
				</div>
				{#if goals.some((g) => !PRIMARY_GOALS_OPTIONS.find((o) => o.label === g))}
					<div class="flex flex-wrap gap-2 mt-2">
						{#each goals.filter((g) => !PRIMARY_GOALS_OPTIONS.find((o) => o.label === g)) as custom (custom)}
							<span class="badge badge-lg badge-secondary gap-1">
								{custom}
								<button
									type="button"
									class="text-xs opacity-70 hover:opacity-100"
									onclick={() => removeGoal(custom)}
									aria-label="Remove"
									disabled={submitting}>×</button
								>
							</span>
						{/each}
					</div>
				{/if}
				<div class="flex gap-2 mt-2">
					<input
						type="text"
						class="input input-bordered input-sm flex-1"
						placeholder="Add a custom goal…"
						bind:value={goalCustom}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addGoalCustom();
							}
						}}
						disabled={submitting}
					/>
					<button
						type="button"
						class="btn btn-sm"
						onclick={addGoalCustom}
						disabled={submitting || !goalCustom.trim()}>Add</button
					>
				</div>
			</div>

			{#if linkedConsultationId}
				<p class="text-xs text-base-content/60 mt-3">
					This proposal is linked to a Consultation. Saving here overrides the
					linked consultation's values for AI generation only.
				</p>
			{/if}

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={handleCancel}
					disabled={submitting}>Cancel</button
				>
				<button
					type="button"
					class="btn btn-primary"
					onclick={handleSubmit}
					disabled={!isValid || submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Generate Proposal
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop"
			onclick={handleCancel}
			aria-label="Close"
			disabled={submitting}
		></button>
	</div>
{/if}

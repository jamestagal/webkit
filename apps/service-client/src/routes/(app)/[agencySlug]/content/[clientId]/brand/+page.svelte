<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from "$app/state";
	import { invalidateAll } from "$app/navigation";
	import {
		Brain,
		Pencil,
		RefreshCw,
		Save,
		X,
		Plus,
		Trash2,
		Loader2,
		Sparkles,
	} from "lucide-svelte";
	import {
		getBrandProfile,
		generateBrandProfile,
		updateBrandProfile,
	} from "$lib/api/content-brand.remote";
	import type { BrandProfile, BrandProfileResponse } from "$lib/api/content-brand.types";
	import { formatDate } from "$lib/utils/formatting";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let clientId = $derived(page.params.clientId!);
	let agencySlug = $derived(page.params.agencySlug);
	let upgradeHref = $derived(`/${agencySlug}/settings/billing`);

	// SvelteKit's error() throws HttpError (not Error), so `err instanceof Error`
	// is false. Read status + body.message directly to surface quota messages
	// and flag limit-reached states so the upgrade CTA can render.
	function classifyError(err: unknown, fallback: string): {
		message: string;
		isLimit: boolean;
	} {
		const status = (err as { status?: number } | null)?.status;
		let message = fallback;
		if (err && typeof err === "object" && "body" in err) {
			const body = (err as { body?: { message?: string } }).body;
			if (body?.message) message = body.message;
		} else if (err instanceof Error && err.message) {
			message = err.message;
		}
		const isLimit =
			status === 429 ||
			(status === 403 && /limit|not available|upgrade/i.test(message));
		return { message, isLimit };
	}

	// Local mutable copy of brand data so we can update it from polling.
	// Initial snapshot via untrack(); $effect below keeps it in sync with server.
	let brand = $state<BrandProfileResponse | null>(untrack(() => data.brand));

	// Sync when server data changes (e.g. invalidateAll)
	$effect(() => {
		brand = data.brand;
	});

	// Generation state
	let isGenerating = $state(false);
	let generateError = $state("");
	let generateAtLimit = $state(false);
	let previousGeneratedAt = $state<string | null | undefined>(null);

	// Edit state
	let isEditing = $state(false);
	let isSaving = $state(false);

	// Edit mode helpers for array <-> text
	let editPersonality = $state("");
	let editToneDefault = $state("");
	let editTonePromotional = $state("");
	let editToneEducational = $state("");
	let editFormality = $state("");
	let editJargon = $state("");
	let editAvoided = $state("");
	let editSignature = $state("");
	let editAvgLength = $state("");
	let editActivePassive = $state("");
	let editContractions = $state(false);
	let editPillars = $state<Array<{ theme: string; evidence: string }>>([]);
	let editAlways = $state("");
	let editNever = $state("");
	let editDifferentiators = $state("");
	let editNorms = $state("");
	let editGaps = $state("");

	function arrayToText(arr: string[]): string {
		return arr.join(", ");
	}

	function textToArray(text: string): string[] {
		return text
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}

	function startEditing() {
		if (!brand) return;
		const p = brand.profile;
		editPersonality = arrayToText(p.personality_traits);
		editToneDefault = p.tone_guidelines.default;
		editTonePromotional = p.tone_guidelines.promotional;
		editToneEducational = p.tone_guidelines.educational;
		editFormality = p.vocabulary.formality_level;
		editJargon = arrayToText(p.vocabulary.industry_jargon);
		editAvoided = arrayToText(p.vocabulary.avoided_terms);
		editSignature = arrayToText(p.vocabulary.signature_phrases);
		editAvgLength = p.sentence_structure.avg_length;
		editActivePassive = p.sentence_structure.active_passive;
		editContractions = p.sentence_structure.uses_contractions;
		editPillars = p.messaging_pillars.map((mp) => ({ ...mp }));
		editAlways = arrayToText(p.constraints.always);
		editNever = arrayToText(p.constraints.never);
		editDifferentiators = arrayToText(p.competitive_positioning.differentiators);
		editNorms = arrayToText(p.competitive_positioning.industry_norms);
		editGaps = arrayToText(p.competitive_positioning.gaps_to_fill);
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
	}

	function addPillar() {
		editPillars = [...editPillars, { theme: "", evidence: "" }];
	}

	function removePillar(index: number) {
		editPillars = editPillars.filter((_, i) => i !== index);
	}

	async function handleSave() {
		if (!brand) return;
		isSaving = true;
		try {
			const updatedProfile: BrandProfile = {
				personality_traits: textToArray(editPersonality),
				tone_guidelines: {
					default: editToneDefault,
					promotional: editTonePromotional,
					educational: editToneEducational,
				},
				vocabulary: {
					formality_level: editFormality,
					industry_jargon: textToArray(editJargon),
					avoided_terms: textToArray(editAvoided),
					signature_phrases: textToArray(editSignature),
				},
				sentence_structure: {
					avg_length: editAvgLength,
					active_passive: editActivePassive,
					uses_contractions: editContractions,
				},
				messaging_pillars: editPillars.filter((p) => p.theme.trim()),
				constraints: {
					always: textToArray(editAlways),
					never: textToArray(editNever),
				},
				competitive_positioning: {
					differentiators: textToArray(editDifferentiators),
					industry_norms: textToArray(editNorms),
					gaps_to_fill: textToArray(editGaps),
				},
			};
			await updateBrandProfile({ clientId, profile: updatedProfile });
			isEditing = false;
			await invalidateAll();
		} catch (e) {
			console.error("Failed to save brand profile:", e);
		} finally {
			isSaving = false;
		}
	}

	async function handleGenerate() {
		previousGeneratedAt = brand?.generated_at ?? null;
		isGenerating = true;
		generateError = "";
		generateAtLimit = false;
		try {
			await generateBrandProfile(clientId);
		} catch (e) {
			const { message, isLimit } = classifyError(e, "Failed to start brand generation. Please try again.");
			generateError = message;
			generateAtLimit = isLimit;
			isGenerating = false;
			console.error("Failed to start brand generation:", e);
		}
	}

	// Polling effect for generation
	$effect(() => {
		if (!isGenerating) return;

		const interval = setInterval(async () => {
			try {
				const result = await getBrandProfile(clientId);
				if (result && result.generated_at !== previousGeneratedAt) {
					isGenerating = false;
					brand = result;
					clearInterval(interval);
				}
			} catch {
				// keep polling - profile may not exist yet
			}
		}, 3000);

		return () => clearInterval(interval);
	});

	function sourceTypeBadge(type: string): string {
		switch (type) {
			case "scrape":
				return "badge-info";
			case "manual":
				return "badge-warning";
			case "hybrid":
				return "badge-accent";
			default:
				return "badge-ghost";
		}
	}
</script>

{#if isGenerating}
	<!-- State 2: Generating / Polling -->
	<div class="flex flex-col items-center justify-center py-20">
		<div class="flex h-20 w-20 items-center justify-center rounded-full bg-base-200 mb-6">
			<span class="loading loading-spinner loading-lg text-primary"></span>
		</div>
		<h2 class="text-xl font-semibold mb-2">Generating Brand Profile...</h2>
		<p class="text-base-content/60 text-center max-w-md">
			Analyzing crawled content to build a comprehensive brand voice profile. This typically
			takes 30-60 seconds.
		</p>
		<progress class="progress progress-primary w-64 mt-6"></progress>
	</div>
{:else if !brand}
	<!-- State 1: No profile -->
	<div class="flex flex-col items-center justify-center py-20">
		<div class="flex h-20 w-20 items-center justify-center rounded-full bg-base-200 mb-6">
			<Brain class="h-10 w-10 text-base-content/30" />
		</div>
		<h2 class="text-xl font-semibold mb-2">No Brand Profile</h2>
		<p class="text-base-content/60 text-center max-w-md mb-6">
			Generate a brand voice profile from your client's crawled website content. The profile
			analyzes personality, tone, vocabulary, and messaging to ensure consistent content
			creation.
		</p>
		<button type="button" class="btn btn-primary" onclick={handleGenerate}>
			<Sparkles class="h-4 w-4" />
			Generate Brand Profile
		</button>
		{#if generateError}
			<div class="mt-4 w-full max-w-md">
				<div class="alert alert-error">
					<span>{generateError}</span>
				</div>
				{#if generateAtLimit}
					<a href={upgradeHref} class="btn btn-sm btn-primary mt-2">
						Upgrade plan →
					</a>
				{/if}
			</div>
		{/if}
	</div>
{:else}
	<!-- State 3: Profile loaded -->
	<div class="space-y-6">
		<!-- Header row: source info + actions -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div class="flex flex-wrap items-center gap-2">
				<span class="badge {sourceTypeBadge(brand.source_type)} badge-sm capitalize">
					{brand.source_type}
				</span>
				<span class="text-sm text-base-content/60">
					{brand.source_page_count} page{brand.source_page_count !== 1 ? "s" : ""} analyzed
				</span>
				{#if brand.generated_at}
					<span class="text-sm text-base-content/40">
						Generated {formatDate(brand.generated_at, "medium")}
					</span>
				{/if}
				<span class="text-sm text-base-content/40">v{brand.version}</span>
			</div>
			<div class="flex items-center gap-2">
				{#if isEditing}
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={cancelEditing}
						disabled={isSaving}
					>
						<X class="h-4 w-4" />
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={handleSave}
						disabled={isSaving}
					>
						{#if isSaving}
							<Loader2 class="h-4 w-4 animate-spin" />
							Saving...
						{:else}
							<Save class="h-4 w-4" />
							Save
						{/if}
					</button>
				{:else}
					<button type="button" class="btn btn-ghost btn-sm" onclick={startEditing}>
						<Pencil class="h-4 w-4" />
						Edit
					</button>
					<button type="button" class="btn btn-outline btn-sm" onclick={handleGenerate}>
						<RefreshCw class="h-4 w-4" />
						Regenerate
					</button>
				{/if}
			</div>
		</div>

		<!-- Cards Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Personality Traits -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-base">Personality Traits</h3>
					{#if isEditing}
						<textarea
							class="textarea textarea-bordered w-full"
							rows="3"
							placeholder="Professional, Approachable, Innovative..."
							bind:value={editPersonality}
						></textarea>
						<p class="text-xs text-base-content/50">Comma-separated traits</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each brand.profile.personality_traits as trait}
								<span class="badge badge-outline">{trait}</span>
							{/each}
							{#if brand.profile.personality_traits.length === 0}
								<span class="text-base-content/40 text-sm italic">No traits defined</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Tone Guidelines -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-base">Tone Guidelines</h3>
					{#if isEditing}
						<div class="space-y-3">
							<div class="form-control">
								<label class="label py-1" for="tone-default">
									<span class="label-text text-sm">Default</span>
								</label>
								<textarea
									id="tone-default"
									class="textarea textarea-bordered w-full text-sm"
									rows="2"
									bind:value={editToneDefault}
								></textarea>
							</div>
							<div class="form-control">
								<label class="label py-1" for="tone-promo">
									<span class="label-text text-sm">Promotional</span>
								</label>
								<textarea
									id="tone-promo"
									class="textarea textarea-bordered w-full text-sm"
									rows="2"
									bind:value={editTonePromotional}
								></textarea>
							</div>
							<div class="form-control">
								<label class="label py-1" for="tone-edu">
									<span class="label-text text-sm">Educational</span>
								</label>
								<textarea
									id="tone-edu"
									class="textarea textarea-bordered w-full text-sm"
									rows="2"
									bind:value={editToneEducational}
								></textarea>
							</div>
						</div>
					{:else}
						<div class="space-y-3">
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-1">Default</div>
								<div class="bg-base-200 rounded p-3 text-sm">
									{brand.profile.tone_guidelines.default || "Not set"}
								</div>
							</div>
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-1">Promotional</div>
								<div class="bg-base-200 rounded p-3 text-sm">
									{brand.profile.tone_guidelines.promotional || "Not set"}
								</div>
							</div>
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-1">Educational</div>
								<div class="bg-base-200 rounded p-3 text-sm">
									{brand.profile.tone_guidelines.educational || "Not set"}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Vocabulary -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-base">Vocabulary</h3>
					{#if isEditing}
						<div class="space-y-3">
							<div class="form-control">
								<label class="label py-1" for="formality">
									<span class="label-text text-sm">Formality Level</span>
								</label>
								<input
									id="formality"
									type="text"
									class="input input-bordered input-sm w-full"
									bind:value={editFormality}
									placeholder="e.g. Semi-formal"
								/>
							</div>
							<div class="form-control">
								<label class="label py-1" for="jargon">
									<span class="label-text text-sm">Industry Jargon</span>
								</label>
								<textarea
									id="jargon"
									class="textarea textarea-bordered w-full text-sm"
									rows="2"
									bind:value={editJargon}
									placeholder="SEO, ROI, CTR..."
								></textarea>
							</div>
							<div class="form-control">
								<label class="label py-1" for="avoided">
									<span class="label-text text-sm">Avoided Terms</span>
								</label>
								<textarea
									id="avoided"
									class="textarea textarea-bordered w-full text-sm"
									rows="2"
									bind:value={editAvoided}
									placeholder="Cheap, Guarantee..."
								></textarea>
							</div>
							<div class="form-control">
								<label class="label py-1" for="signature">
									<span class="label-text text-sm">Signature Phrases</span>
								</label>
								<textarea
									id="signature"
									class="textarea textarea-bordered w-full text-sm"
									rows="2"
									bind:value={editSignature}
									placeholder="Elevate your brand..."
								></textarea>
							</div>
						</div>
					{:else}
						<div class="space-y-3">
							<div class="flex items-center gap-2">
								<span class="text-xs font-medium text-base-content/60">Formality:</span>
								<span class="badge badge-primary badge-sm">
									{brand.profile.vocabulary.formality_level || "Not set"}
								</span>
							</div>
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-1.5">
									Industry Jargon
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each brand.profile.vocabulary.industry_jargon as term}
										<span class="badge badge-info badge-sm">{term}</span>
									{/each}
									{#if brand.profile.vocabulary.industry_jargon.length === 0}
										<span class="text-base-content/40 text-sm italic">None</span>
									{/if}
								</div>
							</div>
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-1.5">
									Avoided Terms
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each brand.profile.vocabulary.avoided_terms as term}
										<span class="badge badge-error badge-outline badge-sm">{term}</span>
									{/each}
									{#if brand.profile.vocabulary.avoided_terms.length === 0}
										<span class="text-base-content/40 text-sm italic">None</span>
									{/if}
								</div>
							</div>
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-1.5">
									Signature Phrases
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each brand.profile.vocabulary.signature_phrases as phrase}
										<span class="badge badge-accent badge-sm">{phrase}</span>
									{/each}
									{#if brand.profile.vocabulary.signature_phrases.length === 0}
										<span class="text-base-content/40 text-sm italic">None</span>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Sentence Structure -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-base">Sentence Structure</h3>
					{#if isEditing}
						<div class="space-y-3">
							<div class="form-control">
								<label class="label py-1" for="avg-length">
									<span class="label-text text-sm">Average Length</span>
								</label>
								<input
									id="avg-length"
									type="text"
									class="input input-bordered input-sm w-full"
									bind:value={editAvgLength}
									placeholder="e.g. Medium (15-20 words)"
								/>
							</div>
							<div class="form-control">
								<label class="label py-1" for="active-passive">
									<span class="label-text text-sm">Active/Passive Ratio</span>
								</label>
								<input
									id="active-passive"
									type="text"
									class="input input-bordered input-sm w-full"
									bind:value={editActivePassive}
									placeholder="e.g. 80/20 active"
								/>
							</div>
							<div class="form-control">
								<label class="label cursor-pointer justify-start gap-3">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										bind:checked={editContractions}
									/>
									<span class="label-text text-sm">Uses Contractions</span>
								</label>
							</div>
						</div>
					{:else}
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<span class="text-sm text-base-content/70">Avg. Length</span>
								<span class="text-sm font-medium">
									{brand.profile.sentence_structure.avg_length || "Not set"}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-base-content/70">Active/Passive</span>
								<span class="text-sm font-medium">
									{brand.profile.sentence_structure.active_passive || "Not set"}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-base-content/70">Contractions</span>
								{#if brand.profile.sentence_structure.uses_contractions}
									<span class="badge badge-success badge-sm">Yes</span>
								{:else}
									<span class="badge badge-ghost badge-sm">No</span>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Messaging Pillars -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-base">Messaging Pillars</h3>
					{#if isEditing}
						<div class="space-y-3">
							{#each editPillars as pillar, i}
								<div class="flex gap-2 items-start">
									<div class="flex-1 space-y-1">
										<input
											type="text"
											class="input input-bordered input-sm w-full"
											placeholder="Theme"
											bind:value={pillar.theme}
										/>
										<input
											type="text"
											class="input input-bordered input-sm w-full"
											placeholder="Evidence / supporting detail"
											bind:value={pillar.evidence}
										/>
									</div>
									<button
										type="button"
										class="btn btn-ghost btn-sm btn-square mt-1"
										onclick={() => removePillar(i)}
									>
										<Trash2 class="h-4 w-4 text-error" />
									</button>
								</div>
							{/each}
							<button type="button" class="btn btn-ghost btn-sm" onclick={addPillar}>
								<Plus class="h-4 w-4" />
								Add Pillar
							</button>
						</div>
					{:else}
						<div class="space-y-3">
							{#each brand.profile.messaging_pillars as pillar}
								<div>
									<div class="font-medium text-sm">{pillar.theme}</div>
									<div class="text-sm text-base-content/60 mt-0.5">
										{pillar.evidence}
									</div>
								</div>
							{/each}
							{#if brand.profile.messaging_pillars.length === 0}
								<span class="text-base-content/40 text-sm italic">
									No pillars defined
								</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Constraints -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-base">Constraints</h3>
					{#if isEditing}
						<div class="space-y-3">
							<div class="form-control">
								<label class="label py-1" for="always">
									<span class="label-text text-sm">Always</span>
								</label>
								<textarea
									id="always"
									class="textarea textarea-bordered w-full text-sm"
									rows="3"
									bind:value={editAlways}
									placeholder="Use active voice, Include data..."
								></textarea>
							</div>
							<div class="form-control">
								<label class="label py-1" for="never">
									<span class="label-text text-sm">Never</span>
								</label>
								<textarea
									id="never"
									class="textarea textarea-bordered w-full text-sm"
									rows="3"
									bind:value={editNever}
									placeholder="Use jargon without explanation, Make unsubstantiated claims..."
								></textarea>
							</div>
							<p class="text-xs text-base-content/50">Comma-separated items</p>
						</div>
					{:else}
						<div class="space-y-3">
							<div>
								<div class="text-xs font-medium text-success mb-1.5">Always</div>
								<ul class="space-y-1">
									{#each brand.profile.constraints.always as item}
										<li class="flex items-start gap-2 text-sm">
											<span class="text-success mt-1 shrink-0">&#x2022;</span>
											{item}
										</li>
									{/each}
									{#if brand.profile.constraints.always.length === 0}
										<li class="text-base-content/40 text-sm italic">None defined</li>
									{/if}
								</ul>
							</div>
							<div>
								<div class="text-xs font-medium text-error mb-1.5">Never</div>
								<ul class="space-y-1">
									{#each brand.profile.constraints.never as item}
										<li class="flex items-start gap-2 text-sm">
											<span class="text-error mt-1 shrink-0">&#x2022;</span>
											{item}
										</li>
									{/each}
									{#if brand.profile.constraints.never.length === 0}
										<li class="text-base-content/40 text-sm italic">None defined</li>
									{/if}
								</ul>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Competitive Positioning -->
			<div class="card bg-base-100 border border-base-300 lg:col-span-2">
				<div class="card-body">
					<h3 class="card-title text-base">Competitive Positioning</h3>
					{#if isEditing}
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div class="form-control">
								<label class="label py-1" for="differentiators">
									<span class="label-text text-sm">Differentiators</span>
								</label>
								<textarea
									id="differentiators"
									class="textarea textarea-bordered w-full text-sm"
									rows="4"
									bind:value={editDifferentiators}
									placeholder="What sets the brand apart..."
								></textarea>
							</div>
							<div class="form-control">
								<label class="label py-1" for="norms">
									<span class="label-text text-sm">Industry Norms</span>
								</label>
								<textarea
									id="norms"
									class="textarea textarea-bordered w-full text-sm"
									rows="4"
									bind:value={editNorms}
									placeholder="Common industry practices..."
								></textarea>
							</div>
							<div class="form-control">
								<label class="label py-1" for="gaps">
									<span class="label-text text-sm">Gaps to Fill</span>
								</label>
								<textarea
									id="gaps"
									class="textarea textarea-bordered w-full text-sm"
									rows="4"
									bind:value={editGaps}
									placeholder="Opportunities to explore..."
								></textarea>
							</div>
						</div>
						<p class="text-xs text-base-content/50 mt-1">Comma-separated items</p>
					{:else}
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-2">
									Differentiators
								</div>
								<ul class="space-y-1">
									{#each brand.profile.competitive_positioning.differentiators as item}
										<li class="flex items-start gap-2 text-sm">
											<span class="text-primary mt-1 shrink-0">&#x2022;</span>
											{item}
										</li>
									{/each}
									{#if brand.profile.competitive_positioning.differentiators.length === 0}
										<li class="text-base-content/40 text-sm italic">None</li>
									{/if}
								</ul>
							</div>
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-2">
									Industry Norms
								</div>
								<ul class="space-y-1">
									{#each brand.profile.competitive_positioning.industry_norms as item}
										<li class="flex items-start gap-2 text-sm">
											<span class="text-base-content/40 mt-1 shrink-0">&#x2022;</span>
											{item}
										</li>
									{/each}
									{#if brand.profile.competitive_positioning.industry_norms.length === 0}
										<li class="text-base-content/40 text-sm italic">None</li>
									{/if}
								</ul>
							</div>
							<div>
								<div class="text-xs font-medium text-base-content/60 mb-2">
									Gaps to Fill
								</div>
								<ul class="space-y-1">
									{#each brand.profile.competitive_positioning.gaps_to_fill as item}
										<li class="flex items-start gap-2 text-sm">
											<span class="text-warning mt-1 shrink-0">&#x2022;</span>
											{item}
										</li>
									{/each}
									{#if brand.profile.competitive_positioning.gaps_to_fill.length === 0}
										<li class="text-base-content/40 text-sm italic">None</li>
									{/if}
								</ul>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

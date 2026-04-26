<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { ArrowLeft, Sparkles, Copy, ExternalLink } from "lucide-svelte";
	import { SOCIAL_PLATFORMS, POST_GOALS } from "$lib/api/content-social.types";
	import { generateSocial } from "$lib/api/content-social.remote";
	import type { SocialGenerateResult } from "$lib/api/content-social.types";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);
	let upgradeHref = $derived(`/${agencySlug}/settings/billing`);

	function formatPlatform(p: string): string {
		return p.charAt(0).toUpperCase() + p.slice(1);
	}

	// SvelteKit's error() throws HttpError (not Error), so `err instanceof Error`
	// is false. Read status + body.message directly to surface the real message
	// and flag quota-reached states so the upgrade CTA can render.
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

	// Form state
	let platform = $state("");
	let topic = $state("");
	let postGoal = $state("");
	let toneOverride = $state("");
	let selectedPageId = $state("");
	let isGenerating = $state(false);
	let generateError = $state("");
	let generateAtLimit = $state(false);
	let result: SocialGenerateResult | null = $state(null);

	// Clipboard feedback
	let copiedId = $state("");

	async function handleGenerate() {
		if (!platform || !topic) return;

		isGenerating = true;
		generateError = "";
		generateAtLimit = false;
		result = null;
		try {
			result = await generateSocial({
				clientId: data.clientId,
				platform,
				topic,
				postGoal: postGoal || undefined,
				toneOverride: toneOverride || undefined,
				pageId: selectedPageId || undefined,
			});
		} catch (err: unknown) {
			const { message, isLimit } = classifyError(err, "Failed to generate social posts. Please try again.");
			generateError = message;
			generateAtLimit = isLimit;
		} finally {
			isGenerating = false;
		}
	}

	async function copyToClipboard(text: string, id: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => {
			copiedId = "";
		}, 2000);
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Back link -->
	<a href="/{agencySlug}/content/{clientId}/social" class="btn btn-ghost btn-sm gap-1">
		<ArrowLeft class="h-4 w-4" />
		Back to Social
	</a>

	<!-- Generate Social Card -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-primary" />
				Generate Social Posts
			</h2>
			<p class="text-sm text-base-content/60">
				Use AI to generate platform-optimised social media posts for your client.
			</p>

			{#if generateError}
				<div class="mt-4">
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

			<div class="space-y-4 mt-4">
				<!-- Platform -->
				<div class="form-control">
					<label class="label" for="platform-select">
						<span class="label-text font-medium">Platform <span class="text-error">*</span></span>
					</label>
					<select
						id="platform-select"
						class="select select-bordered w-full"
						bind:value={platform}
						disabled={isGenerating}
					>
						<option value="" disabled>Select a platform...</option>
						{#each SOCIAL_PLATFORMS as p}
							<option value={p}>{formatPlatform(p)}</option>
						{/each}
					</select>
				</div>

				<!-- Topic -->
				<div class="form-control">
					<label class="label" for="topic-input">
						<span class="label-text font-medium">Topic <span class="text-error">*</span></span>
					</label>
					<input
						id="topic-input"
						type="text"
						class="input input-bordered w-full"
						placeholder="e.g. New website launch, seasonal sale, industry tips"
						bind:value={topic}
						disabled={isGenerating}
					/>
				</div>

				<!-- Post Goal -->
				<div class="form-control">
					<label class="label" for="goal-select">
						<span class="label-text font-medium">Post Goal</span>
						<span class="label-text-alt">Optional</span>
					</label>
					<select
						id="goal-select"
						class="select select-bordered w-full"
						bind:value={postGoal}
						disabled={isGenerating}
					>
						<option value="">No specific goal</option>
						{#each POST_GOALS as g}
							<option value={g}>{formatPlatform(g)}</option>
						{/each}
					</select>
				</div>

				<!-- Tone Override -->
				<div class="form-control">
					<label class="label" for="tone-input">
						<span class="label-text font-medium">Tone Override</span>
						<span class="label-text-alt">Optional</span>
					</label>
					<input
						id="tone-input"
						type="text"
						class="input input-bordered w-full"
						placeholder="e.g. casual, professional, witty"
						bind:value={toneOverride}
						disabled={isGenerating}
					/>
				</div>

				<!-- Page Context -->
				{#if data.pages.length > 0}
					<div class="form-control">
						<label class="label" for="page-context-select">
							<span class="label-text font-medium">Page Context</span>
							<span class="label-text-alt">Optional</span>
						</label>
						<select
							id="page-context-select"
							class="select select-bordered w-full"
							bind:value={selectedPageId}
							disabled={isGenerating}
						>
							<option value="">No page context</option>
							{#each data.pages as p}
								<option value={p.id}>{p.title || p.url}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Submit -->
				<button
					type="button"
					class="btn btn-primary w-full"
					onclick={handleGenerate}
					disabled={isGenerating || !platform || !topic}
				>
					{#if isGenerating}
						<span class="loading loading-spinner loading-sm"></span>
						Generating...
					{:else}
						<Sparkles class="h-4 w-4" />
						Generate
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Results -->
	{#if result}
		<div class="space-y-4">
			<h3 class="text-lg font-semibold">
				Generated {result.variations.length} Variations
				<span class="text-sm font-normal text-base-content/50">
					for {formatPlatform(result.platform)}
				</span>
			</h3>

			{#each result.variations as variation (variation.copy_id)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<!-- Angle badge -->
						<div class="flex items-center justify-between">
							<span class="badge badge-outline">{variation.angle}</span>
							<span class="text-xs text-base-content/50">{variation.character_count} chars</span>
						</div>

						<!-- Post content -->
						<div class="bg-base-200 rounded-lg p-4 mt-2">
							<p class="text-sm whitespace-pre-wrap">{variation.post}</p>
						</div>

						<!-- Hashtags -->
						{#if variation.hashtags.length > 0}
							<div class="flex flex-wrap gap-1 mt-2">
								{#each variation.hashtags as tag}
									<span class="badge badge-sm badge-outline">{tag}</span>
								{/each}
							</div>
						{/if}

						<!-- Actions -->
						<div class="flex items-center gap-2 mt-3">
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => copyToClipboard(variation.post, variation.copy_id)}
							>
								<Copy class="h-4 w-4" />
								{copiedId === variation.copy_id ? "Copied!" : "Copy"}
							</button>
							<button
								type="button"
								class="btn btn-outline btn-sm"
								onclick={() => goto(`/${agencySlug}/content/${clientId}/social/${variation.copy_id}`)}
							>
								<ExternalLink class="h-4 w-4" />
								View & Edit
							</button>
						</div>
					</div>
				</div>
			{/each}

			<!-- Token usage -->
			<div class="text-xs text-base-content/40 text-center">
				Model: {result.model_used} | Tokens: {result.prompt_tokens}p + {result.completion_tokens}c
			</div>
		</div>
	{/if}
</div>

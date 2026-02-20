<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { ArrowLeft, Sparkles, Tag } from "lucide-svelte";
	import { COPY_TYPES } from "$lib/api/content-copy.types";
	import { generateCopy, generateMeta } from "$lib/api/content-copy.remote";
	import type { MetaResult } from "$lib/api/content-copy.types";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	// Page-dependent copy types
	const PAGE_REQUIRED_TYPES = ["page_rewrite", "meta_title", "meta_description", "h1_suggestion"];

	function formatCopyType(type: string): string {
		return type
			.split("_")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
	}

	// -- Generate Copy form state --
	let copyType = $state("");
	let targetKeyword = $state("");
	let targetWordCount = $state<number | undefined>(undefined);
	let notes = $state("");
	let selectedPageId = $state("");
	let isGenerating = $state(false);
	let generateError = $state("");

	let showPagePicker = $derived(PAGE_REQUIRED_TYPES.includes(copyType));

	async function handleGenerateCopy() {
		if (!copyType) return;
		if (showPagePicker && !selectedPageId) {
			generateError = "Please select a page for this copy type.";
			return;
		}

		isGenerating = true;
		generateError = "";
		try {
			const result = await generateCopy({
				clientId: data.clientId,
				pageId: selectedPageId || undefined,
				copyType,
				targetKeyword: targetKeyword || undefined,
				targetWordCount: targetWordCount || undefined,
				notes: notes || undefined,
			});
			await goto(`/${agencySlug}/content/${data.clientId}/copy/${result.copy_id}`);
		} catch (err: unknown) {
			generateError = err instanceof Error ? err.message : "Failed to generate copy. Please try again.";
		} finally {
			isGenerating = false;
		}
	}

	// -- Generate Meta form state --
	let metaPageId = $state("");
	let metaKeyword = $state("");
	let isGeneratingMeta = $state(false);
	let metaError = $state("");
	let metaResult: MetaResult | null = $state(null);

	async function handleGenerateMeta() {
		if (!metaPageId) {
			metaError = "Please select a page.";
			return;
		}

		isGeneratingMeta = true;
		metaError = "";
		metaResult = null;
		try {
			metaResult = await generateMeta({
				clientId: data.clientId,
				pageId: metaPageId,
				targetKeyword: metaKeyword || undefined,
			});
		} catch (err: unknown) {
			metaError = err instanceof Error ? err.message : "Failed to generate meta tags. Please try again.";
		} finally {
			isGeneratingMeta = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Back link -->
	<a href="/{agencySlug}/content/{clientId}/copy" class="btn btn-ghost btn-sm gap-1">
		<ArrowLeft class="h-4 w-4" />
		Back to Copy
	</a>

	<!-- Generate Copy Card -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-primary" />
				Generate Copy
			</h2>
			<p class="text-sm text-base-content/60">
				Use AI to generate brand-consistent copy for your client's website.
			</p>

			{#if generateError}
				<div class="alert alert-error mt-4">
					<span>{generateError}</span>
				</div>
			{/if}

			<div class="space-y-4 mt-4">
				<!-- Copy Type -->
				<div class="form-control">
					<label class="label" for="copy-type">
						<span class="label-text font-medium">Copy Type <span class="text-error">*</span></span>
					</label>
					<select
						id="copy-type"
						class="select select-bordered w-full"
						bind:value={copyType}
						disabled={isGenerating}
					>
						<option value="" disabled>Select a copy type...</option>
						{#each COPY_TYPES as ct}
							<option value={ct}>{formatCopyType(ct)}</option>
						{/each}
					</select>
				</div>

				<!-- Page Picker (conditional) -->
				{#if showPagePicker}
					<div class="form-control">
						<label class="label" for="page-select">
							<span class="label-text font-medium">Page <span class="text-error">*</span></span>
						</label>
						<select
							id="page-select"
							class="select select-bordered w-full"
							bind:value={selectedPageId}
							disabled={isGenerating}
						>
							<option value="" disabled>Select a page...</option>
							{#each data.pages as p}
								<option value={p.id}>{p.title || p.url}</option>
							{/each}
						</select>
						{#if data.pages.length === 0}
							<div class="label">
								<span class="label-text-alt text-warning">No pages available. Crawl the site first.</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Target Keyword -->
				<div class="form-control">
					<label class="label" for="target-keyword">
						<span class="label-text font-medium">Target Keyword</span>
						<span class="label-text-alt">Optional</span>
					</label>
					<input
						id="target-keyword"
						type="text"
						class="input input-bordered w-full"
						placeholder="e.g. web design agency melbourne"
						bind:value={targetKeyword}
						disabled={isGenerating}
					/>
				</div>

				<!-- Target Word Count -->
				<div class="form-control">
					<label class="label" for="target-word-count">
						<span class="label-text font-medium">Target Word Count</span>
						<span class="label-text-alt">Optional (50-5000)</span>
					</label>
					<input
						id="target-word-count"
						type="number"
						class="input input-bordered w-full"
						placeholder="e.g. 500"
						min="50"
						max="5000"
						bind:value={targetWordCount}
						disabled={isGenerating}
					/>
				</div>

				<!-- Notes -->
				<div class="form-control">
					<label class="label" for="notes">
						<span class="label-text font-medium">Notes</span>
						<span class="label-text-alt">Optional</span>
					</label>
					<textarea
						id="notes"
						class="textarea textarea-bordered w-full h-24"
						placeholder="Additional instructions for the AI..."
						bind:value={notes}
						disabled={isGenerating}
					></textarea>
				</div>

				<!-- Submit -->
				<button
					type="button"
					class="btn btn-primary w-full"
					onclick={handleGenerateCopy}
					disabled={isGenerating || !copyType}
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

	<!-- Generate Meta Tags Card -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title flex items-center gap-2">
				<Tag class="h-5 w-5 text-secondary" />
				Generate Meta Tags
			</h2>
			<p class="text-sm text-base-content/60">
				Quickly generate an optimised meta title and description for a page.
			</p>

			{#if metaError}
				<div class="alert alert-error mt-4">
					<span>{metaError}</span>
				</div>
			{/if}

			{#if metaResult}
				<div class="alert alert-success mt-4">
					<div class="space-y-2 w-full">
						<p class="font-semibold text-sm">Meta tags generated successfully</p>
						<div>
							<span class="text-xs font-medium opacity-70">Title:</span>
							<p class="text-sm">{metaResult.meta_title}</p>
						</div>
						<div>
							<span class="text-xs font-medium opacity-70">Description:</span>
							<p class="text-sm">{metaResult.meta_description}</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="space-y-4 mt-4">
				<!-- Page picker -->
				<div class="form-control">
					<label class="label" for="meta-page-select">
						<span class="label-text font-medium">Page <span class="text-error">*</span></span>
					</label>
					<select
						id="meta-page-select"
						class="select select-bordered w-full"
						bind:value={metaPageId}
						disabled={isGeneratingMeta}
					>
						<option value="" disabled>Select a page...</option>
						{#each data.pages as p}
							<option value={p.id}>{p.title || p.url}</option>
						{/each}
					</select>
				</div>

				<!-- Keyword -->
				<div class="form-control">
					<label class="label" for="meta-keyword">
						<span class="label-text font-medium">Target Keyword</span>
						<span class="label-text-alt">Optional</span>
					</label>
					<input
						id="meta-keyword"
						type="text"
						class="input input-bordered w-full"
						placeholder="e.g. web design agency melbourne"
						bind:value={metaKeyword}
						disabled={isGeneratingMeta}
					/>
				</div>

				<!-- Submit -->
				<button
					type="button"
					class="btn btn-secondary w-full"
					onclick={handleGenerateMeta}
					disabled={isGeneratingMeta || !metaPageId}
				>
					{#if isGeneratingMeta}
						<span class="loading loading-spinner loading-sm"></span>
						Generating...
					{:else}
						<Tag class="h-4 w-4" />
						Generate Meta
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>

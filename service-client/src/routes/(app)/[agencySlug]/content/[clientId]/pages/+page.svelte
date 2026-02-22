<script lang="ts">
	import { page } from "$app/state";
	import { goto, invalidateAll } from "$app/navigation";
	import { Search, X, FileText, RefreshCw } from "lucide-svelte";
	import { PAGE_TYPES } from "$lib/api/content.types";
	import { formatDate } from "$lib/utils/formatting";
	import { startCrawl, getCrawlStatus } from "$lib/api/content.remote";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	// Re-crawl state
	let isCrawling = $state(false);
	let crawlProgress = $state("");

	async function handleRecrawl() {
		if (!data.sourceUrl || isCrawling) return;

		isCrawling = true;
		crawlProgress = "Starting crawl...";

		try {
			const result = await startCrawl({
				clientId,
				sourceUrl: data.sourceUrl,
				maxDepth: 3,
			});

			// Poll for completion — refresh page list on each tick
			const jobId = result.id;
			let done = false;
			let pollCount = 0;
			while (!done) {
				await new Promise((r) => setTimeout(r, 3000));
				const status = await getCrawlStatus(jobId);
				const phase = status.status ?? "crawling";
				const pages = status.pages_processed ?? 0;
				const discovered = status.pages_discovered ?? 0;

				// Show phase + progress
				if (phase === "pending") {
					crawlProgress = "Queued, waiting to start...";
				} else if (phase === "crawling") {
					crawlProgress = `Crawling... ${discovered} pages discovered`;
				} else if (phase === "extracting") {
					crawlProgress = `Extracting content... ${pages}/${discovered} pages`;
				} else if (phase === "classifying") {
					crawlProgress = `Classifying pages... ${pages}/${discovered}`;
				} else if (phase === "embedding") {
					crawlProgress = `Generating embeddings... ${pages}/${discovered}`;
				} else if (phase === "profiling") {
					crawlProgress = `Building brand profile...`;
				}

				// Terminal states
				if (phase === "complete" || phase === "failed") {
					done = true;
					if (phase === "complete") {
						crawlProgress = `Done! ${pages} pages processed`;
					} else {
						crawlProgress = status.error_message ? `Failed: ${status.error_message}` : "Crawl failed";
					}
				}

				// Refresh page list every 3 polls (~9s) so new pages appear live
				pollCount++;
				if (pollCount % 3 === 0 || done) {
					await invalidateAll();
				}
			}

			setTimeout(() => {
				isCrawling = false;
				crawlProgress = "";
			}, 2000);
		} catch (err) {
			crawlProgress = "Error starting crawl";
			setTimeout(() => {
				isCrawling = false;
				crawlProgress = "";
			}, 3000);
		}
	}

	let search = $state("");
	let typeFilter = $state("");

	let filteredPages = $derived.by(() => {
		let result = data.pages;
		if (search) {
			const s = search.toLowerCase();
			result = result.filter(
				(p) =>
					p.url.toLowerCase().includes(s) ||
					(p.title && p.title.toLowerCase().includes(s)),
			);
		}
		if (typeFilter) {
			result = result.filter((p) => p.page_type === typeFilter);
		}
		return result;
	});

	function badgeClass(pageType: string): string {
		switch (pageType) {
			case "homepage":
				return "badge-primary";
			case "service":
				return "badge-info";
			case "blog_post":
				return "badge-accent";
			case "contact":
				return "badge-warning";
			case "product":
				return "badge-secondary";
			case "about":
				return "badge-neutral";
			case "unknown":
				return "badge-ghost";
			default:
				return "badge-outline";
		}
	}

	function truncateUrl(url: string, max = 50): string {
		try {
			const parsed = new URL(url);
			const path = parsed.pathname + parsed.search;
			if (path.length <= max) return path;
			return path.slice(0, max) + "...";
		} catch {
			if (url.length <= max) return url;
			return url.slice(0, max) + "...";
		}
	}

	function formatPageType(type: string): string {
		return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex items-center gap-2">
			<h2 class="text-xl font-semibold">Pages</h2>
			<span class="badge badge-neutral badge-sm">{data.pages.length}</span>
		</div>
		<div class="flex items-center gap-2">
			{#if crawlProgress}
				<span class="text-sm text-base-content/60">{crawlProgress}</span>
			{/if}
			{#if data.sourceUrl}
				<button
					type="button"
					class="btn btn-outline btn-sm gap-2"
					onclick={handleRecrawl}
					disabled={isCrawling}
				>
					<RefreshCw class="h-4 w-4 {isCrawling ? 'animate-spin' : ''}" />
					{isCrawling ? "Crawling..." : "Re-crawl"}
				</button>
			{/if}
		</div>
	</div>

	<!-- Search + Filter -->
	<div class="flex flex-col sm:flex-row gap-2">
		<div class="relative flex-1 max-w-md">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
			<input
				type="text"
				class="input input-bordered w-full pl-10 pr-10"
				placeholder="Search by URL or title..."
				bind:value={search}
			/>
			{#if search}
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
					onclick={() => (search = "")}
				>
					<X class="h-3 w-3" />
				</button>
			{/if}
		</div>
		<select class="select select-bordered w-full sm:w-48" bind:value={typeFilter}>
			<option value="">All Types</option>
			{#each PAGE_TYPES as pt}
				<option value={pt}>{formatPageType(pt)}</option>
			{/each}
		</select>
	</div>

	{#if filteredPages.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4"
				>
					<FileText class="h-8 w-8 text-base-content/30" />
				</div>
				{#if search || typeFilter}
					<h3 class="text-lg font-semibold">No pages found</h3>
					<p class="text-base-content/60 max-w-sm">
						No pages match your current filters. Try adjusting your search or type filter.
					</p>
					<button
						type="button"
						class="btn btn-outline mt-4"
						onclick={() => {
							search = "";
							typeFilter = "";
						}}
					>
						Clear Filters
					</button>
				{:else}
					<h3 class="text-lg font-semibold">No pages yet</h3>
					<p class="text-base-content/60 max-w-sm">
						Pages will appear here once a crawl has been completed for this client.
					</p>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each filteredPages as contentPage (contentPage.id)}
				<a
					href="/{agencySlug}/content/{clientId}/pages/{contentPage.id}"
					class="card bg-base-100 border border-base-300 hover:border-base-content/20 transition-colors"
				>
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="flex-1 min-w-0">
								<div class="font-medium truncate">
									{contentPage.title || "Untitled"}
								</div>
								<div class="text-sm text-base-content/60 truncate mt-0.5">
									{contentPage.url}
								</div>
							</div>
							<span class="badge badge-sm {badgeClass(contentPage.page_type)}">
								{formatPageType(contentPage.page_type)}
							</span>
						</div>
						<div class="flex items-center gap-4 mt-2 pt-2 border-t border-base-200 text-xs text-base-content/50">
							<span>{contentPage.word_count.toLocaleString()} words</span>
							<span>{formatDate(contentPage.last_scraped_at, "short")}</span>
							{#if contentPage.classification_method}
								<span class="capitalize">{contentPage.classification_method}</span>
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block card bg-base-100 border border-base-300 overflow-x-auto">
			<table class="table">
				<thead>
					<tr class="bg-base-200">
						<th>URL</th>
						<th>Type</th>
						<th>Title</th>
						<th class="text-right">Words</th>
						<th>Last Scraped</th>
						<th>Method</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredPages as contentPage (contentPage.id)}
						<tr
							class="hover:bg-base-50 cursor-pointer"
							onclick={() =>
								goto(
									`/${agencySlug}/content/${clientId}/pages/${contentPage.id}`,
								)}
						>
							<td>
								<span class="text-sm font-mono" title={contentPage.url}>
									{truncateUrl(contentPage.url)}
								</span>
							</td>
							<td>
								<span class="badge badge-sm {badgeClass(contentPage.page_type)}">
									{formatPageType(contentPage.page_type)}
								</span>
							</td>
							<td>
								<span class="text-sm truncate block max-w-xs">
									{contentPage.title || "Untitled"}
								</span>
							</td>
							<td class="text-right">
								<span class="text-sm">{contentPage.word_count.toLocaleString()}</span>
							</td>
							<td>
								<span class="text-sm text-base-content/70">
									{formatDate(contentPage.last_scraped_at, "short")}
								</span>
							</td>
							<td>
								<span class="text-sm text-base-content/60 capitalize">
									{contentPage.classification_method || "—"}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

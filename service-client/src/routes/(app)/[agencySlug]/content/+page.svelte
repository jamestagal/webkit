<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { FEATURES } from "$lib/config/features";
	import { Brain, Plus, Globe } from "lucide-svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);

	function statusBadgeClass(status: string): string {
		switch (status) {
			case "pending":
				return "badge-ghost";
			case "crawling":
				return "badge-info";
			case "embedding":
				return "badge-warning";
			case "complete":
				return "badge-success";
			case "failed":
				return "badge-error";
			case "cancelled":
				return "badge-ghost";
			default:
				return "badge-ghost";
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<Brain class="h-7 w-7" style="color: {FEATURES.content.color}" />
				Content Intelligence
			</h1>
			<p class="text-base-content/70 mt-1">Analyze client websites and generate optimized content</p>
		</div>
		<a href="/{agencySlug}/content/crawl" class="btn btn-primary">
			<Plus class="h-4 w-4" />
			Crawl Website
		</a>
	</div>

	{#if data.clientsWithCrawls.length === 0}
		<!-- Empty State -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
					style="background-color: {FEATURES.content.colorLight}; color: {FEATURES.content.color}"
				>
					<Brain class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No content data yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Run an SEO audit or crawl a website to get started with content intelligence.
				</p>
				<a href="/{agencySlug}/content/crawl" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Get Started
				</a>
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each data.clientsWithCrawls as { client, latestCrawl } (client.id)}
				<button
					type="button"
					class="card bg-base-100 border border-base-300 w-full text-left"
					onclick={() => goto(`/${agencySlug}/content/${client.id}`)}
				>
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<span class="font-medium truncate block">{client.businessName}</span>
								<div class="flex items-center gap-2 mt-1 text-sm text-base-content/70">
									<Globe class="h-3 w-3 shrink-0" />
									<span class="truncate">{latestCrawl.sourceUrl}</span>
								</div>
							</div>
							<span class="badge {statusBadgeClass(latestCrawl.status)} badge-sm shrink-0">
								{#if latestCrawl.status === "crawling"}
									<span class="loading loading-spinner loading-xs mr-1"></span>
								{/if}
								{latestCrawl.status}
							</span>
						</div>
						<div class="flex items-center gap-4 mt-2 pt-2 border-t border-base-200 text-sm text-base-content/60">
							<span>{latestCrawl.pagesDiscovered ?? 0} pages</span>
							{#if latestCrawl.completedAt}
								<span>{new Date(latestCrawl.completedAt).toLocaleDateString()}</span>
							{:else if latestCrawl.createdAt}
								<span>{new Date(latestCrawl.createdAt).toLocaleDateString()}</span>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block card bg-base-100 border border-base-300 overflow-visible">
			<div class="overflow-visible">
				<table class="table">
					<thead>
						<tr class="bg-base-200">
							<th>Client Name</th>
							<th>Website URL</th>
							<th>Pages</th>
							<th>Status</th>
							<th>Last Crawl</th>
						</tr>
					</thead>
					<tbody>
						{#each data.clientsWithCrawls as { client, latestCrawl } (client.id)}
							<tr
								class="hover:bg-base-50 cursor-pointer"
								onclick={() => goto(`/${agencySlug}/content/${client.id}`)}
							>
								<td>
									<span class="font-medium">{client.businessName}</span>
								</td>
								<td>
									<div class="flex items-center gap-2">
										<Globe class="h-4 w-4 text-base-content/40 shrink-0" />
										<span class="text-sm truncate max-w-xs">{latestCrawl.sourceUrl}</span>
									</div>
								</td>
								<td>
									<span class="text-sm">{latestCrawl.pagesDiscovered ?? 0}</span>
								</td>
								<td>
									<span class="badge {statusBadgeClass(latestCrawl.status)} badge-sm">
										{#if latestCrawl.status === "crawling"}
											<span class="loading loading-spinner loading-xs mr-1"></span>
										{/if}
										{latestCrawl.status}
									</span>
								</td>
								<td>
									<span class="text-sm text-base-content/70">
										{#if latestCrawl.completedAt}
											{new Date(latestCrawl.completedAt).toLocaleDateString()}
										{:else if latestCrawl.createdAt}
											{new Date(latestCrawl.createdAt).toLocaleDateString()}
										{:else}
											&mdash;
										{/if}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

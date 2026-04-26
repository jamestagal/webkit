<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { FEATURES } from "$lib/config/features";
	import {
		Brain,
		Globe,
		Search,
		MoreVertical,
		Users
	} from "lucide-svelte";
	import type { PageData } from "./$types";
	import type { ClientContentStatus } from "$lib/api/content.remote";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientStatuses = $derived(data.clientStatuses as ClientContentStatus[]);

	// Search
	let searchQuery = $state("");
	let filtered = $derived(
		searchQuery.trim()
			? clientStatuses.filter((c) =>
					c.client.businessName.toLowerCase().includes(searchQuery.trim().toLowerCase())
				)
			: clientStatuses
	);

	// Audit client picker modal
	let auditModalOpen = $state(false);
	let auditSearch = $state("");
	let auditFilteredClients = $derived(
		auditSearch.trim()
			? clientStatuses.filter((c) =>
					c.client.businessName.toLowerCase().includes(auditSearch.trim().toLowerCase()) ||
					(c.client.website && c.client.website.toLowerCase().includes(auditSearch.trim().toLowerCase()))
				)
			: clientStatuses
	);

	function getScoreColor(score: number): string {
		if (score >= 80) return "badge-success";
		if (score >= 50) return "badge-warning";
		return "badge-error";
	}

	function getDomain(url: string): string {
		if (!url) return "—";
		try {
			return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
		} catch {
			return url;
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
			<p class="text-base-content/70 mt-1">Run SEO audits, crawl websites, and generate AI-powered content</p>
		</div>
		{#if clientStatuses.length > 0}
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={() => { auditModalOpen = true; auditSearch = ""; }}
				>
					<Search class="h-4 w-4" />
					Run SEO Audit
				</button>
				<a href="/{agencySlug}/content/crawl" class="btn btn-outline btn-sm">
					<Globe class="h-4 w-4" />
					Crawl Website
				</a>
			</div>
		{/if}
	</div>

	{#if clientStatuses.length === 0}
		<!-- Empty State: No clients -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
					style="background-color: {FEATURES.content.colorLight}; color: {FEATURES.content.color}"
				>
					<Brain class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No clients yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create a client to get started with Content Intelligence — run SEO audits, crawl websites, and generate AI-powered content.
				</p>
				<a href="/{agencySlug}/clients?new=true" class="btn btn-primary mt-4">
					<Users class="h-4 w-4" />
					Add Client
				</a>
			</div>
		</div>
	{:else}
		<!-- Search -->
		<div class="flex items-center gap-3">
			<div class="relative flex-1 max-w-sm">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" />
				<input
					type="text"
					placeholder="Search clients..."
					class="input input-bordered input-sm w-full pl-10"
					bind:value={searchQuery}
				/>
			</div>
			<span class="text-sm text-base-content/50">
				{filtered.length === clientStatuses.length
					? `${clientStatuses.length} client${clientStatuses.length !== 1 ? 's' : ''}`
					: `Showing ${filtered.length} of ${clientStatuses.length}`}
			</span>
		</div>

		{#if filtered.length === 0 && searchQuery.trim()}
			<div class="text-center py-8 text-base-content/50">
				No clients matching "{searchQuery.trim()}"
			</div>
		{:else}
			<!-- Mobile Card Layout -->
			<div class="space-y-3 md:hidden">
				{#each filtered as cs (cs.client.id)}
					<button
						type="button"
						class="card bg-base-100 border border-base-300 w-full text-left"
						onclick={() => goto(`/${agencySlug}/content/${cs.client.id}`)}
					>
						<div class="card-body p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<span class="font-medium truncate block">{cs.client.businessName}</span>
									{#if cs.client.website}
										<span class="text-xs text-base-content/50">{getDomain(cs.client.website)}</span>
									{/if}
								</div>
							</div>
							<div class="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-base-200">
								<!-- Audit pill -->
								{#if cs.audit.status === "complete" && cs.audit.score != null}
									<span class="badge badge-sm {getScoreColor(cs.audit.score)}">{cs.audit.score}</span>
								{:else if cs.audit.status === "running" || cs.audit.status === "pending"}
									<span class="badge badge-sm badge-info">
										<span class="loading loading-spinner loading-xs mr-1"></span>Audit
									</span>
								{:else if cs.audit.status === "failed"}
									<span class="badge badge-sm badge-error">Audit failed</span>
								{/if}
								<!-- Crawl pill -->
								{#if cs.crawl.status === "complete" && cs.crawl.totalPages > 0}
									<span class="badge badge-sm badge-success">{cs.crawl.totalPages} pages</span>
								{:else if cs.crawl.status === "crawling"}
									<span class="badge badge-sm badge-info">
										<span class="loading loading-spinner loading-xs mr-1"></span>Crawling
									</span>
								{/if}
								<!-- Brand pill -->
								{#if cs.brand.hasProfile}
									<span class="badge badge-sm badge-success">Brand</span>
								{/if}
								<!-- Copy count -->
								{#if cs.copy.total > 0}
									<span class="badge badge-sm badge-ghost">{cs.copy.total} copy</span>
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
								<th>Client</th>
								<th>Website</th>
								<th>Audit</th>
								<th>Crawl</th>
								<th>Brand</th>
								<th>Copy</th>
								<th class="w-12"></th>
							</tr>
						</thead>
						<tbody>
							{#each filtered as cs (cs.client.id)}
								<tr
									class="hover:bg-base-50 cursor-pointer"
									onclick={() => goto(`/${agencySlug}/content/${cs.client.id}`)}
								>
									<td>
										<span class="font-medium">{cs.client.businessName}</span>
									</td>
									<td>
										{#if cs.client.website}
											<span class="text-sm text-base-content/60">{getDomain(cs.client.website)}</span>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
									<td>
										{#if cs.audit.status === "complete" && cs.audit.score != null}
											<a
												href="/{agencySlug}/content/{cs.client.id}/audit"
												class="badge badge-sm {getScoreColor(cs.audit.score)}"
												onclick={(e) => e.stopPropagation()}
											>{cs.audit.score}</a>
										{:else if cs.audit.status === "running" || cs.audit.status === "pending"}
											<span class="badge badge-sm badge-info">
												<span class="loading loading-spinner loading-xs mr-1"></span>Running
											</span>
										{:else if cs.audit.status === "failed"}
											<span class="badge badge-sm badge-error">Failed</span>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
									<td>
										{#if cs.crawl.status === "complete" && cs.crawl.totalPages > 0}
											<a
												href="/{agencySlug}/content/{cs.client.id}/pages"
												class="text-sm text-base-content/70 hover:text-primary"
												onclick={(e) => e.stopPropagation()}
											>{cs.crawl.totalPages} pages</a>
										{:else if cs.crawl.status === "crawling" || cs.crawl.status === "embedding"}
											<span class="badge badge-sm badge-info">
												<span class="loading loading-spinner loading-xs mr-1"></span>Crawling
											</span>
										{:else if cs.crawl.status === "failed"}
											<span class="badge badge-sm badge-error">Failed</span>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
									<td>
										{#if cs.brand.hasProfile}
											<span class="badge badge-sm badge-success">Active</span>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
									<td>
										{#if cs.copy.total > 0}
											<span class="text-sm">{cs.copy.total}</span>
										{:else}
											<span class="text-base-content/30">—</span>
										{/if}
									</td>
									<td>
										<!-- Actions dropdown -->
										<div class="dropdown dropdown-end" onclick={(e) => e.stopPropagation()}>
											<button type="button" class="btn btn-ghost btn-xs btn-square">
												<MoreVertical class="h-4 w-4" />
											</button>
											<ul class="dropdown-content menu bg-base-100 rounded-box z-50 w-56 p-2 shadow-lg border border-base-300">
												{#if cs.client.website}
													<li><a href="/{agencySlug}/content/{cs.client.id}/audit">Run SEO Audit</a></li>
													<li><a href="/{agencySlug}/content/crawl?clientId={cs.client.id}">Crawl Website</a></li>
												{:else}
													<li class="disabled"><span class="opacity-40 text-xs">Add a website URL to run audits or crawls</span></li>
												{/if}
												<li><a href="/{agencySlug}/content/{cs.client.id}">View Overview</a></li>
												<li><a href="/{agencySlug}/clients/{cs.client.id}">View Client</a></li>
											</ul>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- SEO Audit Client Picker Modal -->
{#if auditModalOpen}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-md">
			<h3 class="font-bold text-lg mb-4">Select a client for SEO Audit</h3>
			<input
				type="text"
				placeholder="Search clients..."
				class="input input-bordered w-full mb-3"
				bind:value={auditSearch}
			/>
			<div class="max-h-64 overflow-y-auto space-y-1">
				{#each auditFilteredClients as cs (cs.client.id)}
					{#if cs.client.website}
						<a
							href="/{agencySlug}/content/{cs.client.id}/audit"
							class="flex items-center justify-between p-3 rounded-lg hover:bg-base-200 transition-colors"
							onclick={() => { auditModalOpen = false; }}
						>
							<div class="min-w-0">
								<p class="font-medium truncate">{cs.client.businessName}</p>
								<p class="text-xs text-base-content/50 truncate">{getDomain(cs.client.website)}</p>
							</div>
							{#if cs.audit.score != null}
								<span class="badge badge-sm {getScoreColor(cs.audit.score)} shrink-0 ml-2">{cs.audit.score}</span>
							{/if}
						</a>
					{:else}
						<div class="flex items-center justify-between p-3 rounded-lg opacity-40">
							<div class="min-w-0">
								<p class="font-medium truncate">{cs.client.businessName}</p>
								<p class="text-xs text-error/60">No website — add one in client settings</p>
							</div>
						</div>
					{/if}
				{/each}
				{#if auditFilteredClients.length === 0}
					<p class="text-center text-base-content/50 py-4">No clients found</p>
				{/if}
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost btn-sm" onclick={() => { auditModalOpen = false; }}>Cancel</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => { auditModalOpen = false; }}>close</button>
		</form>
	</dialog>
{/if}

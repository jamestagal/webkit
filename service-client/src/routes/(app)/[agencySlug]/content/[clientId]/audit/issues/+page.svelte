<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import {
		ArrowLeft,
		AlertTriangle,
		AlertCircle,
		Info,
		Lightbulb,
		Sparkles,
		ChevronDown,
		ChevronUp,
		ChevronLeft,
		ChevronRight,
	} from "lucide-svelte";
	import { ISSUE_CATEGORIES, ISSUE_SEVERITIES } from "$lib/api/content-audit.types";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	let currentCategory = $derived(page.url.searchParams.get("category") || "");
	let currentSeverity = $derived(page.url.searchParams.get("severity") || "");
	let currentPage = $derived(Number(page.url.searchParams.get("page")) || 1);

	let expandedId = $state<string | null>(null);

	function updateFilters(key: string, value: string | null) {
		const params = new URLSearchParams(page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		params.delete("page");
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function goToPage(p: number) {
		const params = new URLSearchParams(page.url.searchParams);
		if (p > 1) params.set("page", String(p));
		else params.delete("page");
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function severityBadgeClass(severity: string): string {
		switch (severity) {
			case "critical":
				return "badge-error";
			case "warning":
				return "badge-warning";
			case "info":
				return "badge-info";
			case "opportunity":
				return "badge-accent";
			default:
				return "badge-ghost";
		}
	}

	function formatCategory(cat: string): string {
		return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a
			href="/{agencySlug}/content/{clientId}/audit"
			class="btn btn-ghost btn-sm btn-circle"
		>
			<ArrowLeft class="h-4 w-4" />
		</a>
		<h2 class="text-xl font-semibold">Issues</h2>
		{#if data.issues}
			<span class="badge badge-neutral badge-sm">{data.issues.total}</span>
		{/if}
	</div>

	{#if !data.issues}
		<!-- No Data -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
					<AlertTriangle class="h-8 w-8 text-base-content/30" />
				</div>
				<h3 class="text-lg font-semibold">No issues data</h3>
				<p class="text-base-content/60 max-w-sm">
					Run an SEO audit first to identify issues on this client's website.
				</p>
				<a href="/{agencySlug}/content/{clientId}/audit" class="btn btn-primary mt-4">
					Go to Audit
				</a>
			</div>
		</div>
	{:else}
		<!-- Filters -->
		<div class="flex flex-col sm:flex-row gap-3">
			<!-- Category Filter -->
			<select
				class="select select-bordered select-sm w-full sm:w-48"
				value={currentCategory}
				onchange={(e) => updateFilters("category", e.currentTarget.value || null)}
			>
				<option value="">All Categories</option>
				{#each ISSUE_CATEGORIES as cat}
					<option value={cat}>{formatCategory(cat)}</option>
				{/each}
			</select>

			<!-- Severity Tabs -->
			<div role="tablist" class="tabs tabs-boxed tabs-sm">
				<button
					role="tab"
					class="tab"
					class:tab-active={!currentSeverity}
					onclick={() => updateFilters("severity", null)}
				>
					All
				</button>
				{#each ISSUE_SEVERITIES as sev}
					<button
						role="tab"
						class="tab capitalize"
						class:tab-active={currentSeverity === sev}
						onclick={() => updateFilters("severity", sev)}
					>
						{sev}
					</button>
				{/each}
			</div>
		</div>

		{#if data.issues.items.length === 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body items-center text-center py-12">
					<h3 class="text-lg font-semibold">No issues found</h3>
					<p class="text-base-content/60 max-w-sm">
						No issues match your current filters. Try adjusting the category or severity filter.
					</p>
					<button
						type="button"
						class="btn btn-outline btn-sm mt-4"
						onclick={() => goto(`/${agencySlug}/content/${clientId}/audit/issues`)}
					>
						Clear Filters
					</button>
				</div>
			</div>
		{:else}
			<!-- Mobile Card Layout -->
			<div class="space-y-3 md:hidden">
				{#each data.issues.items as issue (issue.id)}
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-center gap-2 flex-1 min-w-0">
									{#if issue.severity === "critical"}
										<AlertTriangle class="h-4 w-4 shrink-0 text-error" />
									{:else if issue.severity === "warning"}
										<AlertCircle class="h-4 w-4 shrink-0 text-warning" />
									{:else if issue.severity === "info"}
										<Info class="h-4 w-4 shrink-0 text-info" />
									{:else}
										<Lightbulb class="h-4 w-4 shrink-0 text-accent" />
									{/if}
									<span class="font-medium truncate">{issue.title}</span>
								</div>
								<div class="flex items-center gap-1">
									{#if issue.ai_fix_available}
										<span class="badge badge-sm badge-primary gap-1">
											<Sparkles class="h-3 w-3" />
											AI
										</span>
									{/if}
									<span class="badge badge-sm {severityBadgeClass(issue.severity)} capitalize">
										{issue.severity}
									</span>
								</div>
							</div>
							<div class="flex items-center gap-2 mt-2">
								<span class="badge badge-sm badge-outline">{formatCategory(issue.category)}</span>
							</div>
							<p class="text-sm text-base-content/60 mt-2 line-clamp-2">{issue.description}</p>
							{#if issue.current_value || issue.recommended_value}
								<button
									type="button"
									class="btn btn-ghost btn-xs mt-2"
									onclick={() => toggleExpand(issue.id)}
								>
									{expandedId === issue.id ? "Hide" : "Show"} Details
									{#if expandedId === issue.id}
										<ChevronUp class="h-3 w-3" />
									{:else}
										<ChevronDown class="h-3 w-3" />
									{/if}
								</button>
								{#if expandedId === issue.id}
									<div class="mt-2 p-3 bg-base-200 rounded-lg text-sm space-y-2">
										{#if issue.current_value}
											<div>
												<span class="font-medium text-error">Current:</span>
												<span class="text-base-content/70">{issue.current_value}</span>
											</div>
										{/if}
										{#if issue.recommended_value}
											<div>
												<span class="font-medium text-success">Recommended:</span>
												<span class="text-base-content/70">{issue.recommended_value}</span>
											</div>
										{/if}
										{#if issue.impact}
											<div>
												<span class="font-medium">Impact:</span>
												<span class="text-base-content/70">{issue.impact}</span>
											</div>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop Table Layout -->
			<div class="hidden md:block card bg-base-100 border border-base-300 overflow-x-auto">
				<table class="table">
					<thead>
						<tr class="bg-base-200">
							<th class="w-10"></th>
							<th>Title</th>
							<th>Category</th>
							<th>Severity</th>
							<th>AI Fix</th>
							<th class="w-10"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.issues.items as issue (issue.id)}
							<tr
								class="hover:bg-base-50 cursor-pointer"
								onclick={() => toggleExpand(issue.id)}
							>
								<td>
									{#if issue.severity === "critical"}
										<AlertTriangle class="h-4 w-4 text-error" />
									{:else if issue.severity === "warning"}
										<AlertCircle class="h-4 w-4 text-warning" />
									{:else if issue.severity === "info"}
										<Info class="h-4 w-4 text-info" />
									{:else}
										<Lightbulb class="h-4 w-4 text-accent" />
									{/if}
								</td>
								<td>
									<div class="font-medium">{issue.title}</div>
									<div class="text-xs text-base-content/50 mt-0.5 line-clamp-1">
										{issue.description}
									</div>
								</td>
								<td>
									<span class="badge badge-sm badge-outline">{formatCategory(issue.category)}</span>
								</td>
								<td>
									<span class="badge badge-sm {severityBadgeClass(issue.severity)} capitalize">
										{issue.severity}
									</span>
								</td>
								<td>
									{#if issue.ai_fix_available}
										<span class="badge badge-sm badge-primary gap-1">
											<Sparkles class="h-3 w-3" />
											AI
										</span>
									{:else}
										<span class="text-base-content/30">--</span>
									{/if}
								</td>
								<td>
									{#if expandedId === issue.id}
										<ChevronUp class="h-4 w-4 text-base-content/40" />
									{:else}
										<ChevronDown class="h-4 w-4 text-base-content/40" />
									{/if}
								</td>
							</tr>
							{#if expandedId === issue.id}
								<tr>
									<td colspan="6" class="bg-base-200/50 p-0">
										<div class="p-4 space-y-2 text-sm">
											<p class="text-base-content/70">{issue.description}</p>
											{#if issue.current_value}
												<div class="flex gap-2">
													<span class="font-medium text-error shrink-0">Current:</span>
													<span class="text-base-content/70 break-all">{issue.current_value}</span>
												</div>
											{/if}
											{#if issue.recommended_value}
												<div class="flex gap-2">
													<span class="font-medium text-success shrink-0">Recommended:</span>
													<span class="text-base-content/70 break-all">{issue.recommended_value}</span>
												</div>
											{/if}
											{#if issue.impact}
												<div class="flex gap-2">
													<span class="font-medium shrink-0">Impact:</span>
													<span class="text-base-content/70">{issue.impact}</span>
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if data.issues.total_pages > 1}
				<div class="flex items-center justify-between">
					<div class="text-sm text-base-content/60">
						Page {data.issues.page} of {data.issues.total_pages}
						({data.issues.total} total issues)
					</div>
					<div class="join">
						<button
							class="join-item btn btn-sm"
							disabled={currentPage <= 1}
							onclick={() => goToPage(currentPage - 1)}
						>
							<ChevronLeft class="h-4 w-4" />
						</button>
						{#each Array.from({ length: Math.min(data.issues.total_pages, 5) }, (_, i) => {
							const start = Math.max(1, Math.min(currentPage - 2, data.issues.total_pages - 4));
							return start + i;
						}).filter((p) => p <= data.issues.total_pages) as p}
							<button
								class="join-item btn btn-sm"
								class:btn-active={p === currentPage}
								onclick={() => goToPage(p)}
							>
								{p}
							</button>
						{/each}
						<button
							class="join-item btn btn-sm"
							disabled={currentPage >= data.issues.total_pages}
							onclick={() => goToPage(currentPage + 1)}
						>
							<ChevronRight class="h-4 w-4" />
						</button>
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>

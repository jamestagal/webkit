<script lang="ts">
	import { page } from "$app/state";
	import { ArrowLeft, Search } from "lucide-svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	type RankingKeyword = {
		keyword: string;
		position: number;
		search_volume?: number;
		url?: string;
	};

	let rankings = $derived(
		(data.keywords?.ranking_keywords ?? []) as RankingKeyword[],
	);

	function positionColor(pos: number): string {
		if (pos <= 3) return "text-success font-bold";
		if (pos <= 10) return "text-info";
		if (pos <= 50) return "text-warning";
		return "text-base-content/60";
	}

	function positionBadge(pos: number): string {
		if (pos <= 3) return "badge-success";
		if (pos <= 10) return "badge-info";
		if (pos <= 50) return "badge-warning";
		return "badge-ghost";
	}

	function truncateUrl(url: string, max = 40): string {
		try {
			const parsed = new URL(url);
			const path = parsed.pathname;
			if (path.length <= max) return path;
			return path.slice(0, max) + "...";
		} catch {
			if (url.length <= max) return url;
			return url.slice(0, max) + "...";
		}
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
		<h2 class="text-xl font-semibold">Keyword Rankings</h2>
	</div>

	{#if !data.keywords}
		<!-- No Data -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
					<Search class="h-8 w-8 text-base-content/30" />
				</div>
				<h3 class="text-lg font-semibold">No keyword data</h3>
				<p class="text-base-content/60 max-w-sm">
					Run an SEO audit to analyze keyword rankings for this client.
				</p>
				<a href="/{agencySlug}/content/{clientId}/audit" class="btn btn-primary mt-4">
					Go to Audit
				</a>
			</div>
		</div>
	{:else}
		<!-- Stats Row -->
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Total Ranking</div>
					<div class="text-2xl font-bold">{data.keywords.total_ranking_keywords.toLocaleString()}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Top 3</div>
					<div class="text-2xl font-bold text-success">{data.keywords.keywords_top_3}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Top 10</div>
					<div class="text-2xl font-bold text-info">{data.keywords.keywords_top_10}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Top 50</div>
					<div class="text-2xl font-bold text-warning">{data.keywords.keywords_top_50}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Est. Traffic</div>
					<div class="text-2xl font-bold">{data.keywords.estimated_traffic.toLocaleString()}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Keyword Gaps</div>
					<div class="text-2xl font-bold text-accent">{data.keywords.total_keyword_gaps}</div>
				</div>
			</div>
		</div>

		<!-- Ranking Distribution -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-3">
					Position Distribution
				</h3>
				<div class="flex gap-2 flex-wrap">
					<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10">
						<span class="w-3 h-3 rounded-full bg-success"></span>
						<span class="text-sm">Top 3: <strong>{data.keywords.keywords_top_3}</strong></span>
					</div>
					<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-info/10">
						<span class="w-3 h-3 rounded-full bg-info"></span>
						<span class="text-sm">4-10: <strong>{data.keywords.keywords_top_10 - data.keywords.keywords_top_3}</strong></span>
					</div>
					<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10">
						<span class="w-3 h-3 rounded-full bg-warning"></span>
						<span class="text-sm">11-50: <strong>{data.keywords.keywords_top_50 - data.keywords.keywords_top_10}</strong></span>
					</div>
					<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base-200">
						<span class="w-3 h-3 rounded-full bg-base-content/30"></span>
						<span class="text-sm">50+: <strong>{Math.max(0, data.keywords.total_ranking_keywords - data.keywords.keywords_top_50)}</strong></span>
					</div>
				</div>
			</div>
		</div>

		<!-- Rankings Table -->
		{#if rankings.length > 0}
			<!-- Mobile Cards -->
			<div class="space-y-3 md:hidden">
				{#each rankings as kw, i (i)}
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body p-4">
							<div class="flex items-center justify-between gap-2">
								<span class="font-medium">{kw.keyword}</span>
								<span class="badge badge-sm {positionBadge(kw.position)}">
									#{kw.position}
								</span>
							</div>
							<div class="flex items-center gap-4 mt-2 text-xs text-base-content/50">
								{#if kw.search_volume != null}
									<span>{kw.search_volume.toLocaleString()} vol</span>
								{/if}
								{#if kw.url}
									<span class="font-mono truncate">{truncateUrl(kw.url)}</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop Table -->
			<div class="hidden md:block card bg-base-100 border border-base-300 overflow-x-auto">
				<table class="table">
					<thead>
						<tr class="bg-base-200">
							<th>Keyword</th>
							<th class="text-right">Position</th>
							<th class="text-right">Search Volume</th>
							<th>Ranking URL</th>
						</tr>
					</thead>
					<tbody>
						{#each rankings as kw, i (i)}
							<tr>
								<td class="font-medium">{kw.keyword}</td>
								<td class="text-right">
									<span class={positionColor(kw.position)}>#{kw.position}</span>
								</td>
								<td class="text-right text-sm">
									{kw.search_volume != null ? kw.search_volume.toLocaleString() : "—"}
								</td>
								<td>
									{#if kw.url}
										<span class="text-sm font-mono text-base-content/60" title={kw.url}>
											{truncateUrl(kw.url)}
										</span>
									{:else}
										<span class="text-base-content/30">--</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body items-center text-center py-8">
					<p class="text-base-content/60">No ranking keywords data available yet.</p>
				</div>
			</div>
		{/if}
	{/if}
</div>

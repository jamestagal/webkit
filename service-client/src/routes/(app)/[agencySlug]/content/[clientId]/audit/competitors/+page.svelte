<script lang="ts">
	import { page } from "$app/state";
	import { ArrowLeft, Globe, Users, TrendingUp } from "lucide-svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);
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
		<h2 class="text-xl font-semibold">Competitor Analysis</h2>
	</div>

	{#if !data.competitors || data.competitors.length === 0}
		<!-- No Data -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
					<Users class="h-8 w-8 text-base-content/30" />
				</div>
				<h3 class="text-lg font-semibold">No competitor data</h3>
				<p class="text-base-content/60 max-w-sm">
					Run an SEO audit with competitor domains configured to see how this client compares.
				</p>
				<a href="/{agencySlug}/content/{clientId}/audit" class="btn btn-primary mt-4">
					Go to Audit
				</a>
			</div>
		</div>
	{:else}
		<!-- Competitor Cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each data.competitors as competitor (competitor.id)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<!-- Domain Header -->
						<div class="flex items-center gap-2 mb-3">
							<Globe class="h-5 w-5 text-primary shrink-0" />
							<h3 class="font-semibold text-lg truncate">{competitor.competitor_domain}</h3>
						</div>

						<!-- Metrics Grid -->
						<div class="grid grid-cols-2 gap-3">
							<div class="p-2 bg-base-200/50 rounded-lg">
								<div class="text-xs text-base-content/50 uppercase">Domain Rank</div>
								<div class="text-xl font-bold">{competitor.domain_rank ?? "—"}</div>
							</div>
							<div class="p-2 bg-base-200/50 rounded-lg">
								<div class="text-xs text-base-content/50 uppercase">Backlinks</div>
								<div class="text-xl font-bold">{(competitor.total_backlinks ?? 0).toLocaleString()}</div>
							</div>
							<div class="p-2 bg-base-200/50 rounded-lg">
								<div class="text-xs text-base-content/50 uppercase">Ref. Domains</div>
								<div class="text-xl font-bold">{(competitor.referring_domains ?? 0).toLocaleString()}</div>
							</div>
							<div class="p-2 bg-base-200/50 rounded-lg">
								<div class="text-xs text-base-content/50 uppercase">Keywords</div>
								<div class="text-xl font-bold">{(competitor.total_ranking_keywords ?? 0).toLocaleString()}</div>
							</div>
						</div>

						<!-- Traffic -->
						<div class="flex items-center gap-2 mt-3 pt-3 border-t border-base-200">
							<TrendingUp class="h-4 w-4 text-base-content/40" />
							<span class="text-sm text-base-content/60">Est. Traffic:</span>
							<span class="font-medium">{(competitor.estimated_traffic ?? 0).toLocaleString()}</span>
						</div>

						<!-- Keyword Overlap -->
						<div class="flex items-center gap-4 mt-2 text-sm">
							<div>
								<span class="text-base-content/50">Common:</span>
								<span class="font-medium text-info">{competitor.common_keywords ?? 0}</span>
							</div>
							<div>
								<span class="text-base-content/50">Unique:</span>
								<span class="font-medium text-accent">{competitor.unique_keywords ?? 0}</span>
							</div>
						</div>

						<!-- Comparison Details (if available) -->
						{#if competitor.comparison && Object.keys(competitor.comparison).length > 0}
							<div class="mt-3 pt-3 border-t border-base-200">
								<div class="text-xs text-base-content/50 uppercase tracking-wide mb-2">Comparison</div>
								<div class="space-y-1">
									{#each Object.entries(competitor.comparison) as [key, val]}
										<div class="flex items-center justify-between text-sm">
											<span class="text-base-content/60 capitalize">{key.replace(/_/g, " ")}</span>
											<span class="font-medium">{val}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Summary Table (Desktop) -->
		{#if data.competitors.length > 1}
			<div class="hidden md:block card bg-base-100 border border-base-300 overflow-x-auto">
				<div class="card-body">
					<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-3">
						Comparison Overview
					</h3>
					<table class="table table-sm">
						<thead>
							<tr class="bg-base-200">
								<th>Domain</th>
								<th class="text-right">Rank</th>
								<th class="text-right">Backlinks</th>
								<th class="text-right">Ref. Domains</th>
								<th class="text-right">Keywords</th>
								<th class="text-right">Traffic</th>
								<th class="text-right">Common KW</th>
								<th class="text-right">Unique KW</th>
							</tr>
						</thead>
						<tbody>
							{#each data.competitors as c (c.id)}
								<tr>
									<td class="font-mono text-sm">{c.competitor_domain}</td>
									<td class="text-right">{c.domain_rank ?? "—"}</td>
									<td class="text-right">{(c.total_backlinks ?? 0).toLocaleString()}</td>
									<td class="text-right">{(c.referring_domains ?? 0).toLocaleString()}</td>
									<td class="text-right">{(c.total_ranking_keywords ?? 0).toLocaleString()}</td>
									<td class="text-right">{(c.estimated_traffic ?? 0).toLocaleString()}</td>
									<td class="text-right text-info">{c.common_keywords ?? 0}</td>
									<td class="text-right text-accent">{c.unique_keywords ?? 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

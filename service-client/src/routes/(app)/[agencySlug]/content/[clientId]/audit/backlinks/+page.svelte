<script lang="ts">
	import { page } from "$app/state";
	import { ArrowLeft, Link2, Globe } from "lucide-svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	type ReferringDomain = {
		domain: string;
		backlinks: number;
		rank?: number;
	};

	let referringDomains = $derived(
		(data.backlinks?.top_referring_domains ?? []) as ReferringDomain[],
	);

	let linkTypeEntries = $derived(
		Object.entries(data.backlinks?.link_type_distribution ?? {}),
	);

	function spamColor(score: number): string {
		if (score <= 30) return "text-success";
		if (score <= 60) return "text-warning";
		return "text-error";
	}

	function dofollowPercent(dofollow: number, nofollow: number): number {
		const total = dofollow + nofollow;
		if (total === 0) return 0;
		return Math.round((dofollow / total) * 100);
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
		<h2 class="text-xl font-semibold">Backlink Profile</h2>
	</div>

	{#if !data.backlinks}
		<!-- No Data -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
					<Link2 class="h-8 w-8 text-base-content/30" />
				</div>
				<h3 class="text-lg font-semibold">No backlink data</h3>
				<p class="text-base-content/60 max-w-sm">
					Run an SEO audit to analyze this client's backlink profile.
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
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Total Backlinks</div>
					<div class="text-2xl font-bold">{data.backlinks.total_backlinks.toLocaleString()}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Referring Domains</div>
					<div class="text-2xl font-bold">{data.backlinks.referring_domains.toLocaleString()}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Dofollow</div>
					<div class="text-2xl font-bold text-success">{data.backlinks.dofollow_links.toLocaleString()}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Nofollow</div>
					<div class="text-2xl font-bold text-base-content/60">{data.backlinks.nofollow_links.toLocaleString()}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Domain Rank</div>
					<div class="text-2xl font-bold">{data.backlinks.domain_rank ?? "—"}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Spam Score</div>
					<div class="text-2xl font-bold {spamColor(data.backlinks.spam_score)}">
						{data.backlinks.spam_score ?? "—"}
					</div>
				</div>
			</div>
		</div>

		<!-- Dofollow/Nofollow Ratio -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-3">
					Dofollow / Nofollow Ratio
				</h3>
				<div class="flex items-center gap-4">
					<div class="flex-1">
						<div class="flex justify-between text-sm mb-1">
							<span>Dofollow ({dofollowPercent(data.backlinks.dofollow_links, data.backlinks.nofollow_links)}%)</span>
							<span>Nofollow ({100 - dofollowPercent(data.backlinks.dofollow_links, data.backlinks.nofollow_links)}%)</span>
						</div>
						<progress
							class="progress progress-success w-full"
							value={dofollowPercent(data.backlinks.dofollow_links, data.backlinks.nofollow_links)}
							max="100"
						></progress>
					</div>
				</div>
			</div>
		</div>

		<!-- Top Referring Domains -->
		{#if referringDomains.length > 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-3">
						Top Referring Domains
					</h3>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr class="bg-base-200">
									<th>Domain</th>
									<th class="text-right">Backlinks</th>
									<th class="text-right">Rank</th>
								</tr>
							</thead>
							<tbody>
								{#each referringDomains as rd}
									<tr>
										<td class="font-mono text-sm">
											<div class="flex items-center gap-2">
												<Globe class="h-3 w-3 text-base-content/40 shrink-0" />
												{rd.domain}
											</div>
										</td>
										<td class="text-right">{rd.backlinks.toLocaleString()}</td>
										<td class="text-right">{rd.rank ?? "—"}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- Link Type Distribution -->
		{#if linkTypeEntries.length > 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-3">
						Link Type Distribution
					</h3>
					<div class="space-y-2">
						{#each linkTypeEntries as [type, value]}
							<div class="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
								<span class="text-sm capitalize">{type.replace(/_/g, " ")}</span>
								<span class="font-medium text-sm">{value}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

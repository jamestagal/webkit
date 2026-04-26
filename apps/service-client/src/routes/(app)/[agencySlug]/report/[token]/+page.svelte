<script lang="ts">
	import type { PageData } from './$types';
	import ReportHeader from '$lib/components/audit/ReportHeader.svelte';
	import FooterCTABanner from '$lib/components/audit/FooterCTABanner.svelte';
	import ReportSidebar from '$lib/components/audit/ReportSidebar.svelte';
	import ReportSection from '$lib/components/audit/ReportSection.svelte';
	import SectionCard from '$lib/components/audit/SectionCard.svelte';
	import ScoreDonut from '$lib/components/audit/ScoreDonut.svelte';
	import ScoreProgressBar from '$lib/components/audit/ScoreProgressBar.svelte';
	import { formatDate } from '$lib/utils/formatting';

	let { data }: { data: PageData } = $props();

	let agency = $derived(data.agency);

	// Sidebar section definitions — only built when not expired
	let sections = $derived(
		data.expired
			? []
			: [
					{ id: 'overall', label: 'Overall', score: data.audit?.overallScore ?? null },
					{ id: 'technical', label: 'Technical', score: data.audit?.technicalScore ?? null },
					{ id: 'keywords', label: 'Keywords', score: data.audit?.keywordScore ?? null },
					{ id: 'backlinks', label: 'Backlinks', score: data.audit?.backlinkScore ?? null },
					{ id: 'competitors', label: 'Competitors', score: null },
					{ id: 'performance', label: 'Performance', score: null },
				],
	);

	// Keyword helpers — rankingKeywords is JSONB (unknown[] from Drizzle)
	type RankingKeyword = {
		keyword?: string;
		position?: number;
		search_volume?: number;
		url?: string;
	};

	function parseKeywords(raw: unknown): RankingKeyword[] {
		if (!Array.isArray(raw)) return [];
		return raw.slice(0, 10).map((k) => {
			if (k && typeof k === 'object') return k as RankingKeyword;
			return {};
		});
	}

	let topKeywords = $derived(data.expired ? [] : parseKeywords(data.keyword?.rankingKeywords));

	// Top referring domains helper
	type ReferringDomain = { domain?: string; backlinks?: number; domain_rank?: number };

	function parseReferringDomains(raw: unknown): ReferringDomain[] {
		if (!Array.isArray(raw)) return [];
		return raw.slice(0, 5).map((d) => (d && typeof d === 'object' ? (d as ReferringDomain) : {}));
	}

	let topDomains = $derived(data.expired ? [] : parseReferringDomains(data.backlink?.topReferringDomains));

	// Performance data (stored as JSONB on the audit row)
	type PerfData = {
		performance?: number;
		accessibility?: number;
		bestPractices?: number;
		seo?: number;
		loadTime?: string;
		auditedUrl?: string;
	};

	let perfData = $derived((): PerfData | null => {
		if (data.expired) return null;
		const raw = data.audit?.performanceData;
		if (!raw || typeof raw !== 'object') return null;
		return raw as PerfData;
	});

	// Issues — top 5 critical/warning
	let topIssues = $derived(
		data.expired
			? []
			: (data.issues ?? [])
					.filter((i) => i.severity === 'critical' || i.severity === 'warning')
					.slice(0, 5),
	);

	function severityClass(s: string): string {
		if (s === 'critical') return 'badge-error';
		if (s === 'warning') return 'badge-warning';
		return 'badge-ghost';
	}

	function perfScoreColor(score: number | undefined): string {
		if (score == null) return 'text-base-content/40';
		if (score >= 80) return 'text-success';
		if (score >= 60) return 'text-warning';
		return 'text-error';
	}
</script>

<svelte:head>
	<title>{agency.name} — SEO Audit Report</title>
</svelte:head>

<ReportHeader {agency} client={data.expired ? null : data.client} />

{#if data.expired}
	<!-- Expired / unavailable state -->
	<main class="mx-auto max-w-2xl px-6 py-20 text-center">
		<div class="rounded-xl border border-base-300 bg-base-200 p-10">
			<h1 class="mb-3 text-2xl font-semibold" style="color: var(--agency-primary);">
				This report is no longer available
			</h1>
			<p class="text-base-content/70">
				The share link for this {agency.name} SEO audit has expired. Contact the agency for a new report.
			</p>
			{#if agency.website}
				<a
					href={agency.website}
					target="_blank"
					rel="noopener noreferrer"
					class="btn mt-8 border-none text-white"
					style="background: var(--agency-accent-gradient, var(--agency-accent, var(--agency-primary)));"
				>
					Contact {agency.name}
				</a>
			{/if}
		</div>
	</main>
{:else}
	<!-- Full report layout -->
	<div class="mx-auto max-w-6xl px-4 py-8 lg:px-6">
		<h1 class="report-title">
			SEO Audit Report
			{#if data.client?.businessName}for {data.client.businessName}{/if}
		</h1>

		<!-- Mobile sidebar tabs appear at top via ReportSidebar internal markup -->
		<div class="lg:grid lg:grid-cols-[12rem_1fr] lg:gap-8">
			<ReportSidebar {sections} />

			<main class="mt-6 space-y-12 lg:mt-0">
				<!-- ── Overall ─────────────────────────────────────────── -->
				<ReportSection
					id="overall"
					title="Overall Score"
					intro="A combined score across technical health, content quality, keyword performance, backlinks, and page speed."
				>
					<div class="flex flex-col gap-6 lg:flex-row lg:items-start">
						<div class="flex flex-col items-center gap-2 lg:w-48 lg:shrink-0">
							<ScoreDonut score={data.audit?.overallScore ?? null} size="lg" label="Overall" />
							{#if data.audit?.completedAt}
								<p class="text-xs text-base-content/40">
									Audited {formatDate(data.audit.completedAt, 'medium')}
								</p>
							{/if}
						</div>
						<!-- 2×3 sub-score grid — §7.main_grading_card.sub_score_cards -->
						<div class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							<ScoreProgressBar label="Technical" score={data.audit?.technicalScore ?? null} />
							<ScoreProgressBar label="Content" score={data.audit?.contentScore ?? null} />
							<ScoreProgressBar label="Keywords" score={data.audit?.keywordScore ?? null} />
							<ScoreProgressBar label="Backlinks" score={data.audit?.backlinkScore ?? null} />
							<ScoreProgressBar label="Performance" score={perfData()?.performance ?? null} />
							<ScoreProgressBar label="Competitors" score={null} />
						</div>
					</div>

					<!-- Quick stats -->
					<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div class="rounded-lg bg-base-200 p-3 text-center">
							<p class="text-2xl font-bold text-error">{data.audit?.criticalIssues ?? 0}</p>
							<p class="text-xs text-base-content/60">Critical</p>
						</div>
						<div class="rounded-lg bg-base-200 p-3 text-center">
							<p class="text-2xl font-bold text-warning">{data.audit?.warningIssues ?? 0}</p>
							<p class="text-xs text-base-content/60">Warnings</p>
						</div>
						<div class="rounded-lg bg-base-200 p-3 text-center">
							<p class="text-2xl font-bold text-success">{data.audit?.passedChecks ?? 0}</p>
							<p class="text-xs text-base-content/60">Passed</p>
						</div>
						<div class="rounded-lg bg-base-200 p-3 text-center">
							<p class="text-2xl font-bold text-info">{data.audit?.opportunities ?? 0}</p>
							<p class="text-xs text-base-content/60">Opportunities</p>
						</div>
					</div>
				</ReportSection>

				<!-- ── Technical ──────────────────────────────────────── -->
				<ReportSection
					id="technical"
					title="Technical Issues"
					intro="The most impactful issues found during the technical crawl."
				>
					<SectionCard title="Top Issues" score={data.audit?.technicalScore ?? null}>
						{#if topIssues.length === 0}
							<p class="text-sm text-base-content/50">No issues found.</p>
						{:else}
							<ul class="divide-y divide-base-200">
								{#each topIssues as issue (issue.id)}
									<li class="py-3">
										<div class="flex items-start gap-3">
											<span class="badge badge-sm mt-0.5 shrink-0 {severityClass(issue.severity)} capitalize">
												{issue.severity}
											</span>
											<div class="min-w-0">
												<p class="text-sm font-medium leading-snug">{issue.title}</p>
												{#if issue.description}
													<p class="mt-0.5 text-xs text-base-content/60 line-clamp-2">{issue.description}</p>
												{/if}
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</SectionCard>
				</ReportSection>

				<!-- ── Keywords ───────────────────────────────────────── -->
				<ReportSection
					id="keywords"
					title="Keyword Profile"
					intro="Organic keyword rankings and traffic estimates."
				>
					<SectionCard title="Keyword Summary" score={data.audit?.keywordScore ?? null}>
						{#if !data.keyword}
							<p class="text-sm text-base-content/50">No keyword data available.</p>
						{:else}
							<div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold">{data.keyword.totalRankingKeywords ?? 0}</p>
									<p class="text-xs text-base-content/60">Ranking</p>
								</div>
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold text-success">{data.keyword.keywordsTop3 ?? 0}</p>
									<p class="text-xs text-base-content/60">Top 3</p>
								</div>
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold text-info">{data.keyword.keywordsTop10 ?? 0}</p>
									<p class="text-xs text-base-content/60">Top 10</p>
								</div>
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold">{data.keyword.estimatedTraffic ?? 0}</p>
									<p class="text-xs text-base-content/60">Est. Traffic</p>
								</div>
							</div>

							{#if topKeywords.length > 0}
								<div class="overflow-x-auto">
									<table class="table table-sm">
										<thead>
											<tr class="bg-base-200">
												<th>Keyword</th>
												<th class="text-right">Position</th>
												<th class="text-right">Volume</th>
											</tr>
										</thead>
										<tbody>
											{#each topKeywords as kw, i (i)}
												<tr>
													<td class="text-sm">{kw.keyword ?? '—'}</td>
													<td class="text-right text-sm font-medium">{kw.position ?? '—'}</td>
													<td class="text-right text-sm text-base-content/60">{kw.search_volume ?? '—'}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{:else}
								<p class="text-sm text-base-content/50">No ranking keyword details available.</p>
							{/if}
						{/if}
					</SectionCard>
				</ReportSection>

				<!-- ── Backlinks ──────────────────────────────────────── -->
				<ReportSection
					id="backlinks"
					title="Backlink Profile"
					intro="External links pointing to your site and the domains behind them."
				>
					<SectionCard title="Backlinks" score={data.audit?.backlinkScore ?? null}>
						{#if !data.backlink}
							<p class="text-sm text-base-content/50">No backlink data available.</p>
						{:else}
							<div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold">{data.backlink.totalBacklinks ?? 0}</p>
									<p class="text-xs text-base-content/60">Total Links</p>
								</div>
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold">{data.backlink.referringDomains ?? 0}</p>
									<p class="text-xs text-base-content/60">Domains</p>
								</div>
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold text-success">{data.backlink.dofollowLinks ?? 0}</p>
									<p class="text-xs text-base-content/60">Dofollow</p>
								</div>
								<div class="rounded-lg bg-base-200 p-3 text-center">
									<p class="text-xl font-bold text-base-content/60">{data.backlink.nofollowLinks ?? 0}</p>
									<p class="text-xs text-base-content/60">Nofollow</p>
								</div>
							</div>

							{#if data.backlink.domainRank != null}
								<p class="mb-3 text-sm text-base-content/70">
									Domain Rank: <span class="font-semibold">{data.backlink.domainRank.toFixed(1)}</span>
									{#if data.backlink.spamScore != null}
										&nbsp;&middot;&nbsp; Spam Score: <span class="font-semibold">{data.backlink.spamScore.toFixed(1)}</span>
									{/if}
								</p>
							{/if}

							{#if topDomains.length > 0}
								<div class="overflow-x-auto">
									<table class="table table-sm">
										<thead>
											<tr class="bg-base-200">
												<th>Domain</th>
												<th class="text-right">Links</th>
												<th class="text-right">DR</th>
											</tr>
										</thead>
										<tbody>
											{#each topDomains as d, i (i)}
												<tr>
													<td class="text-sm">{d.domain ?? '—'}</td>
													<td class="text-right text-sm">{d.backlinks ?? '—'}</td>
													<td class="text-right text-sm text-base-content/60">{d.domain_rank ?? '—'}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						{/if}
					</SectionCard>
				</ReportSection>

				<!-- ── Competitors ────────────────────────────────────── -->
				<ReportSection
					id="competitors"
					title="Competitor Analysis"
					intro="How your site compares to key competitors in the same space."
				>
					<SectionCard title="Competitors">
						{#if !data.competitors || data.competitors.length === 0}
							<p class="text-sm text-base-content/50">No competitor data available.</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="table table-sm">
									<thead>
										<tr class="bg-base-200">
											<th>Domain</th>
											<th class="text-right">DR</th>
											<th class="text-right">Backlinks</th>
											<th class="text-right">Keywords</th>
											<th class="text-right">Traffic</th>
										</tr>
									</thead>
									<tbody>
										{#each data.competitors as comp (comp.id)}
											<tr>
												<td class="text-sm font-medium">{comp.competitorDomain}</td>
												<td class="text-right text-sm">{comp.domainRank != null ? comp.domainRank.toFixed(0) : '—'}</td>
												<td class="text-right text-sm">{comp.totalBacklinks ?? '—'}</td>
												<td class="text-right text-sm">{comp.totalRankingKeywords ?? '—'}</td>
												<td class="text-right text-sm">{comp.estimatedTraffic ?? '—'}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</SectionCard>
				</ReportSection>

				<!-- ── Performance ────────────────────────────────────── -->
				<ReportSection
					id="performance"
					title="Performance"
					intro="PageSpeed Insights scores for this site."
				>
					<SectionCard title="PageSpeed Scores">
						{#if !perfData()}
							<p class="text-sm text-base-content/50">No performance data available.</p>
						{:else}
							{@const perf = perfData()}
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div class="flex flex-col items-center gap-1">
									<p class="text-3xl font-bold {perfScoreColor(perf?.performance)}">{perf?.performance ?? '—'}</p>
									<p class="text-xs text-base-content/60">Performance</p>
								</div>
								<div class="flex flex-col items-center gap-1">
									<p class="text-3xl font-bold {perfScoreColor(perf?.accessibility)}">{perf?.accessibility ?? '—'}</p>
									<p class="text-xs text-base-content/60">Accessibility</p>
								</div>
								<div class="flex flex-col items-center gap-1">
									<p class="text-3xl font-bold {perfScoreColor(perf?.bestPractices)}">{perf?.bestPractices ?? '—'}</p>
									<p class="text-xs text-base-content/60">Best Practices</p>
								</div>
								<div class="flex flex-col items-center gap-1">
									<p class="text-3xl font-bold {perfScoreColor(perf?.seo)}">{perf?.seo ?? '—'}</p>
									<p class="text-xs text-base-content/60">SEO</p>
								</div>
							</div>
							{#if perf?.loadTime}
								<p class="mt-4 text-center text-sm text-base-content/60">
									Load time: <span class="font-medium">{perf.loadTime}</span>
								</p>
							{/if}
						{/if}
					</SectionCard>
				</ReportSection>
			</main>
		</div>
	</div>
{/if}

<div class="mx-auto max-w-6xl px-4 lg:px-6">
	<FooterCTABanner {agency} />
</div>

<style>
	.report-title {
		font-size: clamp(1.375rem, 2.6vw, 2rem);
		font-weight: 600;
		color: var(--report-text-heading, #101828);
		margin: 8px 0 24px;
		line-height: 1.2;
		text-align: center;
		letter-spacing: -0.01em;
	}
</style>

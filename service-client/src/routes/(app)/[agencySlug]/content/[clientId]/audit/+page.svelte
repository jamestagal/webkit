<script lang="ts">
	import { page } from "$app/state";
	import { invalidateAll } from "$app/navigation";
	import { Search, AlertTriangle, BarChart3, Download } from "lucide-svelte";
	import { startAudit, getAudit } from "$lib/api/content-audit.remote";
	import { formatDate, formatRelativeTime } from "$lib/utils/formatting";
	import type { AuditResponse, AuditProgress } from "$lib/api/content-audit.types";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	let starting = $state(false);
	let polling = $state(false);
	let polledAudit = $state<AuditResponse | null>(null);

	let latestAudit = $derived(polledAudit ?? data.latestAudit);
	let isRunning = $derived(
		latestAudit != null &&
			(latestAudit.status === "pending" || latestAudit.status === "running"),
	);

	// Start polling automatically if audit is running on page load
	$effect(() => {
		if (isRunning && !polling) {
			polling = true;
		}
	});

	// Polling loop
	$effect(() => {
		if (!polling) return;
		const auditId = latestAudit?.id;
		if (!auditId) {
			polling = false;
			return;
		}
		const interval = setInterval(async () => {
			try {
				const result = await getAudit(auditId);
				polledAudit = result;
				if (result.status === "complete" || result.status === "failed") {
					polling = false;
					await invalidateAll();
				}
			} catch {
				// keep polling
			}
		}, 3000);
		return () => clearInterval(interval);
	});

	async function handleStartAudit() {
		starting = true;
		try {
			const cid = data.clientId;
			const result = await startAudit(cid);
			// Start polling the new audit
			polledAudit = {
				id: result.id,
				agency_id: "",
				client_id: cid,
				crawl_job_id: "",
				status: "pending",
				overall_score: null,
				technical_score: null,
				content_score: null,
				backlink_score: null,
				keyword_score: null,
				total_pages: 0,
				critical_issues: 0,
				warning_issues: 0,
				passed_checks: 0,
				opportunities: 0,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			polling = true;
		} catch {
			// Error starting audit
		} finally {
			starting = false;
		}
	}

	// Progress tracking for running audits
	const AUDIT_SECTIONS = ["technical", "backlinks", "keywords", "competitors", "performance", "scoring"] as const;
	const SECTION_LABELS: Record<string, string> = {
		technical: "Technical Audit",
		backlinks: "Backlink Analysis",
		keywords: "Keyword Analysis",
		competitors: "Competitor Analysis",
		performance: "PageSpeed Insights",
		scoring: "Calculating Scores",
	};

	let progress = $derived(latestAudit?.progress as AuditProgress | undefined);
	let completedSections = $derived(() => {
		if (!progress) return 0;
		return Object.values(progress).filter(
			(s) => s.status === "complete" || s.status === "skipped" || s.status === "failed",
		).length;
	});
	let totalSections = $derived(() => {
		if (!progress) return 0;
		return Object.keys(progress).length;
	});
	let progressPercent = $derived(
		totalSections() > 0 ? Math.round((completedSections() / totalSections()) * 100) : 0,
	);

	function scoreColor(score: number | null): string {
		if (score == null) return "text-base-content/50";
		if (score >= 70) return "text-success";
		if (score >= 40) return "text-warning";
		return "text-error";
	}

	function scoreProgressClass(score: number | null): string {
		if (score == null) return "progress";
		if (score >= 70) return "progress progress-success";
		if (score >= 40) return "progress progress-warning";
		return "progress progress-error";
	}

	let downloading = $state(false);

	async function downloadReport() {
		if (!latestAudit?.id) return;
		downloading = true;
		try {
			const res = await fetch(`/api/content/audit/${latestAudit.id}/report`, {
				method: "POST",
			});
			if (!res.ok) throw new Error("Failed to generate report");
			const blob = await res.blob();
			// Extract filename from Content-Disposition header if available
			const disposition = res.headers.get("Content-Disposition") || "";
			const filenameMatch = disposition.match(/filename="(.+?)"/);
			const filename = filenameMatch?.[1] || "seo-audit-report.pdf";
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Download report error:", err);
		} finally {
			downloading = false;
		}
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case "completed":
				return "badge-success";
			case "failed":
				return "badge-error";
			case "running":
				return "badge-info";
			case "pending":
				return "badge-warning";
			default:
				return "badge-ghost";
		}
	}
</script>

<div class="space-y-6">
	{#if !latestAudit}
		<!-- No Audit — Empty State -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-16">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
					<Search class="h-8 w-8 text-base-content/30" />
				</div>
				<h2 class="text-xl font-semibold mb-2">No SEO Audit</h2>
				<p class="text-base-content/60 max-w-md mb-6">
					Run a comprehensive SEO audit to identify technical issues, keyword gaps, and
					competitor insights. Results feed into branded reports and AI proposal generation.
				</p>
				<button
					type="button"
					class="btn btn-primary"
					disabled={starting}
					onclick={handleStartAudit}
				>
					{#if starting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Start SEO Audit
				</button>
			</div>
		</div>
	{:else if isRunning}
		<!-- Audit Running — Section Progress -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body py-10">
				<div class="flex flex-col items-center text-center mb-6">
					<span class="loading loading-spinner loading-lg text-primary mb-3"></span>
					<h2 class="text-xl font-semibold">Audit in Progress</h2>
				</div>

				{#if progress && Object.keys(progress).length > 0}
					<div class="max-w-md mx-auto w-full space-y-3">
						{#each AUDIT_SECTIONS as section}
							{@const sp = progress[section]}
							{#if sp}
								<div class="flex items-center gap-3">
									<div class="w-5 flex justify-center">
										{#if sp.status === "waiting"}
											<span class="text-base-content/30 text-sm">&#9679;</span>
										{:else if sp.status === "running"}
											<span class="loading loading-spinner loading-xs text-primary"></span>
										{:else if sp.status === "complete"}
											<span class="text-success text-sm">&#10003;</span>
										{:else if sp.status === "failed"}
											<span class="text-error text-sm">&#10007;</span>
										{:else if sp.status === "skipped"}
											<span class="text-base-content/30 text-sm">&#8212;</span>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex justify-between items-baseline">
											<span class="text-sm font-medium {sp.status === 'waiting' ? 'text-base-content/40' : ''}">
												{SECTION_LABELS[section] ?? section}
											</span>
										</div>
										{#if sp.message}
											<p class="text-xs text-base-content/50 truncate">{sp.message}</p>
										{/if}
									</div>
								</div>
							{/if}
						{/each}
					</div>

					<!-- Progress bar -->
					<div class="max-w-md mx-auto w-full mt-6">
						<div class="flex justify-between text-xs text-base-content/50 mb-1">
							<span>{completedSections()} of {totalSections()} sections</span>
							<span>{progressPercent}%</span>
						</div>
						<progress class="progress progress-primary w-full" value={progressPercent} max="100"></progress>
					</div>
				{:else}
					<p class="text-base-content/60 text-center text-sm">
						Starting audit...
					</p>
				{/if}
			</div>
		</div>
	{:else if latestAudit.status === "failed"}
		<!-- Audit Failed -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-16">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-error/10 mb-4">
					<AlertTriangle class="h-8 w-8 text-error" />
				</div>
				<h2 class="text-xl font-semibold mb-2">Audit Failed</h2>
				<p class="text-base-content/60 max-w-md mb-6">
					The SEO audit encountered an error. You can try running it again.
				</p>
				<button
					type="button"
					class="btn btn-primary"
					disabled={starting}
					onclick={handleStartAudit}
				>
					{#if starting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Retry Audit
				</button>
			</div>
		</div>
	{:else}
		<!-- Audit Complete -->

		<!-- Overall Score + Category Scores -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Overall Score -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body items-center text-center">
					<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide">Overall Score</h3>
					<div class="text-6xl font-bold {scoreColor(latestAudit.overall_score)} mt-2">
						{latestAudit.overall_score ?? "—"}
					</div>
					<div class="text-sm text-base-content/50 mt-1">out of 100</div>
					{#if latestAudit.completed_at}
						<div class="text-xs text-base-content/40 mt-2">
							Completed {formatRelativeTime(latestAudit.completed_at)}
						</div>
					{/if}
				</div>
			</div>

			<!-- Category Scores -->
			<div class="card bg-base-100 border border-base-300 lg:col-span-2">
				<div class="card-body">
					<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-4">Category Scores</h3>
					<div class="space-y-4">
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span>Technical</span>
								<span class={scoreColor(latestAudit.technical_score)}>
									{latestAudit.technical_score ?? "—"}/100
								</span>
							</div>
							<progress
								class="{scoreProgressClass(latestAudit.technical_score)} w-full"
								value={latestAudit.technical_score ?? 0}
								max="100"
							></progress>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span>Content</span>
								<span class={scoreColor(latestAudit.content_score)}>
									{latestAudit.content_score ?? "—"}/100
								</span>
							</div>
							<progress
								class="{scoreProgressClass(latestAudit.content_score)} w-full"
								value={latestAudit.content_score ?? 0}
								max="100"
							></progress>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span>Backlinks</span>
								<span class={scoreColor(latestAudit.backlink_score)}>
									{latestAudit.backlink_score ?? "—"}/100
								</span>
							</div>
							<progress
								class="{scoreProgressClass(latestAudit.backlink_score)} w-full"
								value={latestAudit.backlink_score ?? 0}
								max="100"
							></progress>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span>Keywords</span>
								<span class={scoreColor(latestAudit.keyword_score)}>
									{latestAudit.keyword_score ?? "—"}/100
								</span>
							</div>
							<progress
								class="{scoreProgressClass(latestAudit.keyword_score)} w-full"
								value={latestAudit.keyword_score ?? 0}
								max="100"
							></progress>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Quick Stats -->
		<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Pages</div>
					<div class="text-2xl font-bold">{latestAudit.total_pages}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Critical</div>
					<div class="text-2xl font-bold text-error">{latestAudit.critical_issues}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Warnings</div>
					<div class="text-2xl font-bold text-warning">{latestAudit.warning_issues}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Passed</div>
					<div class="text-2xl font-bold text-success">{latestAudit.passed_checks}</div>
				</div>
			</div>
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<div class="text-xs text-base-content/50 uppercase tracking-wide">Opportunities</div>
					<div class="text-2xl font-bold text-info">{latestAudit.opportunities}</div>
				</div>
			</div>
		</div>

		<!-- Sub-navigation to detail pages -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<a
				href="/{agencySlug}/content/{clientId}/audit/issues"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-4">
					<div class="flex items-center gap-2">
						<AlertTriangle class="h-4 w-4 text-error" />
						<span class="text-sm text-base-content/60">Issues</span>
					</div>
					<div class="text-2xl font-bold mt-1">
						{(latestAudit.critical_issues ?? 0) + (latestAudit.warning_issues ?? 0)}
					</div>
				</div>
			</a>
			<a
				href="/{agencySlug}/content/{clientId}/audit/backlinks"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-4">
					<div class="flex items-center gap-2">
						<BarChart3 class="h-4 w-4 text-accent" />
						<span class="text-sm text-base-content/60">Backlinks</span>
					</div>
					<div class="text-2xl font-bold mt-1">View</div>
				</div>
			</a>
			<a
				href="/{agencySlug}/content/{clientId}/audit/keywords"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-4">
					<div class="flex items-center gap-2">
						<Search class="h-4 w-4 text-info" />
						<span class="text-sm text-base-content/60">Keywords</span>
					</div>
					<div class="text-2xl font-bold mt-1">View</div>
				</div>
			</a>
			<a
				href="/{agencySlug}/content/{clientId}/audit/competitors"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-4">
					<div class="flex items-center gap-2">
						<BarChart3 class="h-4 w-4 text-secondary" />
						<span class="text-sm text-base-content/60">Competitors</span>
					</div>
					<div class="text-2xl font-bold mt-1">View</div>
				</div>
			</a>
		</div>

		<!-- Actions -->
		<div class="flex justify-end gap-2">
			<button
				type="button"
				class="btn btn-outline btn-sm"
				disabled={downloading}
				onclick={downloadReport}
			>
				{#if downloading}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					<Download class="h-4 w-4" />
				{/if}
				Download Report
			</button>
			<button
				type="button"
				class="btn btn-outline btn-sm"
				disabled={starting}
				onclick={handleStartAudit}
			>
				{#if starting}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				Run New Audit
			</button>
		</div>

		<!-- Audit History -->
		{#if data.audits.length > 1}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-3">Audit History</h3>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr class="bg-base-200">
									<th>Date</th>
									<th>Status</th>
									<th class="text-right">Score</th>
									<th class="text-right">Pages</th>
									<th class="text-right">Issues</th>
								</tr>
							</thead>
							<tbody>
								{#each data.audits as audit (audit.id)}
									<tr>
										<td class="text-sm">{formatDate(audit.createdAt, "medium")}</td>
										<td>
											<span class="badge badge-sm {statusBadgeClass(audit.status)} capitalize">
												{audit.status}
											</span>
										</td>
										<td class="text-right">
											<span class={scoreColor(audit.overallScore)}>
												{audit.overallScore ?? "—"}
											</span>
										</td>
										<td class="text-right text-sm">{audit.totalPages ?? 0}</td>
										<td class="text-right text-sm">
											{(audit.criticalIssues ?? 0) + (audit.warningIssues ?? 0)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

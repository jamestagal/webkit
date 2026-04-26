<script lang="ts">
	import { BarChart3, AlertTriangle, Copy } from 'lucide-svelte';

	type SEOSummaryData = {
		auditId: string;
		completedAt: Date | string | null;
		overallScore: number | null;
		technicalScore: number | null;
		contentScore: number | null;
		backlinkScore: number | null;
		keywordScore: number | null;
		totalPages: number | null;
		criticalIssues: number | null;
		warningIssues: number | null;
		passedChecks: number | null;
		opportunities: number | null;
		topIssues: Array<{
			title: string;
			description: string;
			category: string;
			severity: string;
			impact: string | null;
		}>;
	};

	let {
		seoSummary,
		onInsert
	}: {
		seoSummary: SEOSummaryData | null;
		onInsert?: (html: string) => void;
	} = $props();

	function scoreColor(score: number | null): string {
		if (score === null) return 'text-base-content/40';
		if (score >= 80) return 'text-success';
		if (score >= 50) return 'text-warning';
		return 'text-error';
	}

	function progressColor(score: number | null): string {
		if (score === null) return 'progress-ghost';
		if (score >= 80) return 'progress-success';
		if (score >= 50) return 'progress-warning';
		return 'progress-error';
	}

	function generateSummaryHTML(): string {
		if (!seoSummary) return '';
		const s = seoSummary;
		let html = `<h3>SEO Audit Summary</h3>`;
		html += `<p>Overall SEO Score: <strong>${s.overallScore ?? 'N/A'}/100</strong></p>`;
		html += `<ul>`;
		html += `<li>Technical: ${s.technicalScore ?? 'N/A'}/100</li>`;
		html += `<li>Content: ${s.contentScore ?? 'N/A'}/100</li>`;
		html += `<li>Backlinks: ${s.backlinkScore ?? 'N/A'}/100</li>`;
		html += `<li>Keywords: ${s.keywordScore ?? 'N/A'}/100</li>`;
		html += `</ul>`;
		if (s.topIssues.length > 0) {
			html += `<h4>Critical Issues Found</h4><ul>`;
			for (const issue of s.topIssues) {
				html += `<li><strong>${issue.title}</strong>: ${issue.description}</li>`;
			}
			html += `</ul>`;
		}
		html += `<p>${s.totalPages ?? 0} pages audited. ${s.criticalIssues ?? 0} critical issues, ${s.warningIssues ?? 0} warnings, ${s.passedChecks ?? 0} passed checks.</p>`;
		return html;
	}

	function handleInsert() {
		if (onInsert) {
			onInsert(generateSummaryHTML());
		}
	}

	const categories = $derived(
		seoSummary
			? [
					{ label: 'Technical', score: seoSummary.technicalScore },
					{ label: 'Content', score: seoSummary.contentScore },
					{ label: 'Backlinks', score: seoSummary.backlinkScore },
					{ label: 'Keywords', score: seoSummary.keywordScore }
				]
			: []
	);
</script>

<section class="card bg-base-100 shadow mx-2 lg:mx-0">
	<div class="card-body p-4 sm:p-6">
		<h2 class="card-title">
			<BarChart3 class="h-5 w-5" />
			SEO Audit Summary
		</h2>

		{#if !seoSummary}
			<!-- No audit available -->
			<div class="alert">
				<BarChart3 class="h-5 w-5 text-base-content/40" />
				<div>
					<p class="font-medium">No SEO audit available for this client</p>
					<p class="text-sm text-base-content/60">
						Run an SEO audit from the Content section to generate data that can be included in
						this proposal.
					</p>
				</div>
			</div>
		{:else}
			<!-- Overall Score -->
			<div class="flex items-center gap-6 mt-2">
				<div class="text-center">
					<div class="text-5xl font-bold {scoreColor(seoSummary.overallScore)}">
						{seoSummary.overallScore ?? '--'}
					</div>
					<div class="text-sm text-base-content/60 mt-1">Overall Score</div>
				</div>

				<!-- Category Scores -->
				<div class="flex-1 space-y-3">
					{#each categories as cat}
						<div class="flex items-center gap-3">
							<span class="text-sm w-20 shrink-0">{cat.label}</span>
							<progress
								class="progress {progressColor(cat.score)} flex-1"
								value={cat.score ?? 0}
								max="100"
							></progress>
							<span class="text-sm font-medium w-10 text-right {scoreColor(cat.score)}">
								{cat.score ?? '--'}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Quick Stats -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
				<div class="stat bg-base-200 rounded-lg p-3">
					<div class="stat-title text-xs">Pages</div>
					<div class="stat-value text-lg">{seoSummary.totalPages ?? 0}</div>
				</div>
				<div class="stat bg-error/10 rounded-lg p-3">
					<div class="stat-title text-xs">Critical</div>
					<div class="stat-value text-lg text-error">{seoSummary.criticalIssues ?? 0}</div>
				</div>
				<div class="stat bg-warning/10 rounded-lg p-3">
					<div class="stat-title text-xs">Warnings</div>
					<div class="stat-value text-lg text-warning">{seoSummary.warningIssues ?? 0}</div>
				</div>
				<div class="stat bg-success/10 rounded-lg p-3">
					<div class="stat-title text-xs">Passed</div>
					<div class="stat-value text-lg text-success">{seoSummary.passedChecks ?? 0}</div>
				</div>
			</div>

			<!-- Top Critical Issues -->
			{#if seoSummary.topIssues.length > 0}
				<div class="mt-4">
					<h3 class="font-semibold text-sm mb-2 flex items-center gap-1.5">
						<AlertTriangle class="h-4 w-4 text-error" />
						Top Critical Issues
					</h3>
					<div class="space-y-2">
						{#each seoSummary.topIssues as issue}
							<div class="rounded-lg border border-error/20 bg-error/5 px-3 py-2">
								<div class="flex items-start justify-between gap-2">
									<div>
										<p class="text-sm font-medium">{issue.title}</p>
										<p class="text-xs text-base-content/60 mt-0.5">{issue.description}</p>
									</div>
									<span class="badge badge-ghost badge-xs shrink-0">{issue.category}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Completed date -->
			{#if seoSummary.completedAt}
				<p class="text-xs text-base-content/50 mt-3">
					Audit completed: {new Date(seoSummary.completedAt).toLocaleDateString()}
				</p>
			{/if}

			<!-- Copy to Proposal button -->
			{#if onInsert}
				<div class="mt-4 pt-3 border-t border-base-200">
					<button type="button" class="btn btn-primary btn-sm" onclick={handleInsert}>
						<Copy class="h-4 w-4" />
						Copy to Executive Summary
					</button>
					<p class="text-xs text-base-content/50 mt-1">
						Inserts a formatted SEO summary into the Executive Summary section.
					</p>
				</div>
			{/if}
		{/if}
	</div>
</section>

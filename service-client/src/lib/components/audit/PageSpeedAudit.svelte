<script lang="ts">
	import type { PerformanceData, WebVitalMetric } from '$lib/server/schema';
	import { runPageSpeedAudit } from '$lib/api/consultation.remote';

	interface Props {
		consultationId: string;
		websiteUrl: string | null;
		existingData?: PerformanceData | null;
	}

	let { consultationId, websiteUrl, existingData = null }: Props = $props();

	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let performanceData = $state<PerformanceData | null>(existingData);

	// Derived score from data
	let score = $derived(performanceData?.performance ?? 0);

	// Score color based on value
	let scoreGrade = $derived<'good' | 'needs-improvement' | 'poor'>(
		score >= 90 ? 'good' : score >= 50 ? 'needs-improvement' : 'poor'
	);

	// Helper to get grade from any score
	function getGrade(s: number): 'good' | 'needs-improvement' | 'poor' {
		return s >= 90 ? 'good' : s >= 50 ? 'needs-improvement' : 'poor';
	}

	// All category scores for display
	let categoryScores = $derived([
		{ key: 'Performance', score: performanceData?.performance ?? 0 },
		{ key: 'Accessibility', score: performanceData?.accessibility ?? 0 },
		{ key: 'Best Practices', score: performanceData?.bestPractices ?? 0 },
		{ key: 'SEO', score: performanceData?.seo ?? 0 }
	]);

	// Run the audit
	async function handleRunAudit() {
		if (!websiteUrl) {
			error = 'No website URL found on this consultation';
			return;
		}

		error = null;
		isLoading = true;

		try {
			const result = await runPageSpeedAudit({ consultationId });
			performanceData = result;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to run audit';
			console.error('PageSpeed audit error:', err);
		} finally {
			isLoading = false;
		}
	}

	// Metric display info
	const metricInfo: Record<string, { name: string; description: string }> = {
		LCP: { name: 'Largest Contentful Paint', description: 'Loading performance' },
		CLS: { name: 'Cumulative Layout Shift', description: 'Visual stability' },
		INP: { name: 'Interaction to Next Paint', description: 'Interactivity' },
		FCP: { name: 'First Contentful Paint', description: 'Initial render' },
		TBT: { name: 'Total Blocking Time', description: 'Main thread work' },
		SI: { name: 'Speed Index', description: 'Content visibility' }
	};

	// Format the audit timestamp
	function formatAuditTime(isoString: string | undefined): string {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="audit-container">
	{#if !websiteUrl}
		<!-- No website URL -->
		<div class="empty-state">
			<div class="empty-icon">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
				</svg>
			</div>
			<p class="empty-text">Add a website URL to the consultation to analyze performance</p>
		</div>
	{:else}
		<!-- URL Header -->
		<div class="url-header">
			<span class="url-label">Analyzing</span>
			<a href={websiteUrl} target="_blank" rel="noopener noreferrer" class="url-link">
				{websiteUrl.replace(/^https?:\/\//, '')}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="external-icon">
					<path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clip-rule="evenodd" />
					<path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clip-rule="evenodd" />
				</svg>
			</a>
		</div>

		{#if error}
			<div class="error-banner">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		{#if performanceData?.performance}
			<!-- Results Dashboard -->
			<div class="dashboard">
				<!-- Hero Score Section -->
				<div class="score-hero" data-grade={scoreGrade}>
					<div class="score-content">
						<div class="score-number">
							<span class="score-value">{score}</span>
							<span class="score-max">/100</span>
						</div>
						<div class="score-label">
							{#if scoreGrade === 'good'}
								Excellent Performance
							{:else if scoreGrade === 'needs-improvement'}
								Needs Improvement
							{:else}
								Poor Performance
							{/if}
						</div>
					</div>
					<div class="score-bar">
						<div class="score-fill" style="width: {score}%"></div>
					</div>
				</div>

				<!-- Lighthouse Category Scores -->
				<div class="category-scores">
					{#each categoryScores as category, i}
						{@const grade = getGrade(category.score)}
						<div class="category-card" data-grade={grade} style="--delay: {i * 50}ms">
							<div class="category-score" data-grade={grade}>{category.score}</div>
							<div class="category-label">{category.key}</div>
						</div>
					{/each}
				</div>

				<!-- Core Web Vitals -->
				{#if performanceData.metrics}
					<div class="metrics-section">
						<h3 class="section-title">Core Web Vitals</h3>
						<div class="metrics-grid">
							{#each Object.entries(performanceData.metrics) as [key, metric], i}
								{#if metric}
									<div class="metric-card" data-status={metric.category} style="--delay: {i * 50}ms">
										<div class="metric-header">
											<span class="metric-key">{key}</span>
											<span class="metric-status" data-status={metric.category}>
												{metric.category === 'needs-improvement' ? 'needs work' : metric.category}
											</span>
										</div>
										<div class="metric-value">{metric.value}</div>
										<div class="metric-name">{metricInfo[key]?.description ?? key}</div>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recommendations -->
				{#if performanceData.recommendations && performanceData.recommendations.length > 0}
					<div class="recommendations-section">
						<h3 class="section-title">Optimization Opportunities</h3>
						<div class="recommendations-list">
							{#each performanceData.recommendations as recommendation, i}
								<div class="recommendation-item" style="--delay: {i * 30}ms">
									<div class="recommendation-icon">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
										</svg>
									</div>
									<span>{recommendation}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Footer -->
				<div class="audit-footer">
					{#if performanceData.auditedAt}
						<span class="audit-time">
							Analyzed {formatAuditTime(performanceData.auditedAt)}
						</span>
					{/if}
					<button class="rerun-btn" onclick={handleRunAudit} disabled={isLoading}>
						{#if isLoading}
							<span class="spinner"></span>
							Analyzing...
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clip-rule="evenodd" />
							</svg>
							Re-analyze
						{/if}
					</button>
				</div>
			</div>
		{:else}
			<!-- Initial State -->
			<div class="initial-state" class:loading={isLoading}>
				<div class="initial-visual">
					<div class="pulse-ring"></div>
					<div class="pulse-ring delay-1"></div>
					<div class="pulse-ring delay-2"></div>
					<div class="bolt-icon">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
							<path fill-rule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clip-rule="evenodd" />
						</svg>
					</div>
				</div>
				<h3 class="initial-title">Performance Analysis</h3>
				<p class="initial-description">
					Measure Core Web Vitals and get optimization recommendations powered by Google PageSpeed Insights
				</p>
				<button class="analyze-btn" onclick={handleRunAudit} disabled={isLoading}>
					{#if isLoading}
						<span class="spinner"></span>
						Analyzing website...
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
						</svg>
						Start Analysis
					{/if}
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* ===== Base Styles ===== */
	.audit-container {
		--color-good: #10b981;
		--color-good-bg: #10b98115;
		--color-warning: #f59e0b;
		--color-warning-bg: #f59e0b15;
		--color-poor: #ef4444;
		--color-poor-bg: #ef444415;
		--color-accent: #6366f1;
		--color-text: #1f2937;
		--color-text-muted: #6b7280;
		--color-border: #e5e7eb;
		--color-bg: #f9fafb;

		font-family: system-ui, -apple-system, sans-serif;
	}

	/* ===== Empty State ===== */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2.5rem 1rem;
		text-align: center;
	}

	.empty-icon {
		width: 3rem;
		height: 3rem;
		color: var(--color-text-muted);
		opacity: 0.4;
		margin-bottom: 1rem;
	}

	.empty-icon svg {
		width: 100%;
		height: 100%;
	}

	.empty-text {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		max-width: 280px;
	}

	/* ===== URL Header ===== */
	.url-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.url-label {
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.url-link {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-accent);
		text-decoration: none;
		transition: opacity 0.15s;
	}

	.url-link:hover {
		opacity: 0.8;
	}

	.external-icon {
		width: 0.875rem;
		height: 0.875rem;
		opacity: 0.7;
	}

	/* ===== Error Banner ===== */
	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-poor-bg);
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		color: var(--color-poor);
		font-size: 0.875rem;
	}

	.error-banner svg {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	/* ===== Score Hero ===== */
	.score-hero {
		background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
		border-radius: 1rem;
		padding: 1.75rem;
		margin-bottom: 1.5rem;
		position: relative;
		overflow: hidden;
	}

	.score-hero::before {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 200px;
		height: 200px;
		background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%);
		transform: translate(30%, -30%);
	}

	.score-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.score-number {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.score-value {
		font-size: 3.5rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.score-hero[data-grade="good"] .score-value {
		color: var(--color-good);
	}

	.score-hero[data-grade="needs-improvement"] .score-value {
		color: var(--color-warning);
	}

	.score-hero[data-grade="poor"] .score-value {
		color: var(--color-poor);
	}

	.score-max {
		font-size: 1.25rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.4);
	}

	.score-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.7);
		text-align: right;
	}

	.score-bar {
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		overflow: hidden;
	}

	.score-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.score-hero[data-grade="good"] .score-fill {
		background: linear-gradient(90deg, var(--color-good), #34d399);
	}

	.score-hero[data-grade="needs-improvement"] .score-fill {
		background: linear-gradient(90deg, var(--color-warning), #fbbf24);
	}

	.score-hero[data-grade="poor"] .score-fill {
		background: linear-gradient(90deg, var(--color-poor), #f87171);
	}

	/* ===== Category Scores ===== */
	.category-scores {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 480px) {
		.category-scores {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.category-card {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 1rem;
		text-align: center;
		animation: fadeSlideIn 0.4s ease-out backwards;
		animation-delay: var(--delay);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.category-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	.category-card[data-grade="good"] {
		border-color: var(--color-good);
	}

	.category-card[data-grade="needs-improvement"] {
		border-color: var(--color-warning);
	}

	.category-card[data-grade="poor"] {
		border-color: var(--color-poor);
	}

	.category-score {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;
		margin-bottom: 0.375rem;
	}

	.category-score[data-grade="good"] {
		color: var(--color-good);
	}

	.category-score[data-grade="needs-improvement"] {
		color: var(--color-warning);
	}

	.category-score[data-grade="poor"] {
		color: var(--color-poor);
	}

	.category-label {
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-muted);
	}

	/* ===== Metrics Section ===== */
	.metrics-section {
		margin-bottom: 1.5rem;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		margin-bottom: 0.875rem;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.metrics-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.metric-card {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 1rem;
		transition: transform 0.2s, box-shadow 0.2s;
		animation: fadeSlideIn 0.4s ease-out backwards;
		animation-delay: var(--delay);
	}

	.metric-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	.metric-card[data-status="good"] {
		border-color: var(--color-good);
		border-left-width: 3px;
	}

	.metric-card[data-status="needs-improvement"] {
		border-color: var(--color-warning);
		border-left-width: 3px;
	}

	.metric-card[data-status="poor"] {
		border-color: var(--color-poor);
		border-left-width: 3px;
	}

	.metric-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.metric-key {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.metric-status {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	.metric-status[data-status="good"] {
		background: var(--color-good-bg);
		color: var(--color-good);
	}

	.metric-status[data-status="needs-improvement"] {
		background: var(--color-warning-bg);
		color: var(--color-warning);
	}

	.metric-status[data-status="poor"] {
		background: var(--color-poor-bg);
		color: var(--color-poor);
	}

	.metric-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
		line-height: 1.2;
		margin-bottom: 0.25rem;
	}

	.metric-name {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	/* ===== Recommendations ===== */
	.recommendations-section {
		margin-bottom: 1.5rem;
	}

	.recommendations-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.recommendation-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text);
		animation: fadeSlideIn 0.3s ease-out backwards;
		animation-delay: var(--delay);
	}

	.recommendation-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-accent);
		flex-shrink: 0;
		margin-top: 0.0625rem;
	}

	.recommendation-icon svg {
		width: 100%;
		height: 100%;
	}

	/* ===== Footer ===== */
	.audit-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.audit-time {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.rerun-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.rerun-btn:hover:not(:disabled) {
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.rerun-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.rerun-btn svg {
		width: 1rem;
		height: 1rem;
	}

	/* ===== Initial State ===== */
	.initial-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem 1rem;
		text-align: center;
	}

	.initial-visual {
		position: relative;
		width: 100px;
		height: 100px;
		margin-bottom: 1.5rem;
	}

	.pulse-ring {
		position: absolute;
		inset: 0;
		border: 2px solid var(--color-accent);
		border-radius: 50%;
		opacity: 0;
		animation: pulse 2s ease-out infinite;
	}

	.pulse-ring.delay-1 {
		animation-delay: 0.5s;
	}

	.pulse-ring.delay-2 {
		animation-delay: 1s;
	}

	.initial-state.loading .pulse-ring {
		animation-duration: 1s;
	}

	.bolt-icon {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-accent), #818cf8);
		border-radius: 50%;
		color: white;
	}

	.bolt-icon svg {
		width: 40px;
		height: 40px;
	}

	.initial-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: 0.5rem;
	}

	.initial-description {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		max-width: 300px;
		line-height: 1.5;
		margin-bottom: 1.5rem;
	}

	.analyze-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: white;
		background: linear-gradient(135deg, var(--color-accent), #818cf8);
		border: none;
		border-radius: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
	}

	.analyze-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
	}

	.analyze-btn:disabled {
		opacity: 0.8;
		cursor: not-allowed;
	}

	.analyze-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	/* ===== Spinner ===== */
	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	/* ===== Animations ===== */
	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 0.6;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

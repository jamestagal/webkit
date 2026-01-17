<script lang="ts">
	/**
	 * Public Proposal View
	 *
	 * Client-facing proposal display with all sections:
	 * - Cover with agency branding
	 * - Performance analysis
	 * - Opportunity & issues
	 * - Package & pricing
	 * - Timeline & architecture
	 * - Contact info
	 * - Client response actions (accept/decline/request revision)
	 */

	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import {
		Check,
		X,
		Clock,
		Phone,
		Mail,
		Globe,
		MapPin,
		CheckCircle2,
		XCircle,
		RefreshCw,
		AlertCircle,
		ThumbsUp,
		ThumbsDown,
		Edit3
	} from 'lucide-svelte';
	import type {
		ChecklistItem,
		PerformanceData,
		RoiAnalysis,
		PerformanceStandard,
		ProposedPage,
		TimelinePhase,
		CustomPricing
	} from '$lib/server/schema';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const { proposal, agency, profile, selectedPackage, selectedAddons } = data;

	// Response form state
	let activeResponse = $state<'accept' | 'decline' | 'revision' | null>(null);
	let isSubmitting = $state(false);

	// Check if client can respond (only sent or viewed status)
	const canRespond = proposal.status === 'sent' || proposal.status === 'viewed';

	// Parse JSONB fields
	const performanceData = (proposal.performanceData as PerformanceData) || {};
	const currentIssues = (proposal.currentIssues as ChecklistItem[]) || [];
	const roiAnalysis = (proposal.roiAnalysis as RoiAnalysis) || {};
	const performanceStandards = (proposal.performanceStandards as PerformanceStandard[]) || [];
	const proposedPages = (proposal.proposedPages as ProposedPage[]) || [];
	const timeline = (proposal.timeline as TimelinePhase[]) || [];
	const customPricing = (proposal.customPricing as CustomPricing) || null;

	// Helpers
	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	/**
	 * Parse simple markdown to HTML with styled elements
	 */
	function parseMarkdown(text: string): string {
		if (!text) return '';

		return text
			// Escape HTML first
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			// Bold text: **text** or __text__
			.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-base-content">$1</strong>')
			.replace(/__([^_]+)__/g, '<strong class="font-semibold text-base-content">$1</strong>')
			// Split into lines for processing
			.split('\n')
			.map((line) => {
				const trimmed = line.trim();

				// Bullet points with • or - at start of line
				if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
					const content = trimmed.slice(2);
					return `<li class="flex items-start gap-3 py-1"><span class="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary/70"></span><span>${content}</span></li>`;
				}

				// Empty line becomes spacing
				if (trimmed === '') {
					return '<div class="h-4"></div>';
				}

				// Regular paragraph
				return `<p class="leading-relaxed">${line}</p>`;
			})
			.join('')
			// Wrap consecutive <li> elements in <ul>
			.replace(/(<li[^>]*>.*?<\/li>)+/g, (match) => `<ul class="space-y-1 my-4">${match}</ul>`);
	}

	function formatCurrency(value: string | number): string {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		if (isNaN(num)) return '$0';
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		}).format(num);
	}

	function getScoreColor(score: number): string {
		if (score >= 90) return 'text-success';
		if (score >= 50) return 'text-warning';
		return 'text-error';
	}

	function hasPerformanceData(): boolean {
		return !!(
			performanceData.performance ||
			performanceData.accessibility ||
			performanceData.bestPractices ||
			performanceData.seo
		);
	}

	// Calculate pricing
	const setupFee = parseFloat(customPricing?.setupFee ?? selectedPackage?.setupFee ?? '0');
	const monthlyPrice = parseFloat(
		customPricing?.monthlyPrice ?? selectedPackage?.monthlyPrice ?? '0'
	);
	const oneTimePrice = parseFloat(
		customPricing?.oneTimePrice ?? selectedPackage?.oneTimePrice ?? '0'
	);
	const hostingFee = parseFloat(
		customPricing?.hostingFee ?? selectedPackage?.hostingFee ?? '0'
	);
	const addonsTotal = selectedAddons.reduce((sum, a) => sum + parseFloat(a.price), 0);
	const subtotal = setupFee + oneTimePrice + addonsTotal;
	const gstRate = parseFloat(profile?.gstRate ?? '10');
	const gst = subtotal * (gstRate / 100);
	const total = subtotal + gst;
</script>

<svelte:head>
	<title>{proposal.title} | {agency?.name}</title>
</svelte:head>

{#if proposal.status === 'expired'}
	<div class="flex min-h-screen items-center justify-center bg-base-200">
		<div class="text-center">
			<Clock class="mx-auto h-16 w-16 text-base-content/30" />
			<h1 class="mt-4 text-2xl font-bold">Proposal Expired</h1>
			<p class="text-base-content/60 mt-2">
				This proposal is no longer valid. Please contact {agency?.name} for an updated quote.
			</p>
		</div>
	</div>
{:else}
	<article class="min-h-screen bg-base-100">
		<!-- Cover Section -->
		<header
			class="relative flex min-h-[50vh] items-center justify-center px-8 py-16"
			style="background: {agency?.secondaryColor || '#E3EDF7'}"
		>
			<div class="relative z-10 text-center">
				{#if agency?.logoUrl}
					<img
						src={agency.logoUrl}
						alt={agency.name}
						class="mx-auto mb-8 h-16 w-auto object-contain"
					/>
				{:else}
					<h2 class="mb-8 text-xl font-medium text-base-content/80">{agency?.name}</h2>
				{/if}

				<h1 class="text-4xl font-bold md:text-5xl text-base-content">{proposal.title}</h1>

				<p class="mt-4 text-xl text-base-content/80">
					Prepared for {proposal.clientBusinessName || 'Valued Client'}
				</p>

				<p class="mt-2 text-base-content/60">{formatDate(proposal.createdAt)}</p>

				{#if proposal.validUntil}
					<p class="mt-4 text-sm text-base-content/50">
						Valid until {formatDate(proposal.validUntil)}
					</p>
				{/if}
			</div>
		</header>

		<!-- Status Banners (PART 2: Proposal Improvements) -->
		{#if proposal.status === 'accepted'}
			<div class="bg-success text-success-content px-8 py-4">
				<div class="mx-auto flex max-w-4xl items-center justify-center gap-3">
					<CheckCircle2 class="h-6 w-6" />
					<span class="text-lg font-semibold">
						This proposal has been accepted{proposal.acceptedAt ? ` on ${formatDate(proposal.acceptedAt)}` : ''}
					</span>
				</div>
			</div>
		{:else if proposal.status === 'declined'}
			<div class="bg-error text-error-content px-8 py-4">
				<div class="mx-auto flex max-w-4xl items-center justify-center gap-3">
					<XCircle class="h-6 w-6" />
					<span class="text-lg font-semibold">
						This proposal was declined{proposal.declinedAt ? ` on ${formatDate(proposal.declinedAt)}` : ''}
					</span>
				</div>
			</div>
		{:else if proposal.status === 'revision_requested'}
			<div class="bg-warning text-warning-content px-8 py-4">
				<div class="mx-auto flex max-w-4xl items-center justify-center gap-3">
					<RefreshCw class="h-6 w-6" />
					<span class="text-lg font-semibold">
						Revision requested{proposal.revisionRequestedAt ? ` on ${formatDate(proposal.revisionRequestedAt)}` : ''}
					</span>
				</div>
			</div>
		{/if}

		<!-- Success Message after form submission -->
		{#if form?.success}
			<div class="bg-success text-success-content px-8 py-6">
				<div class="mx-auto max-w-4xl text-center">
					{#if form.action === 'accepted'}
						<CheckCircle2 class="mx-auto mb-2 h-12 w-12" />
						<h2 class="text-2xl font-bold">Thank you!</h2>
						<p class="mt-2">Your proposal has been accepted. We'll be in touch shortly to discuss next steps.</p>
					{:else if form.action === 'declined'}
						<XCircle class="mx-auto mb-2 h-12 w-12" />
						<h2 class="text-2xl font-bold">Proposal Declined</h2>
						<p class="mt-2">Thank you for considering us. If you change your mind or have questions, please get in touch.</p>
					{:else if form.action === 'revision_requested'}
						<RefreshCw class="mx-auto mb-2 h-12 w-12" />
						<h2 class="text-2xl font-bold">Revision Requested</h2>
						<p class="mt-2">We've received your feedback and will prepare an updated proposal for you.</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Error Message -->
		{#if form?.error}
			<div class="bg-error text-error-content px-8 py-4">
				<div class="mx-auto flex max-w-4xl items-center justify-center gap-3">
					<AlertCircle class="h-6 w-6" />
					<span>{form.error}</span>
				</div>
			</div>
		{/if}

		<!-- Performance Analysis -->
		{#if hasPerformanceData()}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-center text-3xl font-bold">Current Website Performance Analysis</h2>

					<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
						{#if performanceData.performance !== undefined}
							<div class="card bg-base-200">
								<div class="card-body items-center text-center">
									<span class="text-4xl font-bold {getScoreColor(performanceData.performance)}">
										{performanceData.performance}
									</span>
									<span class="text-base-content/60">Performance</span>
								</div>
							</div>
						{/if}
						{#if performanceData.accessibility !== undefined}
							<div class="card bg-base-200">
								<div class="card-body items-center text-center">
									<span class="text-4xl font-bold {getScoreColor(performanceData.accessibility)}">
										{performanceData.accessibility}
									</span>
									<span class="text-base-content/60">Accessibility</span>
								</div>
							</div>
						{/if}
						{#if performanceData.bestPractices !== undefined}
							<div class="card bg-base-200">
								<div class="card-body items-center text-center">
									<span class="text-4xl font-bold {getScoreColor(performanceData.bestPractices)}">
										{performanceData.bestPractices}
									</span>
									<span class="text-base-content/60">Best Practices</span>
								</div>
							</div>
						{/if}
						{#if performanceData.seo !== undefined}
							<div class="card bg-base-200">
								<div class="card-body items-center text-center">
									<span class="text-4xl font-bold {getScoreColor(performanceData.seo)}">
										{performanceData.seo}
									</span>
									<span class="text-base-content/60">SEO</span>
								</div>
							</div>
						{/if}
					</div>

					{#if performanceData.loadTime}
						<p class="text-base-content/60 mt-4 text-center">
							Current load time: <strong>{performanceData.loadTime}</strong>
						</p>
					{/if}

					{#if performanceData.issues && performanceData.issues.length > 0}
						<div class="mt-8">
							<h3 class="mb-4 font-semibold">Key Issues Identified</h3>
							<ul class="space-y-2">
								{#each performanceData.issues as issue}
									<li class="flex items-start gap-2">
										<X class="mt-0.5 h-5 w-5 shrink-0 text-error" />
										<span>{issue}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- The Opportunity -->
		{#if proposal.opportunityContent}
			<section class="relative overflow-hidden bg-gradient-to-br from-base-200 via-base-200 to-base-300 px-8 py-20">
				<!-- Decorative background elements -->
				<div class="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
				<div class="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

				<div class="relative mx-auto max-w-4xl">
					<div class="flex items-center gap-4 mb-10">
						<div class="w-1.5 h-12 rounded-full bg-gradient-to-b from-primary to-primary/30"></div>
						<h2 class="text-3xl md:text-4xl font-bold tracking-tight">The Opportunity</h2>
					</div>
					<div class="text-base-content/80 text-lg leading-relaxed space-y-1">
						{@html parseMarkdown(proposal.opportunityContent)}
					</div>
				</div>
			</section>
		{/if}

		<!-- Current Issues -->
		{#if currentIssues.length > 0}
			{@const hasDetailedContent = currentIssues.some(issue => {
				if (!issue.text?.includes(': ')) return false;
				const desc = issue.text.split(': ').slice(1).join(': ');
				return desc.length > 50; // Has meaningful description
			})}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">Current Site Issues We'll Solve</h2>

					{#if hasDetailedContent}
						<!-- Detailed layout: stacked cards with title + description -->
						<div class="space-y-3">
							{#each currentIssues as issue}
								{@const parts = issue.text?.includes(': ') ? issue.text.split(': ') : [issue.text, '']}
								{@const title = parts[0]}
								{@const description = parts.slice(1).join(': ')}
								<div class="flex gap-4 rounded-xl bg-base-200 p-5">
									<div class="shrink-0 mt-0.5">
										<div class="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
											<Check class="h-4 w-4 text-success" />
										</div>
									</div>
									<div class="min-w-0">
										<p class="font-semibold text-base-content">{title}</p>
										{#if description}
											<p class="text-sm text-base-content/70 mt-1 leading-relaxed">{description}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<!-- Compact layout: 2-column grid for short items -->
						<ul class="grid gap-3 sm:grid-cols-2">
							{#each currentIssues as issue}
								<li class="flex items-center gap-3 rounded-lg bg-base-200 p-4">
									<Check class="h-5 w-5 shrink-0 text-success" />
									<span>{issue.text}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Package & Pricing -->
		{#if selectedPackage || customPricing}
			<section
				class="px-8 py-16 text-white"
				style="background: {agency?.accentGradient || agency?.primaryColor || '#4F46E5'}"
			>
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">
						{selectedPackage ? `Your ${selectedPackage.name} Package` : 'Your Custom Package'}
					</h2>

					<div class="grid gap-8 md:grid-cols-2">
						<!-- Features -->
						<div>
							{#if selectedPackage?.description}
								<p class="mb-6 text-lg opacity-90">{selectedPackage.description}</p>
							{/if}

							{#if selectedPackage?.includedFeatures && (selectedPackage.includedFeatures as string[]).length > 0}
								<h3 class="mb-4 font-semibold">What's Included</h3>
								<ul class="space-y-2">
									{#each selectedPackage.includedFeatures as string[] as feature}
										<li class="flex items-center gap-2">
											<Check class="h-5 w-5 shrink-0" />
											<span>{feature}</span>
										</li>
									{/each}
								</ul>
							{/if}
						</div>

						<!-- Pricing -->
						<div class="rounded-xl bg-white/10 p-6">
							<h3 class="mb-4 font-semibold">Investment</h3>
							<dl class="space-y-3">
								{#if setupFee > 0}
									<div class="flex justify-between">
										<dt>Setup Fee</dt>
										<dd class="font-semibold">{formatCurrency(setupFee)}</dd>
									</div>
								{/if}
								{#if oneTimePrice > 0}
									<div class="flex justify-between">
										<dt>One-Time</dt>
										<dd class="font-semibold">{formatCurrency(oneTimePrice)}</dd>
									</div>
								{/if}
								{#if selectedAddons.length > 0}
									{#each selectedAddons as addon}
										<div class="flex justify-between text-sm opacity-80">
											<dt>{addon.name}</dt>
											<dd>{formatCurrency(addon.price)}</dd>
										</div>
									{/each}
								{/if}

								<div class="border-t border-white/20 pt-3">
									<div class="flex justify-between text-sm opacity-80">
										<dt>Subtotal</dt>
										<dd>{formatCurrency(subtotal)}</dd>
									</div>
									<div class="flex justify-between text-sm opacity-80">
										<dt>GST ({gstRate}%)</dt>
										<dd>{formatCurrency(gst)}</dd>
									</div>
									<div class="mt-2 flex justify-between text-xl font-bold">
										<dt>Total</dt>
										<dd>{formatCurrency(total)}</dd>
									</div>
								</div>

								{#if monthlyPrice > 0}
									<div class="border-t border-white/20 pt-3">
										<div class="flex justify-between">
											<dt>Monthly</dt>
											<dd class="font-semibold">{formatCurrency(monthlyPrice)}/mo</dd>
										</div>
										{#if hostingFee > 0}
											<div class="flex justify-between text-sm opacity-80">
												<dt>Hosting</dt>
												<dd>{formatCurrency(hostingFee)}/mo</dd>
											</div>
										{/if}
									</div>
								{/if}
							</dl>
						</div>
					</div>
				</div>
			</section>
		{/if}

		<!-- ROI Analysis -->
		{#if roiAnalysis.currentVisitors || roiAnalysis.projectedVisitors}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">ROI Analysis</h2>
					<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
						{#if roiAnalysis.currentVisitors}
							<div class="card bg-base-200">
								<div class="card-body items-center text-center">
									<span class="text-3xl font-bold">
										{roiAnalysis.currentVisitors.toLocaleString()}
									</span>
									<span class="text-base-content/60 text-sm">Current Monthly Visitors</span>
								</div>
							</div>
						{/if}
						{#if roiAnalysis.projectedVisitors}
							<div class="card bg-primary text-primary-content">
								<div class="card-body items-center text-center">
									<span class="text-3xl font-bold">
										{roiAnalysis.projectedVisitors.toLocaleString()}
									</span>
									<span class="text-sm opacity-80">Projected Monthly Visitors</span>
								</div>
							</div>
						{/if}
						{#if roiAnalysis.conversionRate}
							<div class="card bg-base-200">
								<div class="card-body items-center text-center">
									<span class="text-3xl font-bold">{roiAnalysis.conversionRate}%</span>
									<span class="text-base-content/60 text-sm">Conversion Rate</span>
								</div>
							</div>
						{/if}
						{#if roiAnalysis.projectedLeads}
							<div class="card bg-success text-success-content">
								<div class="card-body items-center text-center">
									<span class="text-3xl font-bold">{roiAnalysis.projectedLeads}</span>
									<span class="text-sm opacity-80">Monthly Leads</span>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</section>
		{/if}

		<!-- Performance Standards -->
		{#if performanceStandards.length > 0}
			<section class="bg-base-200 px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-center text-3xl font-bold">Performance Standards We Guarantee</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						{#each performanceStandards as standard}
							{@const hasArrow = standard.value?.includes('→')}
							{@const valueParts = hasArrow ? standard.value.split('→').map((s: string) => s.trim()) : [standard.value]}
							<div class="card bg-base-100 shadow-sm">
								<div class="card-body p-5">
									<p class="text-sm font-medium text-base-content/60 uppercase tracking-wide mb-3">{standard.label}</p>
									{#if hasArrow && valueParts.length === 2}
										<div class="flex items-center gap-3">
											<div class="flex-1 text-center">
												<span class="text-xl font-bold text-error/70">{valueParts[0]}</span>
												<p class="text-xs text-base-content/50 mt-1">Current</p>
											</div>
											<div class="shrink-0">
												<svg class="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
												</svg>
											</div>
											<div class="flex-1 text-center">
												<span class="text-xl font-bold text-success">{valueParts[1]}</span>
												<p class="text-xs text-base-content/50 mt-1">Target</p>
											</div>
										</div>
									{:else}
										<span class="text-2xl font-bold text-primary text-center">{standard.value}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- Local Advantage -->
		{#if proposal.localAdvantageContent}
			<section class="relative px-8 py-20 bg-base-100">
				<div class="mx-auto max-w-4xl">
					<div class="flex items-center gap-4 mb-10">
						<div class="w-1.5 h-12 rounded-full bg-gradient-to-b from-success to-success/30"></div>
						<h2 class="text-3xl md:text-4xl font-bold tracking-tight">Local Advantage</h2>
					</div>
					<div class="relative">
						<!-- Accent card styling -->
						<div class="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-success/50 via-success/20 to-transparent rounded-full"></div>
						<div class="pl-6 text-base-content/80 text-lg leading-relaxed space-y-1">
							{@html parseMarkdown(proposal.localAdvantageContent)}
						</div>
					</div>
				</div>
			</section>
		{/if}

		<!-- Site Architecture -->
		{#if proposedPages.length > 0}
			<section class="bg-base-200 px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">Proposed Site Architecture</h2>
					<div class="grid gap-4 sm:grid-cols-2">
						{#each proposedPages as page}
							<div class="card bg-base-100">
								<div class="card-body">
									<h3 class="card-title">{page.name}</h3>
									{#if page.description}
										<p class="text-base-content/70">{page.description}</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- Timeline -->
		{#if timeline.length > 0}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">Implementation Timeline</h2>
					<div class="space-y-0">
						{#each timeline as phase, index}
							<div class="flex gap-4">
								<div class="flex flex-col items-center">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-semibold"
										style="background-color: {agency?.primaryColor || '#4F46E5'}"
									>
										{index + 1}
									</div>
									{#if index < timeline.length - 1}
										<div class="flex-1 w-0.5 min-h-8 bg-base-300"></div>
									{/if}
								</div>
								<div class="pb-8">
									<span class="text-base-content/60 text-sm">{phase.week}</span>
									<h3 class="text-lg font-semibold">{phase.title}</h3>
									{#if phase.description}
										<p class="text-base-content/70 mt-1">{phase.description}</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- Closing -->
		{#if proposal.closingContent}
			<section class="relative overflow-hidden px-8 py-24">
				<!-- Dramatic gradient background -->
				<div
					class="absolute inset-0"
					style="background: linear-gradient(135deg, {agency?.primaryColor || '#4F46E5'}08 0%, transparent 50%, {agency?.secondaryColor || '#1E40AF'}08 100%);"
				></div>

				<!-- Geometric accent shapes -->
				<div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
					<div
						class="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-[0.03]"
						style="background: {agency?.primaryColor || '#4F46E5'};"
					></div>
					<div
						class="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.03]"
						style="background: {agency?.secondaryColor || '#1E40AF'};"
					></div>
				</div>

				<div class="relative mx-auto max-w-4xl">
					<!-- Section Header with accent -->
					<div class="text-center mb-16">
						<div
							class="inline-flex items-center gap-3 px-5 py-2 rounded-full text-sm font-medium mb-6"
							style="background: {agency?.primaryColor || '#4F46E5'}12; color: {agency?.primaryColor || '#4F46E5'};"
						>
							<span class="w-2 h-2 rounded-full animate-pulse" style="background: {agency?.primaryColor || '#4F46E5'};"></span>
							Final Thoughts
						</div>
						<h2 class="text-3xl md:text-4xl font-bold tracking-tight">
							Looking Forward to Working Together
						</h2>
					</div>

					<!-- Content with premium card treatment -->
					<div class="relative">
						<!-- Vertical accent line -->
						<div
							class="absolute left-0 top-8 bottom-8 w-1 rounded-full hidden md:block"
							style="background: linear-gradient(180deg, {agency?.primaryColor || '#4F46E5'} 0%, {agency?.primaryColor || '#4F46E5'}40 50%, transparent 100%);"
						></div>

						<div class="md:pl-8 space-y-8">
							<!-- Main content card -->
							<div class="bg-base-100 rounded-2xl p-8 md:p-10 shadow-xl shadow-base-content/5 border border-base-200">
								<div class="prose prose-lg max-w-none text-base-content/80 leading-relaxed">
									{@html parseMarkdown(proposal.closingContent)}
								</div>
							</div>

							<!-- Trust indicators row -->
							<div class="grid grid-cols-3 gap-4">
								<div class="bg-base-100 rounded-xl p-4 text-center border border-base-200 hover:border-primary/30 transition-colors">
									<div
										class="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center"
										style="background: {agency?.primaryColor || '#4F46E5'}15;"
									>
										<svg class="w-5 h-5" style="color: {agency?.primaryColor || '#4F46E5'};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
										</svg>
									</div>
									<span class="text-xs font-medium text-base-content/60">Guaranteed Results</span>
								</div>
								<div class="bg-base-100 rounded-xl p-4 text-center border border-base-200 hover:border-primary/30 transition-colors">
									<div
										class="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center"
										style="background: {agency?.primaryColor || '#4F46E5'}15;"
									>
										<svg class="w-5 h-5" style="color: {agency?.primaryColor || '#4F46E5'};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									</div>
									<span class="text-xs font-medium text-base-content/60">12 Month Support</span>
								</div>
								<div class="bg-base-100 rounded-xl p-4 text-center border border-base-200 hover:border-primary/30 transition-colors">
									<div
										class="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center"
										style="background: {agency?.primaryColor || '#4F46E5'}15;"
									>
										<svg class="w-5 h-5" style="color: {agency?.primaryColor || '#4F46E5'};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
										</svg>
									</div>
									<span class="text-xs font-medium text-base-content/60">No Hidden Fees</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		{/if}

		<!-- Investment Summary -->
		{#if selectedPackage || customPricing}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<div class="text-center mb-10">
						<h2 class="text-3xl font-bold tracking-tight">Your Investment</h2>
						<p class="text-base-content/60 mt-2">Everything included in your package</p>
					</div>

					<div
						class="relative overflow-hidden rounded-2xl border-2 shadow-2xl"
						style="border-color: {agency?.primaryColor || '#4F46E5'}30;"
					>
						<!-- Gradient header -->
						<div
							class="px-8 py-6"
							style="background: {agency?.accentGradient || `linear-gradient(135deg, ${agency?.primaryColor || '#4F46E5'} 0%, ${agency?.accentColor || '#1E40AF'} 100%)`};"
						>
							<div class="text-white text-center">
								<p class="text-sm font-medium opacity-80 uppercase tracking-wider">
									{selectedPackage?.name || 'Custom'} Package
								</p>
								<div class="mt-2 flex items-baseline justify-center gap-2">
									{#if monthlyPrice > 0}
										<span class="text-5xl font-bold">{formatCurrency(monthlyPrice)}</span>
										<span class="text-xl opacity-80">/month</span>
									{:else if total > 0}
										<span class="text-5xl font-bold">{formatCurrency(total)}</span>
										<span class="text-xl opacity-80">inc. GST</span>
									{/if}
								</div>
								{#if setupFee > 0 && monthlyPrice > 0}
									<p class="mt-2 text-sm opacity-70">
										+ {formatCurrency(setupFee)} one-time setup fee
									</p>
								{/if}
							</div>
						</div>

						<!-- Price breakdown -->
						<div class="bg-base-100 p-8">
							<dl class="space-y-4">
								{#if setupFee > 0}
									<div class="flex justify-between items-center py-2 border-b border-base-200">
										<dt class="text-base-content/70">Setup Fee</dt>
										<dd class="font-semibold">{formatCurrency(setupFee)}</dd>
									</div>
								{/if}
								{#if oneTimePrice > 0}
									<div class="flex justify-between items-center py-2 border-b border-base-200">
										<dt class="text-base-content/70">Development</dt>
										<dd class="font-semibold">{formatCurrency(oneTimePrice)}</dd>
									</div>
								{/if}
								{#if selectedAddons.length > 0}
									{#each selectedAddons as addon}
										<div class="flex justify-between items-center py-2 border-b border-base-200">
											<dt class="text-base-content/70 flex items-center gap-2">
												<span class="w-2 h-2 rounded-full" style="background: {agency?.primaryColor || '#4F46E5'};"></span>
												{addon.name}
											</dt>
											<dd class="font-semibold">{formatCurrency(addon.price)}</dd>
										</div>
									{/each}
								{/if}

								<!-- Subtotal & GST -->
								<div class="pt-4 mt-4 border-t-2 border-base-200">
									<div class="flex justify-between items-center py-1">
										<dt class="text-base-content/60 text-sm">Subtotal</dt>
										<dd class="text-base-content/60">{formatCurrency(subtotal)}</dd>
									</div>
									<div class="flex justify-between items-center py-1">
										<dt class="text-base-content/60 text-sm">GST ({gstRate}%)</dt>
										<dd class="text-base-content/60">{formatCurrency(gst)}</dd>
									</div>
									<div class="flex justify-between items-center py-2 mt-2">
										<dt class="text-lg font-bold">Total (inc. GST)</dt>
										<dd class="text-2xl font-bold" style="color: {agency?.primaryColor || '#4F46E5'};">
											{formatCurrency(total)}
										</dd>
									</div>
								</div>

								<!-- Recurring info -->
								{#if monthlyPrice > 0 || hostingFee > 0}
									<div class="mt-6 p-4 rounded-xl bg-base-200">
										<p class="text-sm font-medium mb-2">Ongoing Monthly</p>
										<div class="space-y-1">
											{#if monthlyPrice > 0}
												<div class="flex justify-between text-sm">
													<span class="text-base-content/70">Monthly Fee</span>
													<span class="font-semibold">{formatCurrency(monthlyPrice)}/mo</span>
												</div>
											{/if}
											{#if hostingFee > 0}
												<div class="flex justify-between text-sm">
													<span class="text-base-content/70">Hosting</span>
													<span class="font-semibold">{formatCurrency(hostingFee)}/mo</span>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</dl>
						</div>
					</div>

					<!-- Valid until notice -->
					{#if proposal.validUntil}
						<p class="text-center text-sm text-base-content/50 mt-6">
							This pricing is valid until {formatDate(proposal.validUntil)}
						</p>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Client Response Section (PART 2: Proposal Improvements) -->
		{#if canRespond && !form?.success}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<div class="text-center mb-8">
						<h2 class="text-3xl font-bold">Ready to Move Forward?</h2>
						<p class="text-base-content/60 mt-2">
							Let us know your decision below. We're here to answer any questions.
						</p>
					</div>

					<!-- Response Action Buttons -->
					{#if !activeResponse}
						<div class="flex flex-col sm:flex-row justify-center gap-4">
							<button
								type="button"
								class="btn btn-success btn-lg gap-2"
								onclick={() => (activeResponse = 'accept')}
							>
								<ThumbsUp class="h-5 w-5" />
								Accept Proposal
							</button>
							<button
								type="button"
								class="btn btn-warning btn-lg gap-2"
								onclick={() => (activeResponse = 'revision')}
							>
								<Edit3 class="h-5 w-5" />
								Request Changes
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-lg gap-2"
								onclick={() => (activeResponse = 'decline')}
							>
								<ThumbsDown class="h-5 w-5" />
								Decline
							</button>
						</div>
					{/if}

					<!-- Accept Form -->
					{#if activeResponse === 'accept'}
						<div class="card bg-base-200 max-w-xl mx-auto">
							<div class="card-body">
								<h3 class="card-title text-success">
									<CheckCircle2 class="h-6 w-6" />
									Accept Proposal
								</h3>
								<form
									method="POST"
									action="?/accept"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ update }) => {
											await update();
											isSubmitting = false;
										};
									}}
								>
									<div class="form-control">
										<label class="label" for="comments">
											<span class="label-text">Any comments? (optional)</span>
										</label>
										<textarea
											id="comments"
											name="comments"
											class="textarea textarea-bordered w-full"
											rows="3"
											placeholder="Add any notes or questions..."
										></textarea>
									</div>
									<div class="card-actions justify-end mt-4">
										<button
											type="button"
											class="btn btn-ghost"
											onclick={() => (activeResponse = null)}
											disabled={isSubmitting}
										>
											Cancel
										</button>
										<button type="submit" class="btn btn-success" disabled={isSubmitting}>
											{#if isSubmitting}
												<span class="loading loading-spinner loading-sm"></span>
											{/if}
											Confirm Acceptance
										</button>
									</div>
								</form>
							</div>
						</div>
					{/if}

					<!-- Revision Request Form -->
					{#if activeResponse === 'revision'}
						<div class="card bg-base-200 max-w-xl mx-auto">
							<div class="card-body">
								<h3 class="card-title text-warning">
									<Edit3 class="h-6 w-6" />
									Request Changes
								</h3>
								<form
									method="POST"
									action="?/requestRevision"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ update }) => {
											await update();
											isSubmitting = false;
										};
									}}
								>
									<div class="form-control">
										<label class="label" for="notes">
											<span class="label-text">What changes would you like?</span>
										</label>
										<textarea
											id="notes"
											name="notes"
											class="textarea textarea-bordered w-full"
											rows="4"
											placeholder="Please describe the changes or clarifications you'd like us to make..."
											required
											minlength="10"
										></textarea>
										<span class="label">
											<span class="label-text-alt">Minimum 10 characters</span>
										</span>
									</div>
									<div class="card-actions justify-end mt-4">
										<button
											type="button"
											class="btn btn-ghost"
											onclick={() => (activeResponse = null)}
											disabled={isSubmitting}
										>
											Cancel
										</button>
										<button type="submit" class="btn btn-warning" disabled={isSubmitting}>
											{#if isSubmitting}
												<span class="loading loading-spinner loading-sm"></span>
											{/if}
											Submit Request
										</button>
									</div>
								</form>
							</div>
						</div>
					{/if}

					<!-- Decline Form -->
					{#if activeResponse === 'decline'}
						<div class="card bg-base-200 max-w-xl mx-auto">
							<div class="card-body">
								<h3 class="card-title">
									<XCircle class="h-6 w-6" />
									Decline Proposal
								</h3>
								<p class="text-base-content/60 text-sm">
									We're sorry to hear this isn't the right fit. Your feedback helps us improve.
								</p>
								<form
									method="POST"
									action="?/decline"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ update }) => {
											await update();
											isSubmitting = false;
										};
									}}
								>
									<div class="form-control">
										<label class="label" for="reason">
											<span class="label-text">Reason for declining (optional)</span>
										</label>
										<textarea
											id="reason"
											name="reason"
											class="textarea textarea-bordered w-full"
											rows="3"
											placeholder="Help us understand what we could do better..."
										></textarea>
									</div>
									<div class="card-actions justify-end mt-4">
										<button
											type="button"
											class="btn btn-ghost"
											onclick={() => (activeResponse = null)}
											disabled={isSubmitting}
										>
											Cancel
										</button>
										<button type="submit" class="btn" disabled={isSubmitting}>
											{#if isSubmitting}
												<span class="loading loading-spinner loading-sm"></span>
											{/if}
											Confirm Decline
										</button>
									</div>
								</form>
							</div>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Contact / Footer -->
		<footer
			class="px-8 py-16"
			style="background-color: {agency?.secondaryColor || '#E3EDF7'}"
		>
			<div class="mx-auto max-w-4xl text-center">
				{#if agency?.logoUrl}
					<img
						src={agency.logoUrl}
						alt={agency.name}
						class="mx-auto mb-6 h-12 w-auto object-contain"
					/>
				{:else}
					<h2 class="mb-6 text-2xl font-bold text-base-content">{agency?.name}</h2>
				{/if}

				{#if profile?.tagline}
					<p class="mb-8 text-lg text-base-content/80">{profile.tagline}</p>
				{/if}

				<div class="flex flex-wrap justify-center gap-6 text-base-content/80">
					{#if agency?.phone}
						<a href="tel:{agency.phone}" class="flex items-center gap-2 hover:underline" style="color: {agency?.primaryColor || '#9C27B0'}">
							<Phone class="h-5 w-5" />
							{agency.phone}
						</a>
					{/if}
					{#if agency?.email}
						<a href="mailto:{agency.email}" class="flex items-center gap-2 hover:underline" style="color: {agency?.primaryColor || '#9C27B0'}">
							<Mail class="h-5 w-5" />
							{agency.email}
						</a>
					{/if}
					{#if agency?.website}
						<a
							href={agency.website}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 hover:underline"
							style="color: {agency?.primaryColor || '#9C27B0'}"
						>
							<Globe class="h-5 w-5" />
							{agency.website.replace(/^https?:\/\//, '')}
						</a>
					{/if}
				</div>

				{#if profile?.addressLine1}
					<p class="mt-6 flex items-center justify-center gap-2 text-base-content/70">
						<MapPin class="h-5 w-5" />
						{[profile.addressLine1, profile.city, profile.state, profile.postcode]
							.filter(Boolean)
							.join(', ')}
					</p>
				{/if}

				<p class="mt-8 text-sm text-base-content/50">
					Proposal {proposal.proposalNumber} &bull; Generated {formatDate(proposal.createdAt)}
				</p>
			</div>
		</footer>
	</article>
{/if}

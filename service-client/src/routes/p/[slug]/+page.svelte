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
	 */

	import type { PageData } from './$types';
	import {
		BarChart3,
		Check,
		X,
		Clock,
		FileText,
		Phone,
		Mail,
		Globe,
		MapPin,
		Calendar
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

	let { data }: { data: PageData } = $props();

	const { proposal, agency, profile, selectedPackage, selectedAddons } = data;

	// Parse JSONB fields
	const performanceData = (proposal.performanceData as PerformanceData) || {};
	const currentIssues = (proposal.currentIssues as ChecklistItem[]) || [];
	const complianceIssues = (proposal.complianceIssues as ChecklistItem[]) || [];
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
			style="background-color: {agency?.primaryColor || '#4F46E5'}"
		>
			<div class="relative z-10 text-center text-white">
				{#if agency?.logoUrl}
					<img
						src={agency.logoUrl}
						alt={agency.name}
						class="mx-auto mb-8 h-16 w-auto object-contain"
					/>
				{:else}
					<h2 class="mb-8 text-xl font-medium opacity-90">{agency?.name}</h2>
				{/if}

				<h1 class="text-4xl font-bold md:text-5xl">{proposal.title}</h1>

				<p class="mt-4 text-xl opacity-90">
					Prepared for {proposal.clientBusinessName || 'Valued Client'}
				</p>

				<p class="mt-2 opacity-70">{formatDate(proposal.createdAt)}</p>

				{#if proposal.validUntil}
					<p class="mt-4 text-sm opacity-60">
						Valid until {formatDate(proposal.validUntil)}
					</p>
				{/if}
			</div>
		</header>

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
			<section class="bg-base-200 px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">The Opportunity</h2>
					<div class="prose max-w-none">
						{@html proposal.opportunityContent.replace(/\n/g, '<br>')}
					</div>
				</div>
			</section>
		{/if}

		<!-- Current Issues -->
		{#if currentIssues.length > 0}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">Current Site Issues We'll Solve</h2>
					<ul class="grid gap-3 sm:grid-cols-2">
						{#each currentIssues as issue}
							<li class="flex items-center gap-3 rounded-lg bg-base-200 p-4">
								<Check class="h-5 w-5 shrink-0 text-success" />
								<span>{issue.text}</span>
							</li>
						{/each}
					</ul>
				</div>
			</section>
		{/if}

		<!-- Package & Pricing -->
		{#if selectedPackage || customPricing}
			<section
				class="px-8 py-16 text-white"
				style="background-color: {agency?.primaryColor || '#4F46E5'}"
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
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{#each performanceStandards as standard}
							<div class="card bg-base-100">
								<div class="card-body items-center text-center">
									<span class="text-2xl font-bold text-primary">{standard.value}</span>
									<span class="text-base-content/60">{standard.label}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/if}

		<!-- Local Advantage -->
		{#if proposal.localAdvantageContent}
			<section class="px-8 py-16">
				<div class="mx-auto max-w-4xl">
					<h2 class="mb-8 text-3xl font-bold">Local Advantage</h2>
					<div class="prose max-w-none">
						{@html proposal.localAdvantageContent.replace(/\n/g, '<br>')}
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
					<div class="space-y-4">
						{#each timeline as phase, index}
							<div class="flex gap-4">
								<div class="flex flex-col items-center">
									<div
										class="flex h-10 w-10 items-center justify-center rounded-full text-white"
										style="background-color: {agency?.primaryColor || '#4F46E5'}"
									>
										{index + 1}
									</div>
									{#if index < timeline.length - 1}
										<div class="mt-1 h-full w-0.5 bg-base-300"></div>
									{/if}
								</div>
								<div class="pb-8">
									<div class="flex items-baseline gap-2">
										<span class="text-base-content/60 text-sm">Week {phase.week}</span>
									</div>
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
			<section class="bg-base-200 px-8 py-16">
				<div class="mx-auto max-w-4xl text-center">
					<h2 class="mb-8 text-3xl font-bold">Looking Forward to Working Together</h2>
					<div class="prose mx-auto max-w-2xl">
						{@html proposal.closingContent.replace(/\n/g, '<br>')}
					</div>
				</div>
			</section>
		{/if}

		<!-- Contact / Footer -->
		<footer
			class="px-8 py-16 text-white"
			style="background-color: {agency?.secondaryColor || '#1E40AF'}"
		>
			<div class="mx-auto max-w-4xl text-center">
				{#if agency?.logoUrl}
					<img
						src={agency.logoUrl}
						alt={agency.name}
						class="mx-auto mb-6 h-12 w-auto object-contain"
					/>
				{:else}
					<h2 class="mb-6 text-2xl font-bold">{agency?.name}</h2>
				{/if}

				{#if profile?.tagline}
					<p class="mb-8 text-lg opacity-90">{profile.tagline}</p>
				{/if}

				<div class="flex flex-wrap justify-center gap-6">
					{#if agency?.phone}
						<a href="tel:{agency.phone}" class="flex items-center gap-2 hover:underline">
							<Phone class="h-5 w-5" />
							{agency.phone}
						</a>
					{/if}
					{#if agency?.email}
						<a href="mailto:{agency.email}" class="flex items-center gap-2 hover:underline">
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
						>
							<Globe class="h-5 w-5" />
							{agency.website.replace(/^https?:\/\//, '')}
						</a>
					{/if}
				</div>

				{#if profile?.addressLine1}
					<p class="mt-6 flex items-center justify-center gap-2 opacity-80">
						<MapPin class="h-5 w-5" />
						{[profile.addressLine1, profile.city, profile.state, profile.postcode]
							.filter(Boolean)
							.join(', ')}
					</p>
				{/if}

				<p class="mt-8 text-sm opacity-60">
					Proposal {proposal.proposalNumber} &bull; Generated {formatDate(proposal.createdAt)}
				</p>
			</div>
		</footer>
	</article>
{/if}

<script lang="ts">
	/**
	 * Public Proposal View
	 *
	 * Page-level shell: SEO metadata, expired-state handling, action data,
	 * derived-value owner. The branded article itself is rendered by the
	 * ProposalDocument component — see
	 * `$lib/components/documents/ProposalDocument.svelte`.
	 *
	 * This page is the "state owner" per the Phase 2.1b extraction plan:
	 * JSONB parsing, pricing math, response form state, and helper functions
	 * live here and are passed to the component via bag-shaped props. Phase
	 * 2.1d pulls that state into the component; this page will then reduce
	 * to a thin wrapper.
	 */

	import type { PageData, ActionData } from './$types';
	import { Clock } from 'lucide-svelte';
	import type {
		ChecklistItem,
		PerformanceData,
		RoiAnalysis,
		PerformanceStandard,
		ProposedPage,
		TimelinePhase,
		CustomPricing
	} from '$lib/server/schema';
	import { formatDate } from '$lib/utils/formatting';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import SvelteSeo from 'svelte-seo';
	import ProposalDocument from '$lib/components/documents/ProposalDocument.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const { proposal, agency, profile, selectedPackage, selectedAddons, isPreview, branding } = data;

	// Response form state — passed into ProposalDocument via $bindable().
	let responseState = $state<{
		activeResponse: 'accept' | 'decline' | 'revision' | null;
		isSubmitting: boolean;
	}>({
		activeResponse: null,
		isSubmitting: false
	});

	// Check if client can respond (only sent or viewed status, or preview mode shows all)
	const canRespond =
		proposal.status === 'sent' || proposal.status === 'viewed' || isPreview;

	// Parse JSONB fields
	const performanceData = (proposal.performanceData as PerformanceData) || {};
	const currentIssues = (proposal.currentIssues as ChecklistItem[]) || [];
	const roiAnalysis = (proposal.roiAnalysis as RoiAnalysis) || {};
	const performanceStandards = (proposal.performanceStandards as PerformanceStandard[]) || [];
	const proposedPages = (proposal.proposedPages as ProposedPage[]) || [];
	const timeline = (proposal.timeline as TimelinePhase[]) || [];
	const customPricing = (proposal.customPricing as CustomPricing) || null;

	/**
	 * Parse simple markdown to HTML with styled elements
	 */
	function parseMarkdown(text: string): string {
		if (!text) return '';

		// If content contains HTML tags (from RichTextEditor), render directly with sanitization
		if (/<[a-z][\s\S]*>/i.test(text)) {
			return sanitizeHtml(text);
		}

		// Legacy plain-text content: parse simple markdown
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

<SvelteSeo
	title="{proposal.title} — {agency?.name}"
	description={proposal.executiveSummary
		? proposal.executiveSummary.substring(0, 160)
		: `Proposal from ${agency?.name}`}
	openGraph={{
		type: 'website',
		title: `${proposal.title} — ${agency?.name}`,
		description: proposal.executiveSummary
			? proposal.executiveSummary.substring(0, 160)
			: `Proposal from ${agency?.name}`
	}}
	noindex={true}
	nofollow={true}
/>

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
	<ProposalDocument
		{branding}
		{form}
		data={{ proposal, agency, profile, selectedPackage, selectedAddons, isPreview }}
		parsed={{
			performanceData,
			currentIssues,
			roiAnalysis,
			performanceStandards,
			proposedPages,
			timeline,
			customPricing,
			canRespond
		}}
		pricing={{ setupFee, monthlyPrice, oneTimePrice, hostingFee, subtotal, gstRate, gst, total }}
		helpers={{ parseMarkdown, formatCurrency, getScoreColor, hasPerformanceData, formatDate }}
		bind:responseState
	/>
{/if}

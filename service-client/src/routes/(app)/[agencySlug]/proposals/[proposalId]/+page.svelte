<script lang="ts">
	/**
	 * Proposal Editor Page
	 *
	 * Full editor for creating and editing proposals with:
	 * - Client info section
	 * - Performance analysis (PageSpeed)
	 * - Content sections (opportunity, issues, ROI)
	 * - Package selection
	 * - Timeline and architecture
	 */

	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { getProposalWithRelations, updateProposal, markProposalReady, revertProposalToDraft } from '$lib/api/proposals.remote';
	import { sendProposalEmail } from '$lib/api/email.remote';
	import EmailHistory from '$lib/components/emails/EmailHistory.svelte';
	import SendEmailModal from '$lib/components/shared/SendEmailModal.svelte';
	import AIPreviewModal from './AIPreviewModal.svelte';
	import AIStreamingModal from './AIStreamingModal.svelte';
	import AIErrorDisplay from '$lib/components/AIErrorDisplay.svelte';
	import { getActivePackages } from '$lib/api/agency-packages.remote';
	import { getActiveAddons } from '$lib/api/agency-addons.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import {
		Save,
		Send,
		Eye,
		ChevronLeft,
		User,
		BarChart3,
		FileText,
		Package,
		Calendar,
		Layout,
		MessageSquare,
		Plus,
		Trash2,
		Check,
		FileSignature,
		ListChecks,
		Lightbulb,
		CheckCircle2,
		MoreHorizontal,
		Sparkles
	} from 'lucide-svelte';
	import { ALL_SECTIONS, SECTION_DISPLAY_NAMES } from '$lib/constants/proposal-sections';
	import type { AIErrorCode } from '$lib/constants/ai-errors';
	import type { AIProposalOutput } from '$lib/types/ai-proposal';
	import type {
		ChecklistItem,
		PerformanceData,
		RoiAnalysis,
		PerformanceStandard,
		ProposedPage,
		TimelinePhase,
		CustomPricing,
		NextStepItem,
		ConsultationPainPoints,
		ConsultationGoals
	} from '$lib/server/schema';

	const toast = getToast();
	const agencySlug = page.params.agencySlug;
	const proposalId = page.params.proposalId;

	// Load data
	const { proposal } = await getProposalWithRelations(proposalId);
	const packages = await getActivePackages();
	const addons = await getActiveAddons();

	// Form state
	let formData = $state({
		// Client info
		clientBusinessName: proposal.clientBusinessName,
		clientContactName: proposal.clientContactName,
		clientEmail: proposal.clientEmail,
		clientPhone: proposal.clientPhone,
		clientWebsite: proposal.clientWebsite,

		// Cover
		title: proposal.title,
		coverImage: proposal.coverImage || '',

		// Performance
		performanceData: (proposal.performanceData as PerformanceData) || {},

		// Content
		opportunityContent: proposal.opportunityContent,
		currentIssues: (proposal.currentIssues as ChecklistItem[]) || [],
		complianceIssues: (proposal.complianceIssues as ChecklistItem[]) || [],
		roiAnalysis: (proposal.roiAnalysis as RoiAnalysis) || {},
		performanceStandards: (proposal.performanceStandards as PerformanceStandard[]) || [],
		localAdvantageContent: proposal.localAdvantageContent,
		proposedPages: (proposal.proposedPages as ProposedPage[]) || [],
		timeline: (proposal.timeline as TimelinePhase[]) || [],
		closingContent: proposal.closingContent,

		// New sections (PART 2: Proposal Improvements)
		executiveSummary: proposal.executiveSummary || '',
		nextSteps: (proposal.nextSteps as NextStepItem[]) || [],

		// Package
		selectedPackageId: proposal.selectedPackageId || '',
		selectedAddons: (proposal.selectedAddons as string[]) || [],
		customPricing: (proposal.customPricing as CustomPricing) || null,

		// Validity
		validUntil: proposal.validUntil
			? new Date(proposal.validUntil).toISOString().split('T')[0]
			: ''
	});

	let isSaving = $state(false);
	let isSending = $state(false);
	let activeSection = $state('client');

	// Send email modal state
	let sendModalOpen = $state(false);
	let sendingEmail = $state(false);
	let isResend = $state(false);

	// AI generation state
	let showAIModal = $state(false);
	let showStreamingModal = $state(false);
	let isGenerating = $state(false);
	let aiError = $state<AIErrorCode | null>(null);
	let generatedContent = $state<AIProposalOutput | null>(null);
	let transformedContent = $state<Record<string, unknown> | null>(null); // DB-ready format
	let generatedSections = $state<string[]>([]);
	let failedSections = $state<string[]>([]);
	let showPreviewModal = $state(false);
	let syncedPerformanceData = $state<Record<string, unknown> | null>(null); // Fresh data from consultation

	// Section selection for AI generation (default all selected)
	let selectedSections = $state<Record<string, boolean>>(
		Object.fromEntries(ALL_SECTIONS.map((s) => [s, true]))
	);

	// Consultation insights from cached data (PART 2)
	const consultationPainPoints = (proposal.consultationPainPoints as ConsultationPainPoints) || {};
	const consultationGoals = (proposal.consultationGoals as ConsultationGoals) || {};
	const consultationChallenges = (proposal.consultationChallenges as string[]) || [];
	const hasConsultationInsights =
		consultationChallenges.length > 0 ||
		Object.keys(consultationPainPoints).length > 0 ||
		Object.keys(consultationGoals).length > 0;

	// Client feedback (PART 2: Proposal Improvements)
	const clientComments = proposal.clientComments || '';
	const declineReason = proposal.declineReason || '';
	const revisionRequestNotes = proposal.revisionRequestNotes || '';
	const hasClientFeedback = !!(clientComments || declineReason || revisionRequestNotes);

	// Sections for navigation
	const sections = [
		{ id: 'client', label: 'Client Info', icon: User },
		{ id: 'summary', label: 'Summary', icon: FileSignature },
		{ id: 'performance', label: 'Performance', icon: BarChart3 },
		{ id: 'content', label: 'Content', icon: FileText },
		{ id: 'package', label: 'Package', icon: Package },
		{ id: 'timeline', label: 'Timeline', icon: Calendar },
		{ id: 'architecture', label: 'Pages', icon: Layout },
		{ id: 'nextsteps', label: 'Next Steps', icon: ListChecks },
		{ id: 'closing', label: 'Closing', icon: MessageSquare },
		...(hasClientFeedback ? [{ id: 'feedback', label: 'Feedback', icon: MessageSquare }] : []),
		...(hasConsultationInsights ? [{ id: 'insights', label: 'Insights', icon: Lightbulb }] : [])
	];

	// Helper for checklist items
	function addChecklistItem(list: ChecklistItem[], text: string = '') {
		return [...list, { text, checked: true }];
	}

	function removeChecklistItem(list: ChecklistItem[], index: number) {
		return list.filter((_, i) => i !== index);
	}

	// Helper for timeline
	function addTimelinePhase() {
		formData.timeline = [
			...formData.timeline,
			{ week: '', title: '', description: '' }
		];
	}

	function removeTimelinePhase(index: number) {
		formData.timeline = formData.timeline.filter((_, i) => i !== index);
	}

	// Helper for pages
	function addProposedPage() {
		formData.proposedPages = [
			...formData.proposedPages,
			{ name: '', description: '', features: [] }
		];
	}

	function removeProposedPage(index: number) {
		formData.proposedPages = formData.proposedPages.filter((_, i) => i !== index);
	}

	// Helper for performance standards
	function addPerformanceStandard() {
		formData.performanceStandards = [
			...formData.performanceStandards,
			{ label: '', value: '' }
		];
	}

	function removePerformanceStandard(index: number) {
		formData.performanceStandards = formData.performanceStandards.filter((_, i) => i !== index);
	}

	// Helper for next steps (PART 2)
	function addNextStep() {
		formData.nextSteps = [...formData.nextSteps, { text: '', completed: false }];
	}

	function removeNextStep(index: number) {
		formData.nextSteps = formData.nextSteps.filter((_, i) => i !== index);
	}

	function toggleNextStep(index: number) {
		formData.nextSteps = formData.nextSteps.map((step, i) =>
			i === index ? { ...step, completed: !step.completed } : step
		);
	}

	async function handleSave(showToast = true) {
		isSaving = true;
		try {
			await updateProposal({
				proposalId,
				...formData,
				selectedPackageId: formData.selectedPackageId || null,
				validUntil: formData.validUntil || null
			});
			if (showToast) toast.success('Proposal saved');
		} catch (err) {
			toast.error('Failed to save', err instanceof Error ? err.message : 'Unknown error');
			throw err; // Re-throw so callers know save failed
		} finally {
			isSaving = false;
		}
	}

	function openSendModal(resend = false) {
		isResend = resend;
		sendModalOpen = true;
	}

	async function confirmSendEmail() {
		sendingEmail = true;
		try {
			await handleSave(false);
			const result = await sendProposalEmail({ proposalId });
			await invalidateAll();
			sendModalOpen = false;
			if (result.success) {
				toast.success(isResend ? 'Proposal resent' : 'Proposal sent', `Email delivered to ${formData.clientEmail}`);
			} else {
				toast.error('Failed to send proposal', result.error || 'Unknown error');
			}
		} catch (err) {
			toast.error('Failed to send', err instanceof Error ? err.message : 'Unknown error');
		} finally {
			sendingEmail = false;
		}
	}

	let isMarkingReady = $state(false);

	async function handleMarkReady() {
		isMarkingReady = true;
		try {
			await handleSave(false);
			await markProposalReady(proposalId);
			await invalidateAll();
			toast.success('Proposal marked as ready', 'You can now review and send it');
		} catch (err) {
			console.error('Mark ready error:', err);
			const message =
				err instanceof Error
					? err.message
					: typeof err === 'string'
						? err
						: JSON.stringify(err);
			toast.error('Failed to mark as ready', message || 'Unknown error');
		} finally {
			isMarkingReady = false;
		}
	}

	let isRevertingToDraft = $state(false);

	async function handleRevertToDraft() {
		isRevertingToDraft = true;
		try {
			await revertProposalToDraft(proposalId);
			await invalidateAll();
			toast.success('Proposal reverted to draft', 'You can now make changes');
		} catch (err) {
			console.error('Revert to draft error:', err);
			const message =
				err instanceof Error
					? err.message
					: typeof err === 'string'
						? err
						: JSON.stringify(err);
			toast.error('Failed to revert to draft', message || 'Unknown error');
		} finally {
			isRevertingToDraft = false;
		}
	}

	function viewPublic() {
		window.open(`/p/${proposal.slug}?preview=true`, '_blank');
	}

	function goBack() {
		goto(`/${agencySlug}/proposals`);
	}

	// AI Generation handlers
	function handleGenerateWithAI() {
		const sectionsToGenerate = Object.entries(selectedSections)
			.filter(([_, selected]) => selected)
			.map(([key]) => key);

		if (sectionsToGenerate.length === 0) {
			toast.error('No sections selected', 'Please select at least one section to generate');
			return;
		}

		// Close section selection modal and show streaming modal
		showAIModal = false;
		isGenerating = true;
		aiError = null;
		showStreamingModal = true;
	}

	// Called when streaming completes successfully
	function handleStreamingComplete(
		content: AIProposalOutput,
		transformed: Record<string, unknown>,
		generated: string[],
		failed: string[],
		performanceData: Record<string, unknown> | null
	) {
		showStreamingModal = false;
		isGenerating = false;
		generatedContent = content;
		transformedContent = transformed;
		generatedSections = generated;
		failedSections = failed;
		syncedPerformanceData = performanceData; // Store fresh PageSpeed data

		// Show preview modal for review (content stays in memory until Apply/Discard)
		showPreviewModal = true;
	}

	// Called when streaming encounters an error
	function handleStreamingError(code: AIErrorCode, message: string) {
		showStreamingModal = false;
		isGenerating = false;
		aiError = code;
		toast.error('Generation failed', message);
	}

	// Called when user cancels streaming
	function handleStreamingCancel() {
		showStreamingModal = false;
		isGenerating = false;
	}

	function handleApplyGenerated(sectionKeys: string[]) {
		if (!transformedContent) return;

		for (const key of sectionKeys) {
			if (transformedContent[key] !== undefined) {
				if (key === 'executiveSummary') {
					formData.executiveSummary = transformedContent[key] as string;
				} else if (key === 'opportunityContent') {
					formData.opportunityContent = transformedContent[key] as string;
				} else if (key === 'currentIssues') {
					formData.currentIssues = transformedContent[key] as ChecklistItem[];
				} else if (key === 'performanceStandards') {
					formData.performanceStandards = transformedContent[key] as PerformanceStandard[];
				} else if (key === 'proposedPages') {
					formData.proposedPages = transformedContent[key] as ProposedPage[];
				} else if (key === 'timeline') {
					formData.timeline = transformedContent[key] as TimelinePhase[];
				} else if (key === 'nextSteps') {
					formData.nextSteps = transformedContent[key] as NextStepItem[];
				} else if (key === 'closingContent') {
					formData.closingContent = transformedContent[key] as string;
				}
			}
		}

		// Also sync fresh PageSpeed data from consultation
		if (syncedPerformanceData) {
			formData.performanceData = syncedPerformanceData as PerformanceData;
		}

		showPreviewModal = false;
		generatedContent = null;
		transformedContent = null;
		syncedPerformanceData = null;
		toast.success('Content applied', 'AI-generated content has been applied. Click Save to persist changes.');
	}

	function handleClosePreview() {
		// Just close the modal, keep content so user can re-open
		showPreviewModal = false;
	}

	function handleDiscardGenerated() {
		// Discard all generated content
		showPreviewModal = false;
		generatedContent = null;
		transformedContent = null;
		syncedPerformanceData = null;
		toast.info('Content discarded', 'AI-generated content has been discarded.');
	}

	function handleRetryGeneration() {
		aiError = null;
		showAIModal = true;
	}

	// Check if a section has existing content
	function sectionHasContent(sectionKey: string): boolean {
		switch (sectionKey) {
			case 'executiveSummary':
				return !!formData.executiveSummary;
			case 'opportunityContent':
				return !!formData.opportunityContent;
			case 'currentIssues':
				return formData.currentIssues.length > 0;
			case 'performanceStandards':
				return formData.performanceStandards.length > 0;
			case 'proposedPages':
				return formData.proposedPages.length > 0;
			case 'timeline':
				return formData.timeline.length > 0;
			case 'nextSteps':
				return formData.nextSteps.length > 0;
			case 'closingContent':
				return !!formData.closingContent;
			default:
				return false;
		}
	}
</script>

<svelte:head>
	<title>Edit Proposal | Webkit</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<div class="bg-base-100 border-b border-base-300">
		<div class="card-body p-4">
				<!-- Top row: Back button + Title -->
				<div class="flex items-start gap-3">
					<button type="button" class="btn btn-ghost btn-sm btn-square shrink-0" onclick={goBack}>
						<ChevronLeft class="h-4 w-4" />
					</button>
					<div class="min-w-0 flex-1">
						<h1 class="text-lg font-semibold">{proposal.proposalNumber}</h1>
						<p class="text-base-content/60 text-sm line-clamp-2">{formData.title}</p>
					</div>
				</div>
				<!-- Bottom row: Action buttons -->
				<div class="flex flex-wrap items-center justify-center sm:justify-between gap-2 mt-3 pt-3 border-t border-base-200">
					<div class="flex flex-wrap items-center justify-center gap-2">
						<button
							type="button"
							class="btn btn-outline btn-sm"
							onclick={handleSave}
							disabled={isSaving}
						>
							{#if isSaving}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Save class="h-4 w-4" />
							{/if}
							Save
						</button>
						<button
							type="button"
							class="btn btn-secondary btn-sm"
							onclick={() => {
								// If we have generated content waiting for review, show preview instead
								if (generatedContent) {
									showPreviewModal = true;
								} else {
									showAIModal = true;
								}
							}}
							disabled={isGenerating}
						>
							{#if isGenerating}
								<span class="loading loading-spinner loading-sm"></span>
								Generating...
							{:else if generatedContent}
								<Sparkles class="h-4 w-4" />
								Review AI
								<span class="badge badge-xs badge-warning">!</span>
							{:else}
								<Sparkles class="h-4 w-4" />
								AI
							{/if}
						</button>
						{#if proposal.status === 'draft'}
							<button
								type="button"
								class="btn btn-outline btn-sm"
								onclick={handleMarkReady}
								disabled={isMarkingReady}
							>
								{#if isMarkingReady}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									<CheckCircle2 class="h-4 w-4" />
								{/if}
								Ready
							</button>
						{/if}
						{#if proposal.status === 'ready'}
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={handleRevertToDraft}
								disabled={isRevertingToDraft}
							>
								{#if isRevertingToDraft}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									<ChevronLeft class="h-4 w-4" />
								{/if}
								Back to Draft
							</button>
						{/if}
						{#if proposal.status === 'draft' || proposal.status === 'ready' || proposal.status === 'revision_requested'}
							<button
								type="button"
								class="btn btn-primary btn-sm"
								onclick={() => openSendModal(proposal.status === 'revision_requested')}
								disabled={sendingEmail}
							>
								{#if sendingEmail}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									<Send class="h-4 w-4" />
								{/if}
								{proposal.status === 'revision_requested' ? 'Resend' : 'Send'}
							</button>
						{/if}
					</div>
					<!-- Preview in dropdown -->
					<div class="dropdown dropdown-end">
						<button type="button" tabindex="0" class="btn btn-outline btn-sm gap-1">
							<MoreHorizontal class="h-4 w-4" />
							More
						</button>
						<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
							<li>
								<button type="button" onclick={viewPublic}>
									<Eye class="h-4 w-4" />
									Preview
								</button>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>

	<!-- Status Banner for revision_requested (PART 2) -->
	{#if proposal.status === 'revision_requested'}
		<div class="bg-warning text-warning-content px-4 py-3">
			<div class="mx-auto max-w-4xl">
				<div class="flex items-start gap-3">
					<MessageSquare class="h-5 w-5 shrink-0 mt-0.5" />
					<div>
						<p class="font-semibold">Client requested revisions</p>
						{#if revisionRequestNotes}
							<p class="mt-1 text-sm opacity-90">{revisionRequestNotes}</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Mobile Section Navigation -->
	<div class="lg:hidden border-b border-base-300 bg-base-100">
		<div class="flex overflow-x-auto px-2 py-2 gap-1 scrollbar-none">
			{#each sections as section}
				{@const SectionIcon = section.icon}
				<button
					type="button"
					class="btn btn-sm shrink-0 gap-1 {activeSection === section.id ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => (activeSection = section.id)}
				>
					<SectionIcon class="h-3.5 w-3.5" />
					{section.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex flex-1">
		<!-- Sidebar Navigation (Desktop only) -->
		<aside class="bg-base-200 hidden w-48 shrink-0 p-4 lg:block">
			<nav class="space-y-1">
				{#each sections as section}
					{@const SectionIcon = section.icon}
					<button
						type="button"
						class="btn btn-ghost btn-sm w-full justify-start {activeSection === section.id ? 'btn-active' : ''}"
						onclick={() => (activeSection = section.id)}
					>
						<SectionIcon class="h-4 w-4" />
						{section.label}
					</button>
				{/each}
			</nav>
		</aside>

		<!-- Main Content -->
		<main class="flex-1 overflow-y-auto py-4 lg:p-6">
			<div class="mx-auto max-w-3xl space-y-4 lg:space-y-6">
				<!-- Client Info Section -->
				{#if activeSection === 'client'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Client Information</h2>
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="form-control">
									<label class="label" for="client-business">
										<span class="label-text">Business Name</span>
									</label>
									<input
										type="text"
										id="client-business"
										class="input input-bordered"
										bind:value={formData.clientBusinessName}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="client-contact">
										<span class="label-text">Contact Name</span>
									</label>
									<input
										type="text"
										id="client-contact"
										class="input input-bordered"
										bind:value={formData.clientContactName}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="client-email">
										<span class="label-text">Email</span>
									</label>
									<input
										type="email"
										id="client-email"
										class="input input-bordered"
										bind:value={formData.clientEmail}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="client-phone">
										<span class="label-text">Phone</span>
									</label>
									<input
										type="tel"
										id="client-phone"
										class="input input-bordered"
										bind:value={formData.clientPhone}
									/>
								</div>
								<div class="form-control sm:col-span-2">
									<label class="label" for="client-website">
										<span class="label-text">Current Website</span>
									</label>
									<input
										type="url"
										id="client-website"
										class="input input-bordered"
										bind:value={formData.clientWebsite}
										placeholder="https://"
									/>
								</div>
							</div>
						</div>
					</section>

					<!-- Cover Section -->
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Cover</h2>
							<div class="form-control">
								<label class="label" for="proposal-title">
									<span class="label-text">Proposal Title</span>
								</label>
								<input
									type="text"
									id="proposal-title"
									class="input input-bordered"
									bind:value={formData.title}
								/>
							</div>
							<div class="form-control">
								<label class="label" for="valid-until">
									<span class="label-text">Valid Until</span>
								</label>
								<input
									type="date"
									id="valid-until"
									class="input input-bordered"
									bind:value={formData.validUntil}
								/>
							</div>
						</div>
					</section>
				{/if}

				<!-- Executive Summary Section (PART 2) -->
				{#if activeSection === 'summary'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">
								<FileSignature class="h-5 w-5" />
								Executive Summary
							</h2>
							<p class="text-base-content/60 text-sm">
								A brief overview of the proposal highlighting key benefits and value proposition.
							</p>
							<textarea
								class="textarea textarea-bordered w-full min-h-48"
								bind:value={formData.executiveSummary}
								placeholder="Summarize the key points of this proposal: what problem you're solving, your recommended solution, expected outcomes, and why your agency is the right choice..."
							></textarea>
						</div>
					</section>
				{/if}

				<!-- Performance Section -->
				{#if activeSection === 'performance'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Current Website Performance</h2>
							<p class="text-base-content/60 text-sm">
								Enter PageSpeed Insights scores from analyzing the client's current website.
							</p>

							<div class="grid gap-4 sm:grid-cols-2">
								<div class="form-control">
									<label class="label" for="perf-score">
										<span class="label-text">Performance (0-100)</span>
									</label>
									<input
										type="number"
										id="perf-score"
										class="input input-bordered"
										min="0"
										max="100"
										bind:value={formData.performanceData.performance}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="acc-score">
										<span class="label-text">Accessibility (0-100)</span>
									</label>
									<input
										type="number"
										id="acc-score"
										class="input input-bordered"
										min="0"
										max="100"
										bind:value={formData.performanceData.accessibility}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="bp-score">
										<span class="label-text">Best Practices (0-100)</span>
									</label>
									<input
										type="number"
										id="bp-score"
										class="input input-bordered"
										min="0"
										max="100"
										bind:value={formData.performanceData.bestPractices}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="seo-score">
										<span class="label-text">SEO (0-100)</span>
									</label>
									<input
										type="number"
										id="seo-score"
										class="input input-bordered"
										min="0"
										max="100"
										bind:value={formData.performanceData.seo}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="load-time">
										<span class="label-text">Load Time</span>
									</label>
									<input
										type="text"
										id="load-time"
										class="input input-bordered"
										placeholder="4.2s"
										bind:value={formData.performanceData.loadTime}
									/>
								</div>
							</div>

							<!-- Performance Standards -->
							<div class="divider">Promised Standards</div>
							<p class="text-base-content/60 text-sm">
								What metrics will the new site achieve?
							</p>

							<div class="space-y-2">
								{#each formData.performanceStandards as standard, index}
									<div class="flex gap-2">
										<input
											type="text"
											class="input input-bordered input-sm flex-1"
											placeholder="Label (e.g., Page Load)"
											bind:value={standard.label}
										/>
										<input
											type="text"
											class="input input-bordered input-sm w-32"
											placeholder="Value (e.g., <2s)"
											bind:value={standard.value}
										/>
										<button
											type="button"
											class="btn btn-ghost btn-sm text-error"
											onclick={() => removePerformanceStandard(index)}
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								{/each}
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={addPerformanceStandard}
								>
									<Plus class="h-4 w-4" />
									Add Standard
								</button>
							</div>
						</div>
					</section>
				{/if}

				<!-- Content Section -->
				{#if activeSection === 'content'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">The Opportunity</h2>
							<p class="text-base-content/60 text-sm">
								Research about the client's industry and business opportunity.
							</p>
							<textarea
								class="textarea textarea-bordered w-full min-h-32"
								bind:value={formData.opportunityContent}
								placeholder="Write about the market opportunity, industry trends, and how a new website can help..."
							></textarea>
						</div>
					</section>

					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Current Issues We'll Solve</h2>
							<div class="space-y-2">
								{#each formData.currentIssues as issue, index}
									<div class="flex items-center gap-2">
										<input
											type="checkbox"
											class="checkbox checkbox-sm"
											bind:checked={issue.checked}
										/>
										<input
											type="text"
											class="input input-bordered input-sm flex-1"
											bind:value={issue.text}
											placeholder="Describe an issue..."
										/>
										<button
											type="button"
											class="btn btn-ghost btn-sm text-error"
											onclick={() => {
												formData.currentIssues = removeChecklistItem(formData.currentIssues, index);
											}}
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								{/each}
								<button
									type="button"
									class="btn btn-ghost btn-sm"
									onclick={() => {
										formData.currentIssues = addChecklistItem(formData.currentIssues);
									}}
								>
									<Plus class="h-4 w-4" />
									Add Issue
								</button>
							</div>
						</div>
					</section>

					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">ROI Analysis</h2>
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="form-control">
									<label class="label" for="current-visitors">
										<span class="label-text">Current Monthly Visitors</span>
									</label>
									<input
										type="number"
										id="current-visitors"
										class="input input-bordered"
										bind:value={formData.roiAnalysis.currentVisitors}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="projected-visitors">
										<span class="label-text">Projected Monthly Visitors</span>
									</label>
									<input
										type="number"
										id="projected-visitors"
										class="input input-bordered"
										bind:value={formData.roiAnalysis.projectedVisitors}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="conversion-rate">
										<span class="label-text">Conversion Rate (%)</span>
									</label>
									<input
										type="number"
										id="conversion-rate"
										class="input input-bordered"
										step="0.1"
										bind:value={formData.roiAnalysis.conversionRate}
									/>
								</div>
								<div class="form-control">
									<label class="label" for="projected-leads">
										<span class="label-text">Projected Monthly Leads</span>
									</label>
									<input
										type="number"
										id="projected-leads"
										class="input input-bordered"
										bind:value={formData.roiAnalysis.projectedLeads}
									/>
								</div>
							</div>
						</div>
					</section>

					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Local Advantage</h2>
							<textarea
								class="textarea textarea-bordered w-full min-h-24"
								bind:value={formData.localAdvantageContent}
								placeholder="Describe local SEO benefits, community presence..."
							></textarea>
						</div>
					</section>
				{/if}

				<!-- Package Section -->
				{#if activeSection === 'package'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Package Selection</h2>

							<div class="form-control">
								<label class="label" for="package-select">
									<span class="label-text">Select Package</span>
								</label>
								<select
									id="package-select"
									class="select select-bordered"
									bind:value={formData.selectedPackageId}
								>
									<option value="">Custom Pricing</option>
									{#each packages as pkg}
										<option value={pkg.id}>{pkg.name}</option>
									{/each}
								</select>
							</div>

							{#if addons.length > 0}
								<div class="form-control">
									<span class="label">
										<span class="label-text">Add-ons</span>
									</span>
									<div class="flex flex-wrap gap-2">
										{#each addons as addon}
											<label class="label cursor-pointer gap-2">
												<input
													type="checkbox"
													class="checkbox checkbox-sm"
													checked={formData.selectedAddons.includes(addon.id)}
													onchange={(e) => {
														const target = e.target as HTMLInputElement;
														if (target.checked) {
															formData.selectedAddons = [...formData.selectedAddons, addon.id];
														} else {
															formData.selectedAddons = formData.selectedAddons.filter(
																(id) => id !== addon.id
															);
														}
													}}
												/>
												<span class="label-text">{addon.name} (${addon.price})</span>
											</label>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Timeline Section -->
				{#if activeSection === 'timeline'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Implementation Timeline</h2>

							<div class="space-y-4">
								{#each formData.timeline as phase, index}
									<div class="rounded-lg border p-4">
										<div class="flex items-start justify-between">
											<div class="grid flex-1 gap-3 sm:grid-cols-3">
												<div class="form-control">
													<label class="label" for="timeline-week-{index}">
														<span class="label-text">Week(s)</span>
													</label>
													<input
														type="text"
														id="timeline-week-{index}"
														class="input input-bordered input-sm"
														placeholder="1-2"
														bind:value={phase.week}
													/>
												</div>
												<div class="form-control sm:col-span-2">
													<label class="label" for="timeline-title-{index}">
														<span class="label-text">Phase Title</span>
													</label>
													<input
														type="text"
														id="timeline-title-{index}"
														class="input input-bordered input-sm"
														placeholder="Discovery & Design"
														bind:value={phase.title}
													/>
												</div>
											</div>
											<button
												type="button"
												class="btn btn-ghost btn-sm text-error"
												onclick={() => removeTimelinePhase(index)}
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
										<div class="form-control mt-2">
											<textarea
												class="textarea textarea-bordered w-full textarea-sm"
												placeholder="What happens in this phase..."
												bind:value={phase.description}
											></textarea>
										</div>
									</div>
								{/each}

								<button type="button" class="btn btn-ghost btn-sm" onclick={addTimelinePhase}>
									<Plus class="h-4 w-4" />
									Add Phase
								</button>
							</div>
						</div>
					</section>
				{/if}

				<!-- Architecture Section -->
				{#if activeSection === 'architecture'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Proposed Site Architecture</h2>

							<div class="space-y-4">
								{#each formData.proposedPages as page, index}
									<div class="rounded-lg border p-4">
										<div class="flex items-start justify-between">
											<div class="flex-1 space-y-3">
												<div class="form-control">
													<label class="label" for="page-name-{index}">
														<span class="label-text">Page Name</span>
													</label>
													<input
														type="text"
														id="page-name-{index}"
														class="input input-bordered input-sm"
														placeholder="Home"
														bind:value={page.name}
													/>
												</div>
												<div class="form-control">
													<label class="label" for="page-desc-{index}">
														<span class="label-text">Description</span>
													</label>
													<textarea
														id="page-desc-{index}"
														class="textarea textarea-bordered w-full textarea-sm"
														placeholder="What this page will include..."
														bind:value={page.description}
													></textarea>
												</div>
											</div>
											<button
												type="button"
												class="btn btn-ghost btn-sm text-error"
												onclick={() => removeProposedPage(index)}
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</div>
								{/each}

								<button type="button" class="btn btn-ghost btn-sm" onclick={addProposedPage}>
									<Plus class="h-4 w-4" />
									Add Page
								</button>
							</div>
						</div>
					</section>
				{/if}

				<!-- Next Steps Section (PART 2) -->
				{#if activeSection === 'nextsteps'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">
								<ListChecks class="h-5 w-5" />
								Next Steps
							</h2>
							<p class="text-base-content/60 text-sm">
								Define the action items for moving forward after the client accepts this proposal.
							</p>

							<div class="space-y-2">
								{#each formData.nextSteps as step, index}
									<div class="flex items-center gap-2">
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											onclick={() => toggleNextStep(index)}
											title={step.completed ? 'Mark as incomplete' : 'Mark as complete'}
										>
											{#if step.completed}
												<Check class="h-4 w-4 text-success" />
											{:else}
												<div class="h-4 w-4 rounded border-2 border-base-content/30"></div>
											{/if}
										</button>
										<input
											type="text"
											class="input input-bordered input-sm flex-1"
											class:line-through={step.completed}
											class:opacity-60={step.completed}
											bind:value={step.text}
											placeholder="e.g., Schedule kickoff meeting"
										/>
										<button
											type="button"
											class="btn btn-ghost btn-sm text-error"
											onclick={() => removeNextStep(index)}
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								{/each}

								<button type="button" class="btn btn-ghost btn-sm" onclick={addNextStep}>
									<Plus class="h-4 w-4" />
									Add Step
								</button>
							</div>
						</div>
					</section>
				{/if}

				<!-- Closing Section -->
				{#if activeSection === 'closing'}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">Closing Message</h2>
							<textarea
								class="textarea textarea-bordered w-full min-h-32"
								bind:value={formData.closingContent}
								placeholder="A personal message to close the proposal..."
							></textarea>
						</div>
					</section>
				{/if}

				<!-- Client Feedback Section (PART 2: Proposal Improvements) -->
				{#if activeSection === 'feedback' && hasClientFeedback}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">
								<MessageSquare class="h-5 w-5" />
								Client Feedback
							</h2>
							<p class="text-base-content/60 text-sm">
								Feedback received from the client about this proposal.
							</p>

							{#if revisionRequestNotes}
								<div class="mt-4 rounded-lg bg-warning/10 border border-warning/30 p-4">
									<h3 class="font-semibold text-sm text-warning mb-2">Revision Request</h3>
									<p class="text-sm whitespace-pre-wrap">{revisionRequestNotes}</p>
									{#if proposal.revisionRequestedAt}
										<p class="text-xs text-base-content/60 mt-2">
											Requested on {new Date(proposal.revisionRequestedAt).toLocaleDateString('en-AU', {
												day: 'numeric',
												month: 'long',
												year: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</p>
									{/if}
								</div>
							{/if}

							{#if clientComments}
								<div class="mt-4 rounded-lg bg-success/10 border border-success/30 p-4">
									<h3 class="font-semibold text-sm text-success mb-2">Acceptance Comments</h3>
									<p class="text-sm whitespace-pre-wrap">{clientComments}</p>
									{#if proposal.acceptedAt}
										<p class="text-xs text-base-content/60 mt-2">
											Accepted on {new Date(proposal.acceptedAt).toLocaleDateString('en-AU', {
												day: 'numeric',
												month: 'long',
												year: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</p>
									{/if}
								</div>
							{/if}

							{#if declineReason}
								<div class="mt-4 rounded-lg bg-error/10 border border-error/30 p-4">
									<h3 class="font-semibold text-sm text-error mb-2">Decline Reason</h3>
									<p class="text-sm whitespace-pre-wrap">{declineReason}</p>
									{#if proposal.declinedAt}
										<p class="text-xs text-base-content/60 mt-2">
											Declined on {new Date(proposal.declinedAt).toLocaleDateString('en-AU', {
												day: 'numeric',
												month: 'long',
												year: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</p>
									{/if}
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Consultation Insights Section (PART 2) -->
				{#if activeSection === 'insights' && hasConsultationInsights}
					<section class="card bg-base-100 shadow mx-2 lg:mx-0">
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title">
								<Lightbulb class="h-5 w-5" />
								Consultation Insights
							</h2>
							<p class="text-base-content/60 text-sm">
								Data captured from the linked consultation for reference while building this proposal.
							</p>

							{#if consultationChallenges.length > 0}
								<div class="mt-4">
									<h3 class="font-semibold text-sm mb-2">Key Challenges</h3>
									<ul class="list-disc list-inside space-y-1 text-sm">
										{#each consultationChallenges as challenge}
											<li class="text-base-content/80">{challenge}</li>
										{/each}
									</ul>
								</div>
							{/if}

							{#if consultationPainPoints.primary_challenges?.length || consultationPainPoints.technical_issues?.length}
								<div class="mt-4">
									<h3 class="font-semibold text-sm mb-2">Pain Points</h3>
									<div class="grid gap-4 sm:grid-cols-2">
										{#if consultationPainPoints.primary_challenges?.length}
											<div>
												<p class="text-xs text-base-content/60 mb-1">Primary Challenges</p>
												<ul class="list-disc list-inside space-y-1 text-sm">
													{#each consultationPainPoints.primary_challenges as item}
														<li class="text-base-content/80">{item}</li>
													{/each}
												</ul>
											</div>
										{/if}
										{#if consultationPainPoints.technical_issues?.length}
											<div>
												<p class="text-xs text-base-content/60 mb-1">Technical Issues</p>
												<ul class="list-disc list-inside space-y-1 text-sm">
													{#each consultationPainPoints.technical_issues as item}
														<li class="text-base-content/80">{item}</li>
													{/each}
												</ul>
											</div>
										{/if}
									</div>
								</div>
							{/if}

							{#if consultationGoals.primary_goals?.length || consultationGoals.secondary_goals?.length}
								<div class="mt-4">
									<h3 class="font-semibold text-sm mb-2">Client Goals</h3>
									<div class="grid gap-4 sm:grid-cols-2">
										{#if consultationGoals.primary_goals?.length}
											<div>
												<p class="text-xs text-base-content/60 mb-1">Primary Goals</p>
												<ul class="list-disc list-inside space-y-1 text-sm">
													{#each consultationGoals.primary_goals as item}
														<li class="text-base-content/80">{item}</li>
													{/each}
												</ul>
											</div>
										{/if}
										{#if consultationGoals.secondary_goals?.length}
											<div>
												<p class="text-xs text-base-content/60 mb-1">Secondary Goals</p>
												<ul class="list-disc list-inside space-y-1 text-sm">
													{#each consultationGoals.secondary_goals as item}
														<li class="text-base-content/80">{item}</li>
													{/each}
												</ul>
											</div>
										{/if}
									</div>
								</div>
							{/if}

							{#if consultationGoals.success_metrics?.length}
								<div class="mt-4">
									<h3 class="font-semibold text-sm mb-2">Success Metrics</h3>
									<ul class="list-disc list-inside space-y-1 text-sm">
										{#each consultationGoals.success_metrics as metric}
											<li class="text-base-content/80">{metric}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Email History - Always visible -->
				<section class="card bg-base-100 shadow mx-2 lg:mx-0">
					<div class="card-body p-4 sm:p-6">
						<EmailHistory proposalId={proposal.id} />
					</div>
				</section>
			</div>
		</main>
	</div>
</div>

<!-- AI Section Selection Modal -->
{#if showAIModal}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-md">
			<h3 class="font-bold text-lg flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-secondary" />
				Generate with AI
			</h3>
			<p class="text-base-content/60 text-sm mt-2">
				Select the sections you want to generate. Latest PageSpeed audit data from the consultation
				will be synced automatically.
			</p>

			<!-- Warning banner -->
			<div class="alert alert-warning mt-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="stroke-current shrink-0 h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<span class="text-sm">Selected sections will be replaced. Review before applying.</span>
			</div>

			<div class="mt-4 flex flex-col gap-1">
				{#each ALL_SECTIONS as sectionKey}
					<label class="flex flex-row items-center gap-3 p-2 rounded hover:bg-base-200 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={selectedSections[sectionKey]}
							class="checkbox checkbox-sm checkbox-secondary shrink-0"
						/>
						<span class="flex-1 text-sm truncate">{SECTION_DISPLAY_NAMES[sectionKey]}</span>
						{#if sectionHasContent(sectionKey)}
							<span class="badge badge-ghost badge-xs shrink-0 whitespace-nowrap">Has content</span>
						{/if}
					</label>
				{/each}
			</div>

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => (showAIModal = false)}>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-secondary"
					onclick={handleGenerateWithAI}
					disabled={isGenerating || !Object.values(selectedSections).some(Boolean)}
				>
					{#if isGenerating}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Sparkles class="h-4 w-4" />
					{/if}
					Generate
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (showAIModal = false)}>close</button>
		</form>
	</dialog>
{/if}

<!-- AI Error Display -->
{#if aiError}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-md">
			<AIErrorDisplay
				errorCode={aiError}
				onRetry={handleRetryGeneration}
				onUpgrade={() => goto(`/${agencySlug}/settings/billing`)}
				onContactSupport={() => window.open('mailto:support@webkit.au', '_blank')}
			/>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => (aiError = null)}>Close</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (aiError = null)}>close</button>
		</form>
	</dialog>
{/if}

<!-- AI Streaming Modal -->
{#if showStreamingModal}
	<AIStreamingModal
		{proposalId}
		sections={Object.entries(selectedSections)
			.filter(([_, selected]) => selected)
			.map(([key]) => key)}
		onComplete={handleStreamingComplete}
		onError={handleStreamingError}
		onCancel={handleStreamingCancel}
	/>
{/if}

<!-- AI Preview Modal -->
{#if showPreviewModal && generatedContent}
	<AIPreviewModal
		isOpen={showPreviewModal}
		generatedContent={generatedContent}
		currentContent={{
			executiveSummary: formData.executiveSummary,
			opportunityContent: formData.opportunityContent || '',
			currentIssues: formData.currentIssues,
			performanceStandards: formData.performanceStandards,
			proposedPages: formData.proposedPages,
			timeline: formData.timeline,
			nextSteps: formData.nextSteps,
			closingContent: formData.closingContent || ''
		}}
		selectedSections={generatedSections}
		onapply={({ sections }) => handleApplyGenerated(sections)}
		ondiscard={handleDiscardGenerated}
		onclose={handleClosePreview}
	/>
{/if}

<!-- Send Email Modal -->
<SendEmailModal
	open={sendModalOpen}
	title={isResend ? 'Resend Proposal' : 'Send Proposal'}
	documentType="proposal"
	recipientEmail={formData.clientEmail}
	recipientName={formData.clientContactName || formData.clientBusinessName}
	loading={sendingEmail}
	onConfirm={confirmSendEmail}
	onCancel={() => sendModalOpen = false}
/>

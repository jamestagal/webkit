<script lang="ts">
	/**
	 * Agency-Scoped Consultation View Page v2
	 */

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getConsultation } from '$lib/api/consultation.remote';
	import {
		INDUSTRY_OPTIONS,
		BUSINESS_TYPE_OPTIONS,
		WEBSITE_STATUS_OPTIONS,
		URGENCY_LEVEL_OPTIONS,
		URGENCY_COLORS,
		PRIMARY_GOALS_OPTIONS,
		CONVERSION_GOAL_OPTIONS,
		BUDGET_RANGE_OPTIONS,
		TIMELINE_OPTIONS,
		DESIGN_STYLE_OPTIONS
	} from '$lib/config/consultation-options';
	import Button from '$lib/components/Button.svelte';
	import PageSpeedAudit from '$lib/components/audit/PageSpeedAudit.svelte';
	import type { PerformanceData } from '$lib/server/schema';

	// Get agency slug and consultation ID from URL params
	const agencySlug = page.params.agencySlug;
	const consultationId = page.params.id;

	// Load consultation data
	const consultation = await getConsultation(consultationId);

	function formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		const d = new Date(date);
		const datePart = d.toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
		const timePart = d.toLocaleTimeString('en-AU', {
			hour: '2-digit',
			minute: '2-digit'
		});
		return `${datePart} at ${timePart}`;
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'bg-green-100 text-green-800';
			case 'draft':
				return 'bg-yellow-100 text-yellow-800';
			case 'converted':
				return 'bg-blue-100 text-blue-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function goBack() {
		goto(`/${agencySlug}/consultation/history`);
	}

	function editConsultation() {
		goto(`/${agencySlug}/consultation/edit/${consultationId}`);
	}

	// Helper functions to get labels from option values
	function getLabel(options: { value: string; label: string }[], value: string | null): string {
		if (!value) return 'N/A';
		return options.find((o) => o.value === value)?.label ?? value;
	}

	function getLabels(options: { value: string; label: string }[], values: string[]): string[] {
		return values.map((v) => options.find((o) => o.value === v)?.label ?? v);
	}
</script>

<svelte:head>
	<title>{consultation.businessName || 'Consultation'} | Webkit</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<button
				type="button"
				onclick={goBack}
				class="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
			>
				<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Back to My Consultations
			</button>

			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900">
						{consultation.businessName || 'Consultation Details'}
					</h1>
					<div class="mt-2 flex items-center gap-4">
						<span
							class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {getStatusBadgeClass(
								consultation.status
							)}"
						>
							{consultation.status === 'completed' ? 'Completed' : consultation.status}
						</span>
						<span class="text-sm text-gray-500">
							Created {formatDate(consultation.createdAt)}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Step 1: Contact & Business -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Contact & Business</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<dt class="text-sm font-medium text-gray-500">Business Name</dt>
					<dd class="mt-1 text-sm text-gray-900">{consultation.businessName || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Contact Person</dt>
					<dd class="mt-1 text-sm text-gray-900">{consultation.contactPerson || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Email</dt>
					<dd class="mt-1 text-sm text-gray-900">
						<a href="mailto:{consultation.email}" class="text-indigo-600 hover:text-indigo-800">
							{consultation.email}
						</a>
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Phone</dt>
					<dd class="mt-1 text-sm text-gray-900">{consultation.phone || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Website</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{#if consultation.website}
							<a
								href={consultation.website}
								target="_blank"
								rel="noopener noreferrer"
								class="text-indigo-600 hover:text-indigo-800"
							>
								{consultation.website}
							</a>
						{:else}
							N/A
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Industry</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{getLabel(INDUSTRY_OPTIONS, consultation.industry)}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Business Type</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{getLabel(BUSINESS_TYPE_OPTIONS, consultation.businessType)}
					</dd>
				</div>
			</div>
			<!-- Social Media -->
			{#if consultation.socialLinkedin || consultation.socialFacebook || consultation.socialInstagram}
				<div class="mt-4 border-t pt-4">
					<dt class="text-sm font-medium text-gray-500">Social Media</dt>
					<dd class="mt-2 flex flex-wrap gap-3 text-sm">
						{#if consultation.socialLinkedin}
							<a
								href={consultation.socialLinkedin}
								target="_blank"
								rel="noopener noreferrer"
								class="text-indigo-600 hover:text-indigo-800"
							>
								LinkedIn
							</a>
						{/if}
						{#if consultation.socialFacebook}
							<a
								href={consultation.socialFacebook}
								target="_blank"
								rel="noopener noreferrer"
								class="text-indigo-600 hover:text-indigo-800"
							>
								Facebook
							</a>
						{/if}
						{#if consultation.socialInstagram}
							<a
								href={consultation.socialInstagram}
								target="_blank"
								rel="noopener noreferrer"
								class="text-indigo-600 hover:text-indigo-800"
							>
								Instagram
							</a>
						{/if}
					</dd>
				</div>
			{/if}
		</section>

		<!-- Website Performance Audit -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<div class="collapse collapse-arrow">
				<input type="checkbox" checked={!!consultation.performanceData} />
				<div class="collapse-title flex items-center gap-2 p-0 text-lg font-semibold text-gray-900">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-5 w-5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
						/>
					</svg>
					Website Performance Audit
					{#if (consultation.performanceData as PerformanceData | null)?.performance}
						<span class="badge badge-primary ml-2">
							{(consultation.performanceData as PerformanceData).performance}/100
						</span>
					{/if}
				</div>
				<div class="collapse-content p-0 pt-4">
					<PageSpeedAudit
						{consultationId}
						websiteUrl={consultation.website}
						existingData={consultation.performanceData as PerformanceData | null}
					/>
				</div>
			</div>
		</section>

		<!-- Step 2: Situation & Challenges -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Situation & Challenges</h2>
			<div class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">Website Status</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{getLabel(WEBSITE_STATUS_OPTIONS, consultation.websiteStatus)}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Urgency Level</dt>
						<dd class="mt-1">
							<span
								class="badge {URGENCY_COLORS[consultation.urgencyLevel] || 'badge-ghost'}"
							>
								{getLabel(URGENCY_LEVEL_OPTIONS, consultation.urgencyLevel)}
							</span>
						</dd>
					</div>
				</div>
				{#if consultation.primaryChallenges?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Primary Challenges</dt>
						<dd class="mt-2 flex flex-wrap gap-2">
							{#each consultation.primaryChallenges as challenge}
								<span class="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
									>{challenge}</span
								>
							{/each}
						</dd>
					</div>
				{/if}
			</div>
		</section>

		<!-- Step 3: Goals & Budget -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Goals & Budget</h2>
			<div class="space-y-4">
				{#if consultation.primaryGoals?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Primary Goals</dt>
						<dd class="mt-2 flex flex-wrap gap-2">
							{#each consultation.primaryGoals as goal}
								<span class="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
									>{goal}</span
								>
							{/each}
						</dd>
					</div>
				{/if}
				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<dt class="text-sm font-medium text-gray-500">Conversion Goal</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{getLabel(CONVERSION_GOAL_OPTIONS, consultation.conversionGoal ?? '')}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Budget Range</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{getLabel(BUDGET_RANGE_OPTIONS, consultation.budgetRange)}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Timeline</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{getLabel(TIMELINE_OPTIONS, consultation.timeline ?? '')}
						</dd>
					</div>
				</div>
			</div>
		</section>

		<!-- Step 4: Preferences & Notes -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Preferences & Notes</h2>
			<div class="space-y-4">
				{#if consultation.designStyles?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Design Styles</dt>
						<dd class="mt-2 flex flex-wrap gap-2">
							{#each getLabels(DESIGN_STYLE_OPTIONS, consultation.designStyles) as style}
								<span class="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700"
									>{style}</span
								>
							{/each}
						</dd>
					</div>
				{/if}
				{#if consultation.admiredWebsites}
					<div>
						<dt class="text-sm font-medium text-gray-500">Admired Websites</dt>
						<dd class="mt-1 whitespace-pre-line text-sm text-gray-900">
							{consultation.admiredWebsites}
						</dd>
					</div>
				{/if}
				{#if consultation.consultationNotes}
					<div>
						<dt class="text-sm font-medium text-gray-500">Consultation Notes</dt>
						<dd class="mt-1 whitespace-pre-line text-sm text-gray-900">
							{consultation.consultationNotes}
						</dd>
					</div>
				{/if}
			</div>
		</section>

		<!-- Metadata -->
		<section class="rounded-lg bg-gray-100 p-6">
			<h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
				Consultation Metadata
			</h2>
			<div class="grid gap-4 text-sm sm:grid-cols-3">
				<div>
					<dt class="font-medium text-gray-500">Consultation ID</dt>
					<dd class="mt-1 font-mono text-xs text-gray-700">{consultation.id}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-500">Created</dt>
					<dd class="mt-1 text-gray-700">{formatDate(consultation.createdAt)}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-500">Last Updated</dt>
					<dd class="mt-1 text-gray-700">{formatDate(consultation.updatedAt)}</dd>
				</div>
			</div>
		</section>

		<!-- Actions -->
		<div class="mt-8 flex justify-center gap-4">
			<Button variant="outline" onclick={goBack}>Back to My Consultations</Button>
			<Button variant="primary" onclick={editConsultation}>
				<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
					/>
				</svg>
				Edit Consultation
			</Button>
		</div>
	</div>
</div>

<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getConsultation } from '$lib/api/consultation.remote';
	import Button from '$lib/components/Button.svelte';

	// Get consultation ID from URL params
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

	function formatTimelineDate(date: string | null | undefined): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'bg-green-100 text-green-800';
			case 'draft':
				return 'bg-yellow-100 text-yellow-800';
			case 'in_review':
				return 'bg-blue-100 text-blue-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function goBack() {
		goto('/consultation/history');
	}

	function editConsultation() {
		goto(`/consultation/edit/${consultationId}`);
	}

	// Type helpers for JSONB fields
	type ContactInfo = {
		business_name?: string;
		contact_person?: string;
		email?: string;
		phone?: string;
		website?: string;
		social_media?: Record<string, string>;
	};

	type BusinessContext = {
		industry?: string;
		business_type?: string;
		team_size?: number;
		current_platform?: string;
		digital_presence?: string[];
		marketing_channels?: string[];
	};

	type PainPoints = {
		primary_challenges?: string[];
		technical_issues?: string[];
		urgency_level?: string;
		impact_assessment?: string;
		current_solution_gaps?: string[];
	};

	type GoalsObjectives = {
		primary_goals?: string[];
		secondary_goals?: string[];
		success_metrics?: string[];
		kpis?: string[];
		timeline?: {
			desired_start?: string;
			target_completion?: string;
			milestones?: string[];
		};
		budget_range?: string;
		budget_constraints?: string[];
	};

	const contactInfo = consultation.contactInfo as ContactInfo;
	const businessContext = consultation.businessContext as BusinessContext;
	const painPoints = consultation.painPoints as PainPoints;
	const goalsObjectives = consultation.goalsObjectives as GoalsObjectives;
</script>

<svelte:head>
	<title>{contactInfo?.business_name || 'Consultation'} | PropGen</title>
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
						{contactInfo?.business_name || 'Consultation Details'}
					</h1>
					<div class="mt-2 flex items-center gap-4">
						<span
							class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {getStatusBadgeClass(consultation.status)}"
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

		<!-- Contact Information -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Contact Information</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<dt class="text-sm font-medium text-gray-500">Business Name</dt>
					<dd class="mt-1 text-sm text-gray-900">{contactInfo?.business_name || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Contact Person</dt>
					<dd class="mt-1 text-sm text-gray-900">{contactInfo?.contact_person || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Email</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{#if contactInfo?.email}
							<a href="mailto:{contactInfo.email}" class="text-indigo-600 hover:text-indigo-800">
								{contactInfo.email}
							</a>
						{:else}
							N/A
						{/if}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Phone</dt>
					<dd class="mt-1 text-sm text-gray-900">{contactInfo?.phone || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Website</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{#if contactInfo?.website}
							<a
								href={contactInfo.website}
								target="_blank"
								rel="noopener noreferrer"
								class="text-indigo-600 hover:text-indigo-800"
							>
								{contactInfo.website}
							</a>
						{:else}
							N/A
						{/if}
					</dd>
				</div>
			</div>
		</section>

		<!-- Business Context -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Business Context</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<dt class="text-sm font-medium text-gray-500">Industry</dt>
					<dd class="mt-1 text-sm text-gray-900">{businessContext?.industry || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Business Type</dt>
					<dd class="mt-1 text-sm text-gray-900">{businessContext?.business_type || 'N/A'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Team Size</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{businessContext?.team_size ? `${businessContext.team_size} employees` : 'N/A'}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Current Platform</dt>
					<dd class="mt-1 text-sm text-gray-900">{businessContext?.current_platform || 'N/A'}</dd>
				</div>
				{#if businessContext?.digital_presence?.length}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500">Digital Presence</dt>
						<dd class="mt-1 flex flex-wrap gap-2">
							{#each businessContext.digital_presence as item}
								<span class="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{item}</span>
							{/each}
						</dd>
					</div>
				{/if}
				{#if businessContext?.marketing_channels?.length}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500">Marketing Channels</dt>
						<dd class="mt-1 flex flex-wrap gap-2">
							{#each businessContext.marketing_channels as channel}
								<span class="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">{channel}</span>
							{/each}
						</dd>
					</div>
				{/if}
			</div>
		</section>

		<!-- Pain Points -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Pain Points & Challenges</h2>
			<div class="space-y-4">
				{#if painPoints?.primary_challenges?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Primary Challenges</dt>
						<dd class="mt-2">
							<ul class="list-inside list-disc space-y-1 text-sm text-gray-900">
								{#each painPoints.primary_challenges as challenge}
									<li>{challenge}</li>
								{/each}
							</ul>
						</dd>
					</div>
				{/if}
				{#if painPoints?.technical_issues?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Technical Issues</dt>
						<dd class="mt-2">
							<ul class="list-inside list-disc space-y-1 text-sm text-gray-900">
								{#each painPoints.technical_issues as issue}
									<li>{issue}</li>
								{/each}
							</ul>
						</dd>
					</div>
				{/if}
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">Urgency Level</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium
								{painPoints?.urgency_level === 'critical' ? 'bg-red-100 text-red-800' : ''}
								{painPoints?.urgency_level === 'high' ? 'bg-orange-100 text-orange-800' : ''}
								{painPoints?.urgency_level === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
								{painPoints?.urgency_level === 'low' ? 'bg-green-100 text-green-800' : ''}"
							>
								{painPoints?.urgency_level || 'N/A'}
							</span>
						</dd>
					</div>
				</div>
				{#if painPoints?.impact_assessment}
					<div>
						<dt class="text-sm font-medium text-gray-500">Impact Assessment</dt>
						<dd class="mt-1 text-sm text-gray-900">{painPoints.impact_assessment}</dd>
					</div>
				{/if}
				{#if painPoints?.current_solution_gaps?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Current Solution Gaps</dt>
						<dd class="mt-2">
							<ul class="list-inside list-disc space-y-1 text-sm text-gray-900">
								{#each painPoints.current_solution_gaps as gap}
									<li>{gap}</li>
								{/each}
							</ul>
						</dd>
					</div>
				{/if}
			</div>
		</section>

		<!-- Goals & Objectives -->
		<section class="mb-6 rounded-lg bg-white p-6 shadow">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Goals & Objectives</h2>
			<div class="space-y-4">
				{#if goalsObjectives?.primary_goals?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Primary Goals</dt>
						<dd class="mt-2">
							<ul class="list-inside list-disc space-y-1 text-sm text-gray-900">
								{#each goalsObjectives.primary_goals as goal}
									<li>{goal}</li>
								{/each}
							</ul>
						</dd>
					</div>
				{/if}
				{#if goalsObjectives?.secondary_goals?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Secondary Goals</dt>
						<dd class="mt-2">
							<ul class="list-inside list-disc space-y-1 text-sm text-gray-900">
								{#each goalsObjectives.secondary_goals as goal}
									<li>{goal}</li>
								{/each}
							</ul>
						</dd>
					</div>
				{/if}
				{#if goalsObjectives?.success_metrics?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Success Metrics</dt>
						<dd class="mt-2 flex flex-wrap gap-2">
							{#each goalsObjectives.success_metrics as metric}
								<span class="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">{metric}</span>
							{/each}
						</dd>
					</div>
				{/if}
				{#if goalsObjectives?.kpis?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">KPIs</dt>
						<dd class="mt-2 flex flex-wrap gap-2">
							{#each goalsObjectives.kpis as kpi}
								<span class="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700">{kpi}</span>
							{/each}
						</dd>
					</div>
				{/if}
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">Budget Range</dt>
						<dd class="mt-1 text-sm text-gray-900">{goalsObjectives?.budget_range || 'N/A'}</dd>
					</div>
					{#if goalsObjectives?.timeline}
						<div>
							<dt class="text-sm font-medium text-gray-500">Timeline</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{#if goalsObjectives.timeline.desired_start}
									<span class="font-medium">Start:</span> {formatTimelineDate(goalsObjectives.timeline.desired_start)}
								{/if}
								{#if goalsObjectives.timeline.target_completion}
									<br /><span class="font-medium">Target:</span> {formatTimelineDate(goalsObjectives.timeline.target_completion)}
								{/if}
							</dd>
						</div>
					{/if}
				</div>
				{#if goalsObjectives?.budget_constraints?.length}
					<div>
						<dt class="text-sm font-medium text-gray-500">Budget Constraints</dt>
						<dd class="mt-2">
							<ul class="list-inside list-disc space-y-1 text-sm text-gray-900">
								{#each goalsObjectives.budget_constraints as constraint}
									<li>{constraint}</li>
								{/each}
							</ul>
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
				{#if consultation.completedAt}
					<div>
						<dt class="font-medium text-gray-500">Completed</dt>
						<dd class="mt-1 text-gray-700">{formatDate(consultation.completedAt)}</dd>
					</div>
				{/if}
				<div>
					<dt class="font-medium text-gray-500">Completion</dt>
					<dd class="mt-1 text-gray-700">{consultation.completionPercentage}%</dd>
				</div>
			</div>
		</section>

		<!-- Actions -->
		<div class="mt-8 flex justify-center gap-4">
			<Button variant="outline" onclick={goBack}>Back to My Consultations</Button>
			<Button variant="primary" onclick={editConsultation}>
				<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
				Edit Consultation
			</Button>
		</div>
	</div>
</div>

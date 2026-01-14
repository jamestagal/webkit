<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { deleteQuestionnaire } from '$lib/api/questionnaire.remote';
	import { FEATURES } from '$lib/config/features';
	import {
		Plus,
		MoreVertical,
		Eye,
		Trash2,
		Copy,
		ExternalLink,
		CheckCircle,
		Clock,
		AlertCircle,
		FileText,
		FileCheck,
		Play
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const feature = FEATURES.questionnaires;
	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);

	// Filter state
	let statusFilter = $state<string | null>(null);

	// Filtered questionnaires
	let filteredQuestionnaires = $derived(() => {
		if (!statusFilter) return data.questionnaires;
		return data.questionnaires.filter((q) => q.status === statusFilter);
	});

	// Status counts
	let statusCounts = $derived({
		not_started: data.questionnaires.filter((q) => q.status === 'not_started').length,
		in_progress: data.questionnaires.filter((q) => q.status === 'in_progress').length,
		completed: data.questionnaires.filter((q) => q.status === 'completed').length
	});

	async function handleDelete(questionnaireId: string) {
		if (!confirm('Are you sure you want to delete this questionnaire?')) {
			return;
		}

		try {
			await deleteQuestionnaire(questionnaireId);
			await invalidateAll();
			toast.success('Questionnaire deleted');
		} catch (err) {
			toast.error('Failed to delete questionnaire', err instanceof Error ? err.message : '');
		}
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'not_started':
				return { class: 'badge-ghost', icon: AlertCircle, label: 'Not Started' };
			case 'in_progress':
				return { class: 'badge-warning', icon: Clock, label: 'In Progress' };
			case 'completed':
				return { class: 'badge-success', icon: CheckCircle, label: 'Completed' };
			default:
				return { class: 'badge-ghost', icon: AlertCircle, label: status };
		}
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function getPublicUrl(slug: string) {
		return `/q/${slug}`;
	}

	function copyPublicUrl(slug: string) {
		const url = `${window.location.origin}/q/${slug}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
	}

	function getLinkedEntityInfo(q: (typeof data.questionnaires)[0]) {
		if (q.contractId) {
			return { type: 'Contract', icon: FileCheck };
		}
		if (q.proposalId) {
			return { type: 'Proposal', icon: FileText };
		}
		return null;
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
				style="background-color: {feature.colorLight}; color: {feature.color}"
			>
				<feature.icon class="h-6 w-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold">{feature.title}</h1>
				<p class="text-base-content/70 mt-1">{feature.description}</p>
			</div>
		</div>
		<div class="flex gap-2">
			<a href="/{agencySlug}/questionnaires/preview" class="btn btn-outline">
				<Play class="h-4 w-4" />
				Preview Form
			</a>
			<a href="/{agencySlug}/questionnaires/new" class="btn btn-primary">
				<Plus class="h-4 w-4" />
				New Questionnaire
			</a>
		</div>
	</div>

	<!-- Status Filters -->
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="btn btn-sm {!statusFilter ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = null)}
		>
			All ({data.questionnaires.length})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'not_started' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'not_started')}
		>
			Not Started ({statusCounts.not_started})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'in_progress' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'in_progress')}
		>
			In Progress ({statusCounts.in_progress})
		</button>
		<button
			type="button"
			class="btn btn-sm {statusFilter === 'completed' ? 'btn-primary' : 'btn-ghost'}"
			onclick={() => (statusFilter = 'completed')}
		>
			Completed ({statusCounts.completed})
		</button>
	</div>

	{#if data.questionnaires.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
					style="background-color: {feature.colorLight}; color: {feature.color}"
				>
					<feature.icon class="h-8 w-8" />
				</div>
				<h3 class="text-lg font-semibold">No questionnaires yet</h3>
				<p class="text-base-content/60 max-w-sm">
					Create questionnaires to collect website requirements, content preferences, and design details from your clients.
				</p>
				<a href="/{agencySlug}/questionnaires/new" class="btn btn-primary mt-4">
					<Plus class="h-4 w-4" />
					Create Questionnaire
				</a>
			</div>
		</div>
	{:else if filteredQuestionnaires().length === 0}
		<!-- No matches -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-8">
				<p class="text-base-content/60">No questionnaires match the selected filter</p>
				<button type="button" class="btn btn-ghost btn-sm mt-2" onclick={() => (statusFilter = null)}>
					Clear filter
				</button>
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each filteredQuestionnaires() as questionnaire (questionnaire.id)}
				{@const statusInfo = getStatusBadge(questionnaire.status)}
				{@const linkedInfo = getLinkedEntityInfo(questionnaire)}
				{@const cardHref = questionnaire.status === 'completed' ? `/${agencySlug}/questionnaires/${questionnaire.id}` : getPublicUrl(questionnaire.slug)}
				{@const cardTarget = questionnaire.status === 'completed' ? '_self' : '_blank'}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-2">
							<a href={cardHref} target={cardTarget} class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-medium truncate">{questionnaire.clientBusinessName || 'No client'}</span>
									<div class="badge {statusInfo.class} badge-sm gap-1">
										<statusInfo.icon class="h-3 w-3" />
										{statusInfo.label}
									</div>
								</div>
								<p class="text-sm text-base-content/70 mt-1 truncate">
									{questionnaire.clientEmail || 'No email'}
								</p>
							</a>
							<div class="flex items-start gap-2">
								<div class="text-right shrink-0">
									<div class="font-semibold">{questionnaire.completionPercentage}%</div>
									{#if linkedInfo}
										<div class="flex items-center gap-1 text-xs text-base-content/60 justify-end">
											<linkedInfo.icon class="h-3 w-3" />
											{linkedInfo.type}
										</div>
									{/if}
								</div>
								<div class="dropdown dropdown-end">
									<button type="button" tabindex="0" class="btn btn-ghost btn-sm btn-square">
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
										<li>
											<a href={getPublicUrl(questionnaire.slug)} target="_blank">
												<ExternalLink class="h-4 w-4" />
												View Public Form
											</a>
										</li>
										<li>
											<button type="button" onclick={() => copyPublicUrl(questionnaire.slug)}>
												<Copy class="h-4 w-4" />
												Copy Link
											</button>
										</li>
										{#if questionnaire.status === 'completed'}
											<li>
												<a href="/{agencySlug}/questionnaires/{questionnaire.id}">
													<Eye class="h-4 w-4" />
													View Responses
												</a>
											</li>
										{/if}
										{#if questionnaire.status !== 'completed'}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button type="button" class="text-error" onclick={() => handleDelete(questionnaire.id)}>
													<Trash2 class="h-4 w-4" />
													Delete
												</button>
											</li>
										{/if}
									</ul>
								</div>
							</div>
						</div>
						<a href={cardHref} target={cardTarget} class="block">
							<div class="mt-2">
								<progress
									class="progress progress-primary w-full h-2"
									value={questionnaire.completionPercentage}
									max="100"
								></progress>
							</div>
							<div class="flex items-center justify-between mt-2 pt-2 border-t border-base-200 text-sm text-base-content/60">
								<span>Created {formatDate(questionnaire.createdAt)}</span>
								{#if !linkedInfo}
									<span>Standalone</span>
								{/if}
							</div>
						</a>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block overflow-visible">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Client</th>
						<th>Status</th>
						<th>Progress</th>
						<th>Linked To</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredQuestionnaires() as questionnaire (questionnaire.id)}
						{@const statusInfo = getStatusBadge(questionnaire.status)}
						{@const linkedInfo = getLinkedEntityInfo(questionnaire)}
						<tr class="hover">
							<td>
								<div class="flex flex-col">
									<span class="font-medium">{questionnaire.clientBusinessName || 'No client'}</span>
									<span class="text-sm text-base-content/60">
										{questionnaire.clientEmail || '-'}
									</span>
								</div>
							</td>
							<td>
								<div class="badge {statusInfo.class} gap-1">
									<statusInfo.icon class="h-3 w-3" />
									{statusInfo.label}
								</div>
							</td>
							<td>
								<div class="flex items-center gap-2">
									<progress
										class="progress progress-primary w-20"
										value={questionnaire.completionPercentage}
										max="100"
									></progress>
									<span class="text-sm text-base-content/60">
										{questionnaire.completionPercentage}%
									</span>
								</div>
							</td>
							<td>
								{#if linkedInfo}
									<div class="flex items-center gap-1 text-sm text-base-content/60">
										<linkedInfo.icon class="h-3 w-3" />
										{linkedInfo.type}
									</div>
								{:else}
									<span class="text-sm text-base-content/40">Standalone</span>
								{/if}
							</td>
							<td>
								<span class="text-sm">{formatDate(questionnaire.createdAt)}</span>
							</td>
							<td>
								<div class="dropdown dropdown-end">
									<button
										type="button"
										tabindex="0"
										class="btn btn-ghost btn-sm btn-square"
									>
										<MoreVertical class="h-4 w-4" />
									</button>
									<ul
										class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
									>
										<li>
											<a href={getPublicUrl(questionnaire.slug)} target="_blank">
												<ExternalLink class="h-4 w-4" />
												View Public Form
											</a>
										</li>
										<li>
											<button
												type="button"
												onclick={() => copyPublicUrl(questionnaire.slug)}
											>
												<Copy class="h-4 w-4" />
												Copy Link
											</button>
										</li>
										{#if questionnaire.status === 'completed'}
											<li>
												<a href="/{agencySlug}/questionnaires/{questionnaire.id}">
													<Eye class="h-4 w-4" />
													View Responses
												</a>
											</li>
										{/if}
										{#if questionnaire.status !== 'completed'}
											<li class="border-t border-base-300 mt-1 pt-1">
												<button
													type="button"
													class="text-error"
													onclick={() => handleDelete(questionnaire.id)}
												>
													<Trash2 class="h-4 w-4" />
													Delete
												</button>
											</li>
										{/if}
									</ul>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

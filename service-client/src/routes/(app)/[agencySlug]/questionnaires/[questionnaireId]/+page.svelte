<script lang="ts">
	import { ArrowLeft, Copy, ExternalLink, Mail, Building2 } from 'lucide-svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import QuestionnaireView from '$lib/components/questionnaire/QuestionnaireView.svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let questionnaire = $derived(data.questionnaire);

	function getPublicUrl() {
		return `${window.location.origin}/q/${questionnaire.slug}`;
	}

	function copyPublicUrl() {
		navigator.clipboard.writeText(getPublicUrl());
		toast.success('Link copied to clipboard');
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<!-- Header with back button -->
	<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
		<div class="flex items-start gap-4">
			<a href="/{agencySlug}/questionnaires" class="btn btn-ghost btn-sm btn-square mt-1">
				<ArrowLeft class="h-4 w-4" />
			</a>
			<div>
				<h1 class="text-2xl font-bold">Questionnaire Details</h1>
				<p class="text-base-content/70 mt-1">
					View responses and manage questionnaire
				</p>
			</div>
		</div>
		<div class="flex gap-2">
			<button type="button" class="btn btn-ghost btn-sm" onclick={copyPublicUrl}>
				<Copy class="h-4 w-4" />
				Copy Link
			</button>
			<a href="/q/{questionnaire.slug}" target="_blank" class="btn btn-ghost btn-sm">
				<ExternalLink class="h-4 w-4" />
				View Public Form
			</a>
		</div>
	</div>

	<!-- Client Info Card -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h3 class="font-semibold mb-4">Client Information</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-base-200">
						<Building2 class="h-5 w-5 text-base-content/60" />
					</div>
					<div>
						<div class="text-xs text-base-content/60">Business Name</div>
						<div class="font-medium">{questionnaire.clientBusinessName || '-'}</div>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-base-200">
						<Mail class="h-5 w-5 text-base-content/60" />
					</div>
					<div>
						<div class="text-xs text-base-content/60">Email</div>
						<div class="font-medium">{questionnaire.clientEmail || '-'}</div>
					</div>
				</div>
			</div>

			<!-- Timeline -->
			<div class="divider"></div>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
				<div>
					<div class="text-base-content/60">Created</div>
					<div>{formatDate(questionnaire.createdAt)}</div>
				</div>
				<div>
					<div class="text-base-content/60">Started</div>
					<div>{formatDate(questionnaire.startedAt)}</div>
				</div>
				<div>
					<div class="text-base-content/60">Last Activity</div>
					<div>{formatDate(questionnaire.lastActivityAt)}</div>
				</div>
				<div>
					<div class="text-base-content/60">Completed</div>
					<div>{formatDate(questionnaire.completedAt)}</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Questionnaire Responses -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<QuestionnaireView {questionnaire} />
		</div>
	</div>
</div>

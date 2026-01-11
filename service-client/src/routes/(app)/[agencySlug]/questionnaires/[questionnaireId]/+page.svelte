<script lang="ts">
	import { ArrowLeft, Copy, ExternalLink, Mail, Building2, Download, MoreHorizontal } from 'lucide-svelte';
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
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body p-4">
			<!-- Top row: Back + Title -->
			<div class="flex items-start gap-3">
				<a href="/{agencySlug}/questionnaires" class="btn btn-ghost btn-sm btn-square shrink-0">
					<ArrowLeft class="h-4 w-4" />
				</a>
				<div class="min-w-0 flex-1">
					<h1 class="text-xl font-bold">Questionnaire Details</h1>
					<p class="text-base-content/70 text-sm">
						View responses and manage questionnaire
					</p>
				</div>
			</div>

			<!-- Bottom row: Actions -->
			<div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-base-200">
				<a
					href="/api/questionnaires/{questionnaire.id}/pdf"
					download
					class="btn btn-outline btn-sm"
				>
					<Download class="h-4 w-4" />
					PDF
				</a>
				<div class="dropdown dropdown-end ml-auto">
					<button type="button" tabindex="0" class="btn btn-outline btn-sm gap-1">
						<MoreHorizontal class="h-4 w-4" />
						More
					</button>
					<ul class="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
						<li>
							<button type="button" onclick={copyPublicUrl}>
								<Copy class="h-4 w-4" />
								Copy Link
							</button>
						</li>
						<li>
							<a href="/q/{questionnaire.slug}" target="_blank">
								<ExternalLink class="h-4 w-4" />
								View Public Form
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>

	<!-- Client Info Card -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body p-4 sm:p-6">
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
		<div class="card-body p-4 sm:p-6">
			<QuestionnaireView {questionnaire} />
		</div>
	</div>
</div>

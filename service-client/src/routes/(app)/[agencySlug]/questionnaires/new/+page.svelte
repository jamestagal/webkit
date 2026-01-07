<script lang="ts">
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { createQuestionnaire } from '$lib/api/questionnaire.remote';
	import { ArrowLeft, Save, ClipboardList, Copy, ExternalLink } from 'lucide-svelte';
	import type { PageProps } from './$types';

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);

	// Form state
	let clientBusinessName = $state('');
	let clientEmail = $state('');
	let isSubmitting = $state(false);

	// Created questionnaire (shown after creation)
	let createdQuestionnaire = $state<{ id: string; slug: string } | null>(null);

	async function handleSubmit() {
		if (!clientBusinessName.trim()) {
			toast.error('Client business name is required');
			return;
		}

		if (!clientEmail.trim()) {
			toast.error('Client email is required');
			return;
		}

		isSubmitting = true;

		try {
			const questionnaire = await createQuestionnaire({
				clientBusinessName: clientBusinessName.trim(),
				clientEmail: clientEmail.trim()
			});

			createdQuestionnaire = { id: questionnaire.id, slug: questionnaire.slug };
			toast.success('Questionnaire created', 'Share the link with your client');
		} catch (err) {
			toast.error('Failed to create questionnaire', err instanceof Error ? err.message : '');
		} finally {
			isSubmitting = false;
		}
	}

	function getPublicUrl(slug: string) {
		return `${window.location.origin}/q/${slug}`;
	}

	function copyPublicUrl(slug: string) {
		navigator.clipboard.writeText(getPublicUrl(slug));
		toast.success('Link copied to clipboard');
	}

	function goToList() {
		goto(`/${agencySlug}/questionnaires`);
	}
</script>

<div class="space-y-6 max-w-2xl">
	<!-- Header with back button -->
	<div class="flex items-center gap-4">
		<a href="/{agencySlug}/questionnaires" class="btn btn-ghost btn-sm btn-square">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div>
			<h1 class="text-2xl font-bold">New Questionnaire</h1>
			<p class="text-base-content/70 mt-1">
				Create a questionnaire to collect website requirements from a client
			</p>
		</div>
	</div>

	{#if createdQuestionnaire}
		<!-- Success state - show link to share -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="flex items-center gap-3 mb-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
						<ClipboardList class="h-6 w-6" />
					</div>
					<div>
						<h3 class="font-semibold">Questionnaire Created!</h3>
						<p class="text-sm text-base-content/60">Share this link with your client</p>
					</div>
				</div>

				<div class="form-control">
					<label class="label" for="questionnaireLink">
						<span class="label-text font-medium">Questionnaire Link</span>
					</label>
					<div class="flex gap-2">
						<input
							type="text"
							id="questionnaireLink"
							readonly
							value={getPublicUrl(createdQuestionnaire.slug)}
							class="input input-bordered flex-1 font-mono text-sm"
						/>
						<button
							type="button"
							class="btn btn-primary"
							onclick={() => copyPublicUrl(createdQuestionnaire!.slug)}
						>
							<Copy class="h-4 w-4" />
							Copy
						</button>
						<a
							href="/q/{createdQuestionnaire.slug}"
							target="_blank"
							class="btn btn-ghost"
						>
							<ExternalLink class="h-4 w-4" />
							Preview
						</a>
					</div>
				</div>

				<div class="flex gap-2 mt-6">
					<button
						type="button"
						class="btn btn-ghost"
						onclick={() => {
							createdQuestionnaire = null;
							clientBusinessName = '';
							clientEmail = '';
						}}
					>
						Create Another
					</button>
					<button type="button" class="btn btn-primary" onclick={goToList}>
						View All Questionnaires
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Creation form -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
				>
					<div class="space-y-4">
						<div class="form-control">
							<label class="label" for="clientBusinessName">
								<span class="label-text font-medium">Client Business Name *</span>
							</label>
							<input
								type="text"
								id="clientBusinessName"
								bind:value={clientBusinessName}
								class="input input-bordered"
								placeholder="e.g., Murray Plumbing & Gas"
								required
							/>
							<div class="label">
								<span class="label-text-alt text-base-content/60">
									The client's business or company name
								</span>
							</div>
						</div>

						<div class="form-control">
							<label class="label" for="clientEmail">
								<span class="label-text font-medium">Client Email *</span>
							</label>
							<input
								type="email"
								id="clientEmail"
								bind:value={clientEmail}
								class="input input-bordered"
								placeholder="e.g., john@murrayplumbing.com.au"
								required
							/>
							<div class="label">
								<span class="label-text-alt text-base-content/60">
									The primary contact email for this client
								</span>
							</div>
						</div>

						<div class="alert mt-4">
							<ClipboardList class="h-5 w-5" />
							<div>
								<p class="text-sm">
									After creating the questionnaire, you'll get a shareable link that your client can use to fill out their website requirements.
								</p>
							</div>
						</div>
					</div>

					<div class="flex justify-end gap-2 mt-6 pt-4 border-t border-base-200">
						<a href="/{agencySlug}/questionnaires" class="btn btn-ghost">
							Cancel
						</a>
						<button type="submit" class="btn btn-primary" disabled={isSubmitting}>
							{#if isSubmitting}
								<span class="loading loading-spinner loading-sm"></span>
							{:else}
								<Save class="h-4 w-4" />
							{/if}
							Create Questionnaire
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

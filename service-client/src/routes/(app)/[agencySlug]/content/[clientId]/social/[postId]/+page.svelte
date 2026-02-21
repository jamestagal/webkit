<script lang="ts">
	import { page } from "$app/state";
	import { goto, invalidateAll } from "$app/navigation";
	import { ArrowLeft, Save, Trash2, CheckCircle, Edit3, Info, Copy } from "lucide-svelte";
	import { updateCopy, deleteCopy } from "$lib/api/content-copy.remote";
	import { formatDate } from "$lib/utils/formatting";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	// Editable content
	let editContent = $state(data.post.content);

	// Sync state when server data changes
	$effect(() => {
		editContent = data.post.content;
	});

	let hasChanges = $derived(editContent !== data.post.content);

	// Character count for social posts
	let charCount = $derived(editContent.length);

	// Parse generation config (once per data change, not on every access)
	type SocialConfig = {
		platform?: string;
		angle?: string;
		hashtags?: string[];
		post_goal?: string;
		tone_override?: string;
	};
	let config: SocialConfig = $derived.by(() => {
		try {
			return JSON.parse(data.post.generation_config);
		} catch {
			return {};
		}
	});

	// Action states
	let isSaving = $state(false);
	let isTogglingStatus = $state(false);
	let saveError = $state("");

	// Delete modal state
	let showDeleteModal = $state(false);
	let isDeleting = $state(false);

	// Clipboard feedback
	let copied = $state(false);

	function formatPlatform(p: string): string {
		return p.charAt(0).toUpperCase() + p.slice(1);
	}

	function platformBadgeClass(platform: string): string {
		switch (platform) {
			case "twitter":
				return "badge-info";
			case "linkedin":
				return "badge-primary";
			case "facebook":
				return "badge-secondary";
			case "instagram":
				return "badge-accent";
			default:
				return "badge-ghost";
		}
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case "final":
				return "badge-success";
			case "draft":
			default:
				return "badge-ghost";
		}
	}

	async function handleSave() {
		isSaving = true;
		saveError = "";
		try {
			await updateCopy({
				copyId: data.post.id,
				content: editContent !== data.post.content ? editContent : undefined,
			});
			await invalidateAll();
		} catch (err: unknown) {
			saveError = err instanceof Error ? err.message : "Failed to save changes.";
		} finally {
			isSaving = false;
		}
	}

	async function handleToggleStatus() {
		const newStatus = data.post.status === "draft" ? "final" : "draft";
		isTogglingStatus = true;
		saveError = "";
		try {
			await updateCopy({
				copyId: data.post.id,
				status: newStatus,
			});
			await invalidateAll();
		} catch (err: unknown) {
			saveError = err instanceof Error ? err.message : "Failed to update status.";
		} finally {
			isTogglingStatus = false;
		}
	}

	async function handleDelete() {
		isDeleting = true;
		try {
			await deleteCopy(data.post.id);
			await goto(`/${agencySlug}/content/${clientId}/social`);
		} catch {
			// Error handled by remote function
		} finally {
			isDeleting = false;
		}
	}

	async function copyToClipboard() {
		await navigator.clipboard.writeText(editContent);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div class="space-y-6">
	<!-- Back link -->
	<a href="/{agencySlug}/content/{clientId}/social" class="btn btn-ghost btn-sm gap-1">
		<ArrowLeft class="h-4 w-4" />
		Back to Social
	</a>

	{#if saveError}
		<div class="alert alert-error">
			<span>{saveError}</span>
		</div>
	{/if}

	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
		<div class="flex-1 min-w-0 space-y-2">
			<h2 class="text-2xl font-bold">{data.post.title}</h2>
			<div class="flex items-center gap-2 flex-wrap">
				<span class="badge {statusBadgeClass(data.post.status)}">{data.post.status}</span>
				{#if config.platform}
					<span class="badge {platformBadgeClass(config.platform!)}">{formatPlatform(config.platform!)}</span>
				{/if}
				{#if config.angle}
					<span class="badge badge-outline">{config.angle}</span>
				{/if}
				{#if config.post_goal}
					<span class="badge badge-outline badge-sm">{config.post_goal}</span>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2 flex-wrap">
			{#if hasChanges}
				<button
					type="button"
					class="btn btn-primary btn-sm"
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
			{/if}

			<button
				type="button"
				class="btn btn-outline btn-sm"
				onclick={handleToggleStatus}
				disabled={isTogglingStatus}
			>
				{#if isTogglingStatus}
					<span class="loading loading-spinner loading-sm"></span>
				{:else if data.post.status === "draft"}
					<CheckCircle class="h-4 w-4" />
				{:else}
					<Edit3 class="h-4 w-4" />
				{/if}
				{data.post.status === "draft" ? "Mark as Final" : "Revert to Draft"}
			</button>

			<button
				type="button"
				class="btn btn-outline btn-sm"
				onclick={copyToClipboard}
			>
				<Copy class="h-4 w-4" />
				{copied ? "Copied!" : "Copy to Clipboard"}
			</button>

			{#if data.post.status === "draft"}
				<button
					type="button"
					class="btn btn-error btn-outline btn-sm"
					onclick={() => (showDeleteModal = true)}
				>
					<Trash2 class="h-4 w-4" />
					Delete
				</button>
			{/if}
		</div>
	</div>

	<!-- Metadata row -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body py-3">
			<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
				<div class="flex items-center gap-1">
					<span class="text-base-content/60">Characters:</span>
					<span class="font-medium">{charCount.toLocaleString()}</span>
				</div>
				{#if data.post.model_used}
					<div class="flex items-center gap-1">
						<span class="text-base-content/60">Model:</span>
						<span class="font-medium">{data.post.model_used}</span>
					</div>
				{/if}
				<div class="flex items-center gap-1">
					<Info class="h-3 w-3 text-base-content/40" />
					<span class="text-base-content/60">Tokens:</span>
					<span class="font-medium">{data.post.prompt_tokens + data.post.completion_tokens}</span>
					<span class="text-base-content/40">({data.post.prompt_tokens}p + {data.post.completion_tokens}c)</span>
				</div>
				<div class="flex items-center gap-1">
					<span class="text-base-content/60">Created:</span>
					<span class="font-medium">{formatDate(data.post.created_at, "medium")}</span>
				</div>
				{#if data.post.updated_at !== data.post.created_at}
					<div class="flex items-center gap-1">
						<span class="text-base-content/60">Updated:</span>
						<span class="font-medium">{formatDate(data.post.updated_at, "medium")}</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Hashtags -->
	{#if config.hashtags && config.hashtags!.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each config.hashtags! as tag}
				<span class="badge badge-outline">{tag}</span>
			{/each}
		</div>
	{/if}

	<!-- Content editor -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="flex items-center justify-between mb-2">
				<h3 class="font-semibold">Post Content</h3>
				<span class="text-sm text-base-content/50">{charCount.toLocaleString()} characters</span>
			</div>
			<textarea
				class="textarea textarea-bordered w-full font-mono text-sm leading-relaxed"
				style="min-height: 200px;"
				bind:value={editContent}
				placeholder="Post content..."
			></textarea>
		</div>
	</div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Delete Social Post</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{data.post.title}</strong>? This action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => (showDeleteModal = false)}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button class="btn btn-error" onclick={handleDelete} disabled={isDeleting}>
					{#if isDeleting}<span class="loading loading-spinner loading-sm"></span>{/if}
					Delete
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (showDeleteModal = false)}>close</button>
		</form>
	</dialog>
{/if}

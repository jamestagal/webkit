<script lang="ts">
	import { page } from "$app/state";
	import { goto, invalidateAll } from "$app/navigation";
	import { ArrowLeft, Save, Trash2, RefreshCw, CheckCircle, Edit3, Info } from "lucide-svelte";
	import { updateCopy, deleteCopy } from "$lib/api/content-copy.remote";
	import { formatDate } from "$lib/utils/formatting";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	// Editable fields
	let editTitle = $state(data.copy.title);
	let editContent = $state(data.copy.content);

	// Sync state when server data changes
	$effect(() => {
		editTitle = data.copy.title;
		editContent = data.copy.content;
	});

	let hasChanges = $derived(editTitle !== data.copy.title || editContent !== data.copy.content);

	// Word count for edited content
	let wordCount = $derived(
		editContent
			.trim()
			.split(/\s+/)
			.filter((w) => w.length > 0).length,
	);

	// Action states
	let isSaving = $state(false);
	let isTogglingStatus = $state(false);
	let saveError = $state("");

	// Delete modal state
	let showDeleteModal = $state(false);
	let isDeleting = $state(false);

	function formatCopyType(type: string): string {
		return type
			.split("_")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
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
				copyId: data.copy.id,
				content: editContent !== data.copy.content ? editContent : undefined,
				title: editTitle !== data.copy.title ? editTitle : undefined,
			});
			await invalidateAll();
		} catch (err: unknown) {
			saveError = err instanceof Error ? err.message : "Failed to save changes.";
		} finally {
			isSaving = false;
		}
	}

	async function handleToggleStatus() {
		const newStatus = data.copy.status === "draft" ? "final" : "draft";
		isTogglingStatus = true;
		saveError = "";
		try {
			await updateCopy({
				copyId: data.copy.id,
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
			await deleteCopy(data.copy.id);
			await goto(`/${agencySlug}/content/${clientId}/copy`);
		} catch {
			// Error handled by remote function
		} finally {
			isDeleting = false;
		}
	}

	function handleRegenerate() {
		const params = new URLSearchParams();
		params.set("copy_type", data.copy.copy_type);
		if (data.copy.target_keyword) params.set("keyword", data.copy.target_keyword);
		if (data.copy.target_word_count) params.set("word_count", String(data.copy.target_word_count));
		if (data.copy.page_id) params.set("page_id", data.copy.page_id);
		goto(`/${agencySlug}/content/${clientId}/copy/generate?${params.toString()}`);
	}
</script>

<div class="space-y-6">
	<!-- Back link -->
	<a href="/{agencySlug}/content/{clientId}/copy" class="btn btn-ghost btn-sm gap-1">
		<ArrowLeft class="h-4 w-4" />
		Back to Copy
	</a>

	{#if saveError}
		<div class="alert alert-error">
			<span>{saveError}</span>
		</div>
	{/if}

	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
		<div class="flex-1 min-w-0 space-y-2">
			<!-- Editable title -->
			<input
				type="text"
				class="input input-bordered input-lg w-full font-bold text-2xl"
				bind:value={editTitle}
				placeholder="Copy title..."
			/>
			<div class="flex items-center gap-2 flex-wrap">
				<span class="badge {statusBadgeClass(data.copy.status)}">{data.copy.status}</span>
				<span class="badge badge-outline">{formatCopyType(data.copy.copy_type)}</span>
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
				{:else if data.copy.status === "draft"}
					<CheckCircle class="h-4 w-4" />
				{:else}
					<Edit3 class="h-4 w-4" />
				{/if}
				{data.copy.status === "draft" ? "Mark as Final" : "Revert to Draft"}
			</button>

			<button
				type="button"
				class="btn btn-outline btn-sm"
				onclick={handleRegenerate}
			>
				<RefreshCw class="h-4 w-4" />
				Regenerate
			</button>

			{#if data.copy.status === "draft"}
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
				{#if data.copy.target_keyword}
					<div class="flex items-center gap-1">
						<span class="text-base-content/60">Keyword:</span>
						<span class="font-medium">{data.copy.target_keyword}</span>
					</div>
				{/if}
				<div class="flex items-center gap-1">
					<span class="text-base-content/60">Words:</span>
					<span class="font-medium">{wordCount.toLocaleString()}</span>
					{#if data.copy.target_word_count}
						<span class="text-base-content/40">/ {data.copy.target_word_count.toLocaleString()} target</span>
					{/if}
				</div>
				{#if data.copy.model_used}
					<div class="flex items-center gap-1">
						<span class="text-base-content/60">Model:</span>
						<span class="font-medium">{data.copy.model_used}</span>
					</div>
				{/if}
				<div class="flex items-center gap-1">
					<Info class="h-3 w-3 text-base-content/40" />
					<span class="text-base-content/60">Tokens:</span>
					<span class="font-medium">{data.copy.prompt_tokens + data.copy.completion_tokens}</span>
					<span class="text-base-content/40">({data.copy.prompt_tokens}p + {data.copy.completion_tokens}c)</span>
				</div>
				<div class="flex items-center gap-1">
					<span class="text-base-content/60">Created:</span>
					<span class="font-medium">{formatDate(data.copy.created_at, "medium")}</span>
				</div>
				{#if data.copy.updated_at !== data.copy.created_at}
					<div class="flex items-center gap-1">
						<span class="text-base-content/60">Updated:</span>
						<span class="font-medium">{formatDate(data.copy.updated_at, "medium")}</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content editor -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<div class="flex items-center justify-between mb-2">
				<h3 class="font-semibold">Content</h3>
				<span class="text-sm text-base-content/50">{wordCount.toLocaleString()} words</span>
			</div>
			<textarea
				class="textarea textarea-bordered w-full font-mono text-sm leading-relaxed"
				style="min-height: 400px;"
				bind:value={editContent}
				placeholder="Copy content..."
			></textarea>
		</div>
	</div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Delete Copy</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{data.copy.title}</strong>? This action cannot be undone.
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

<script lang="ts">
	import { page } from "$app/state";
	import { goto, invalidateAll } from "$app/navigation";
	import { Plus, FileText, Trash2, Download } from "lucide-svelte";
	import { COPY_TYPES } from "$lib/api/content-copy.types";
	import { deleteCopy } from "$lib/api/content-copy.remote";
	import { formatDate } from "$lib/utils/formatting";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	// Filter state
	let statusFilter = $derived(page.url.searchParams.get("status") || "");
	let typeFilter = $derived(page.url.searchParams.get("copy_type") || "");

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingItem: (typeof data.copies)[number] | null = $state(null);
	let isDeleting = $state(false);

	// Export modal state
	let showExportModal = $state(false);
	let exportFormat = $state<"markdown" | "txt" | "pdf">("markdown");
	let exportScope = $state<"final_only" | "all" | "selected">("final_only");
	let selectedCopyIds = $state<Set<string>>(new Set());
	let isExporting = $state(false);
	let exportError = $state("");

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

	function updateFilter(key: string, value: string | null) {
		const params = new URLSearchParams(page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function openDeleteModal(copy: (typeof data.copies)[number]) {
		deletingItem = copy;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!deletingItem) return;
		isDeleting = true;
		try {
			await deleteCopy(deletingItem.id);
			showDeleteModal = false;
			deletingItem = null;
			await invalidateAll();
		} catch {
			// Error handled by remote function
		} finally {
			isDeleting = false;
		}
	}

	// Export functions
	function openExportModal() {
		exportFormat = "markdown";
		exportScope = "final_only";
		selectedCopyIds = new Set();
		exportError = "";
		showExportModal = true;
	}

	function closeExportModal() {
		showExportModal = false;
		exportError = "";
	}

	function toggleCopySelection(copyId: string) {
		const next = new Set(selectedCopyIds);
		if (next.has(copyId)) {
			next.delete(copyId);
		} else {
			next.add(copyId);
		}
		selectedCopyIds = next;
	}

	function formatExtension(format: string): string {
		switch (format) {
			case "pdf":
				return ".pdf";
			case "markdown":
			case "txt":
				return ".zip";
			default:
				return "";
		}
	}

	let canExport = $derived(
		exportScope !== "selected" || selectedCopyIds.size > 0,
	);

	async function handleExport() {
		if (!canExport) return;
		isExporting = true;
		exportError = "";

		try {
			const res = await fetch(`/api/content/copy/export/${clientId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					format: exportFormat,
					scope: exportScope,
					selectedCopyIds: exportScope === "selected" ? [...selectedCopyIds] : undefined,
				}),
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => ({ error: "Export failed" }));
				exportError = errBody.error || "Export failed";
				return;
			}

			const blob = await res.blob();
			const disposition = res.headers.get("Content-Disposition") || "";
			const filenameMatch = disposition.match(/filename="?([^";\s]+)"?/);
			const filename = filenameMatch?.[1] || `copy-export${formatExtension(exportFormat)}`;

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			closeExportModal();
		} catch {
			exportError = "An unexpected error occurred during export.";
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex items-center gap-2">
			<h2 class="text-xl font-semibold">Copy</h2>
			<span class="badge badge-neutral badge-sm">{data.copies.length}</span>
		</div>
		<div class="flex items-center gap-2">
			{#if data.copies.length > 0}
				<button type="button" class="btn btn-outline btn-sm" onclick={openExportModal}>
					<Download class="h-4 w-4" />
					Export
				</button>
			{/if}
			<a
				href="/{agencySlug}/content/{clientId}/copy/generate"
				class="btn btn-primary btn-sm"
			>
				<Plus class="h-4 w-4" />
				Generate New
			</a>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-2">
		<!-- Status tabs -->
		<div role="tablist" class="tabs tabs-boxed tabs-sm">
			<button
				role="tab"
				class="tab"
				class:tab-active={!statusFilter}
				onclick={() => updateFilter("status", null)}
			>
				All
			</button>
			<button
				role="tab"
				class="tab"
				class:tab-active={statusFilter === "draft"}
				onclick={() => updateFilter("status", "draft")}
			>
				Drafts
			</button>
			<button
				role="tab"
				class="tab"
				class:tab-active={statusFilter === "final"}
				onclick={() => updateFilter("status", "final")}
			>
				Final
			</button>
		</div>

		<!-- Copy type dropdown -->
		<select
			class="select select-bordered select-sm w-full sm:w-56"
			value={typeFilter}
			onchange={(e) => {
				const target = e.target as HTMLSelectElement;
				updateFilter("copy_type", target.value || null);
			}}
		>
			<option value="">All Types</option>
			{#each COPY_TYPES as ct}
				<option value={ct}>{formatCopyType(ct)}</option>
			{/each}
		</select>
	</div>

	{#if data.copies.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
					<FileText class="h-8 w-8 text-base-content/30" />
				</div>
				{#if statusFilter || typeFilter}
					<h3 class="text-lg font-semibold">No copy found</h3>
					<p class="text-base-content/60 max-w-sm">
						No copy matches your current filters. Try adjusting your status or type filter.
					</p>
					<button
						type="button"
						class="btn btn-outline mt-4"
						onclick={() => goto("?", { replaceState: true })}
					>
						Clear Filters
					</button>
				{:else}
					<h3 class="text-lg font-semibold">No Copy Generated</h3>
					<p class="text-base-content/60 max-w-sm">
						Generate your first piece of AI-powered copy for this client.
					</p>
					<a
						href="/{agencySlug}/content/{clientId}/copy/generate"
						class="btn btn-primary mt-4"
					>
						<Plus class="h-4 w-4" />
						Generate your first piece
					</a>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each data.copies as copy (copy.id)}
				<div class="card bg-base-100 border border-base-300 hover:border-base-content/20 transition-colors">
					<div class="flex items-start">
						{#if exportScope === "selected" && showExportModal}
							<div class="flex items-center pl-4 pt-4">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={selectedCopyIds.has(copy.id)}
									onchange={() => toggleCopySelection(copy.id)}
								/>
							</div>
						{/if}
						<a
							href="/{agencySlug}/content/{clientId}/copy/{copy.id}"
							class="card-body p-4 flex-1"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate">{copy.title}</div>
									<div class="flex items-center gap-2 mt-1">
										<span class="badge badge-sm badge-outline">{formatCopyType(copy.copy_type)}</span>
										<span class="badge badge-sm {statusBadgeClass(copy.status)}">{copy.status}</span>
									</div>
								</div>
							</div>
							<div class="flex items-center gap-4 mt-2 pt-2 border-t border-base-200 text-xs text-base-content/50">
								<span>{copy.actual_word_count.toLocaleString()} words</span>
								{#if copy.target_keyword}
									<span class="truncate">{copy.target_keyword}</span>
								{/if}
								<span>{formatDate(copy.created_at, "short")}</span>
							</div>
						</a>
					</div>
					{#if copy.status === "draft"}
						<div class="px-4 pb-3">
							<button
								type="button"
								class="btn btn-ghost btn-xs text-error"
								onclick={() => openDeleteModal(copy)}
							>
								<Trash2 class="h-3 w-3" />
								Delete
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block card bg-base-100 border border-base-300 overflow-x-auto">
			<table class="table">
				<thead>
					<tr class="bg-base-200">
						{#if exportScope === "selected" && showExportModal}
							<th class="w-10"></th>
						{/if}
						<th>Title</th>
						<th>Type</th>
						<th>Target Keyword</th>
						<th class="text-right">Words</th>
						<th>Status</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.copies as copy (copy.id)}
						<tr
							class="hover:bg-base-50 cursor-pointer group"
							onclick={() => goto(`/${agencySlug}/content/${clientId}/copy/${copy.id}`)}
						>
							{#if exportScope === "selected" && showExportModal}
								<td>
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={selectedCopyIds.has(copy.id)}
										onchange={() => toggleCopySelection(copy.id)}
										onclick={(e) => e.stopPropagation()}
									/>
								</td>
							{/if}
							<td>
								<span class="text-sm font-medium truncate block max-w-xs">{copy.title}</span>
							</td>
							<td>
								<span class="badge badge-sm badge-outline">{formatCopyType(copy.copy_type)}</span>
							</td>
							<td>
								<span class="text-sm text-base-content/70 truncate block max-w-[150px]">
									{copy.target_keyword || "\u2014"}
								</span>
							</td>
							<td class="text-right">
								<span class="text-sm">{copy.actual_word_count.toLocaleString()}</span>
							</td>
							<td>
								<span class="badge badge-sm {statusBadgeClass(copy.status)}">{copy.status}</span>
							</td>
							<td>
								<span class="text-sm text-base-content/70">{formatDate(copy.created_at, "short")}</span>
							</td>
							<td>
								{#if copy.status === "draft"}
									<button
										type="button"
										class="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
										onclick={(e) => {
											e.stopPropagation();
											openDeleteModal(copy);
										}}
									>
										<Trash2 class="h-3 w-3" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deletingItem}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Delete Copy</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{deletingItem.title}</strong>? This action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => {
						showDeleteModal = false;
						deletingItem = null;
					}}
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
			<button
				type="button"
				onclick={() => {
					showDeleteModal = false;
					deletingItem = null;
				}}>close</button
			>
		</form>
	</dialog>
{/if}

<!-- Export Modal -->
{#if showExportModal}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Export Copy</h3>

			<div class="py-4 space-y-5">
				<!-- Format selection -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Format</span>
					</label>
					<div class="flex flex-col gap-2">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="radio"
								name="export-format"
								class="radio radio-sm radio-primary"
								value="markdown"
								checked={exportFormat === "markdown"}
								onchange={() => (exportFormat = "markdown")}
							/>
							<span class="text-sm">Markdown (.zip)</span>
						</label>
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="radio"
								name="export-format"
								class="radio radio-sm radio-primary"
								value="txt"
								checked={exportFormat === "txt"}
								onchange={() => (exportFormat = "txt")}
							/>
							<span class="text-sm">Plain Text (.zip)</span>
						</label>
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="radio"
								name="export-format"
								class="radio radio-sm radio-primary"
								value="pdf"
								checked={exportFormat === "pdf"}
								onchange={() => (exportFormat = "pdf")}
							/>
							<span class="text-sm">PDF</span>
						</label>
					</div>
				</div>

				<!-- Scope selection -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Scope</span>
					</label>
					<div class="flex flex-col gap-2">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="radio"
								name="export-scope"
								class="radio radio-sm radio-primary"
								value="final_only"
								checked={exportScope === "final_only"}
								onchange={() => (exportScope = "final_only")}
							/>
							<span class="text-sm">Final Only</span>
						</label>
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="radio"
								name="export-scope"
								class="radio radio-sm radio-primary"
								value="all"
								checked={exportScope === "all"}
								onchange={() => (exportScope = "all")}
							/>
							<span class="text-sm">All</span>
						</label>
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="radio"
								name="export-scope"
								class="radio radio-sm radio-primary"
								value="selected"
								checked={exportScope === "selected"}
								onchange={() => (exportScope = "selected")}
							/>
							<span class="text-sm">Selected</span>
						</label>
					</div>
				</div>

				{#if exportScope === "selected"}
					<div class="bg-base-200 rounded-lg p-3">
						<p class="text-xs text-base-content/60 mb-2">
							{selectedCopyIds.size} of {data.copies.length} selected.
							Use the checkboxes in the list behind this modal to select copy items.
						</p>
						<div class="max-h-40 overflow-y-auto space-y-1">
							{#each data.copies as copy (copy.id)}
								<label class="flex items-center gap-2 cursor-pointer py-1">
									<input
										type="checkbox"
										class="checkbox checkbox-xs"
										checked={selectedCopyIds.has(copy.id)}
										onchange={() => toggleCopySelection(copy.id)}
									/>
									<span class="text-xs truncate">{copy.title}</span>
									<span class="badge badge-xs {statusBadgeClass(copy.status)}">{copy.status}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}

				{#if exportError}
					<div class="alert alert-error text-sm">
						<span>{exportError}</span>
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={closeExportModal}
					disabled={isExporting}
				>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					onclick={handleExport}
					disabled={isExporting || !canExport}
				>
					{#if isExporting}<span class="loading loading-spinner loading-sm"></span>{/if}
					Export
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={closeExportModal}>close</button>
		</form>
	</dialog>
{/if}

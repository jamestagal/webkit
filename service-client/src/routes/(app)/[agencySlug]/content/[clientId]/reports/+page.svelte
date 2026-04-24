<script lang="ts">
	import type { PageProps } from "./$types";
	import { page } from "$app/state";
	import {
		getClientReports,
		revokeShareLink,
		reinstateShareLink,
		updateShareExpiry,
	} from "$lib/api/content-audit.remote";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { formatDate, formatRelativeTime } from "$lib/utils/formatting";
	import { Copy, Clock, Trash2, RotateCcw, FileText } from "lucide-svelte";

	let { data }: PageProps = $props();
	let reports = $derived(data.reports);
	let agencySlug = $derived(page.params.agencySlug!);
	let clientId = $derived(page.params.clientId!);

	const toast = getToast();

	type Report = (typeof reports)[number];

	let loading = $state(false);
	let selected = $state<Report | null>(null);
	let revokeOpen = $state(false);
	let expiryOpen = $state(false);
	let newExpiryDays = $state<number | undefined>(undefined);

	// Local — formatRelativeTime in $lib/utils/formatting handles past only.
	// Promote to shared if a second caller appears.
	function formatExpiresIn(iso: string | null): string {
		if (!iso) return "No expiry";
		const d = new Date(iso);
		const diffMs = d.getTime() - Date.now();
		if (diffMs < 0) return formatRelativeTime(iso);
		const diffDays = Math.ceil(diffMs / 86_400_000);
		if (diffDays < 1) return "in <1d";
		if (diffDays === 1) return "tomorrow";
		return `in ${diffDays} days`;
	}

	function statusBadgeClass(status: "active" | "revoked" | "expired"): string {
		return {
			active: "badge badge-success",
			expired: "badge badge-warning",
			revoked: "badge badge-neutral",
		}[status];
	}

	function statusLabel(status: "active" | "revoked" | "expired"): string {
		return { active: "Active", expired: "Expired", revoked: "Revoked" }[status];
	}

	function truncate(url: string, len = 48): string {
		return url.length > len ? url.slice(0, len - 1) + "…" : url;
	}

	async function handleCopy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Link copied", "Share URL copied to clipboard");
		} catch {
			toast.error("Copy failed", "Could not write to clipboard");
		}
	}

	function openRevoke(r: Report) {
		selected = r;
		revokeOpen = true;
	}

	function closeRevoke() {
		if (loading) return;
		revokeOpen = false;
		selected = null;
	}

	async function confirmRevoke() {
		if (!selected) return;
		loading = true;
		try {
			await revokeShareLink({ auditId: selected.id });
			toast.success("Share link revoked");
			await getClientReports(clientId).refresh();
			revokeOpen = false;
			selected = null;
		} catch (err) {
			toast.error("Failed to revoke", err instanceof Error ? err.message : "");
		} finally {
			loading = false;
		}
	}

	async function handleReinstate(r: Report) {
		loading = true;
		try {
			await reinstateShareLink({ auditId: r.id });
			toast.success("Share link re-enabled");
			await getClientReports(clientId).refresh();
		} catch (err) {
			toast.error("Failed to re-enable", err instanceof Error ? err.message : "");
		} finally {
			loading = false;
		}
	}

	function openExpiry(r: Report) {
		selected = r;
		// Seed with current expiry window if it maps to a preset; else undefined = "No expiry".
		newExpiryDays = undefined;
		expiryOpen = true;
	}

	function closeExpiry() {
		if (loading) return;
		expiryOpen = false;
		selected = null;
	}

	async function confirmExpiryChange() {
		if (!selected) return;
		loading = true;
		try {
			await updateShareExpiry({
				auditId: selected.id,
				expiresInDays: newExpiryDays,
			});
			toast.success("Expiry updated");
			await getClientReports(clientId).refresh();
			expiryOpen = false;
			selected = null;
		} catch (err) {
			toast.error("Failed to update expiry", err instanceof Error ? err.message : "");
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Shared Reports</title>
</svelte:head>

<section class="space-y-4">
	<header>
		<h2 class="text-lg font-semibold">Shared Reports</h2>
		<p class="text-sm text-base-content/60">
			Every SEO audit that has been shared — active, revoked, or expired.
		</p>
	</header>

	{#if reports.length === 0}
		<!-- Empty state -->
		<div class="rounded-2xl border border-base-200 bg-base-100 p-12 text-center">
			<FileText class="mx-auto mb-4 h-10 w-10 text-base-content/30" />
			<h3 class="text-base font-semibold">No shared reports yet</h3>
			<p class="mx-auto mt-2 max-w-md text-sm text-base-content/60">
				Run an SEO audit and click <strong>Share Report</strong> to create a public link your client
				can view without logging in.
			</p>
			<a
				href="/{agencySlug}/content/{clientId}/audit"
				class="btn btn-primary btn-sm mt-6"
			>
				Go to audit page
			</a>
		</div>
	{:else}
		<!-- Desktop table -->
		<div class="hidden overflow-hidden rounded-2xl border border-base-200 bg-base-100 lg:block">
			<table class="table table-sm">
				<thead>
					<tr class="text-xs uppercase text-base-content/50">
						<th>Audit</th>
						<th>Status</th>
						<th>Share URL</th>
						<th>Views</th>
						<th>Expires</th>
						<th class="text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each reports as r (r.id)}
						<tr>
							<td class="whitespace-nowrap">{formatDate(r.createdAt, "medium")}</td>
							<td>
								<span class={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
							</td>
							<td class="max-w-xs">
								<span
									class="font-mono text-xs text-base-content/70 {r.status === 'revoked'
										? 'line-through'
										: ''}"
									title={r.shareUrl}
								>
									{truncate(r.shareUrl)}
								</span>
							</td>
							<td class="whitespace-nowrap">
								<div class="text-sm">{r.shareViewCount}</div>
								{#if r.shareLastViewedAt}
									<div class="text-xs text-base-content/50">
										{formatRelativeTime(r.shareLastViewedAt)}
									</div>
								{/if}
							</td>
							<td class="whitespace-nowrap">
								{#if r.shareExpiresAt}
									<div class="text-sm">{formatDate(r.shareExpiresAt, "medium")}</div>
									<div class="text-xs text-base-content/50">
										{formatExpiresIn(r.shareExpiresAt)}
									</div>
								{:else}
									<div class="text-sm text-base-content/50">No expiry</div>
								{/if}
							</td>
							<td>
								<div class="flex justify-end gap-1">
									{#if r.status === "active"}
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											title="Copy link"
											onclick={() => handleCopy(r.shareUrl)}
										>
											<Copy class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											title="Change expiry"
											onclick={() => openExpiry(r)}
										>
											<Clock class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-xs text-error"
											title="Revoke"
											onclick={() => openRevoke(r)}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									{:else if r.status === "expired"}
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											title="Renew expiry"
											onclick={() => openExpiry(r)}
										>
											<Clock class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-xs text-error"
											title="Revoke"
											onclick={() => openRevoke(r)}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									{:else}
										<!-- revoked -->
										<button
											type="button"
											class="btn btn-ghost btn-xs"
											title="Re-enable"
											disabled={loading}
											onclick={() => handleReinstate(r)}
										>
											<RotateCcw class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile card stack -->
		<div class="space-y-3 lg:hidden">
			{#each reports as r (r.id)}
				<div class="rounded-xl border border-base-200 bg-base-100 p-4">
					<div class="mb-2 flex items-start justify-between gap-2">
						<div>
							<div class="text-sm font-semibold">{formatDate(r.createdAt, "medium")}</div>
							<div class="mt-1">
								<span class={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
							</div>
						</div>
						<div class="text-right text-xs text-base-content/60">
							<div>{r.shareViewCount} {r.shareViewCount === 1 ? "view" : "views"}</div>
							{#if r.shareLastViewedAt}
								<div>{formatRelativeTime(r.shareLastViewedAt)}</div>
							{/if}
						</div>
					</div>

					<div
						class="mb-3 font-mono text-xs text-base-content/70 {r.status === 'revoked'
							? 'line-through'
							: ''}"
						title={r.shareUrl}
					>
						{truncate(r.shareUrl, 64)}
					</div>

					<div class="mb-3 text-xs">
						<span class="text-base-content/50">Expires:</span>
						{#if r.shareExpiresAt}
							{formatDate(r.shareExpiresAt, "medium")} ({formatExpiresIn(r.shareExpiresAt)})
						{:else}
							<span class="text-base-content/50">No expiry</span>
						{/if}
					</div>

					<div class="flex flex-wrap gap-2">
						{#if r.status === "active"}
							<button class="btn btn-ghost btn-xs" onclick={() => handleCopy(r.shareUrl)}>
								<Copy class="h-3.5 w-3.5" /> Copy
							</button>
							<button class="btn btn-ghost btn-xs" onclick={() => openExpiry(r)}>
								<Clock class="h-3.5 w-3.5" /> Expiry
							</button>
							<button class="btn btn-ghost btn-xs text-error" onclick={() => openRevoke(r)}>
								<Trash2 class="h-3.5 w-3.5" /> Revoke
							</button>
						{:else if r.status === "expired"}
							<button class="btn btn-ghost btn-xs" onclick={() => openExpiry(r)}>
								<Clock class="h-3.5 w-3.5" /> Renew
							</button>
							<button class="btn btn-ghost btn-xs text-error" onclick={() => openRevoke(r)}>
								<Trash2 class="h-3.5 w-3.5" /> Revoke
							</button>
						{:else}
							<button
								class="btn btn-ghost btn-xs"
								disabled={loading}
								onclick={() => handleReinstate(r)}
							>
								<RotateCcw class="h-3.5 w-3.5" /> Re-enable
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<!-- Revoke confirm modal -->
{#if revokeOpen && selected}
	<div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="revoke-title">
		<div class="modal-box max-w-md">
			<h3 id="revoke-title" class="text-lg font-semibold">Revoke share link?</h3>
			<p class="mt-3 text-sm text-base-content/70">
				Clients with this link will no longer be able to view the report from
				<strong>{formatDate(selected.createdAt, "medium")}</strong>.
				You can re-enable it later from this page.
			</p>

			<div class="modal-action mt-6">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={closeRevoke}
					disabled={loading}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-error btn-sm"
					onclick={confirmRevoke}
					disabled={loading}
				>
					{#if loading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Revoke
				</button>
			</div>
		</div>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" onclick={closeRevoke}></div>
	</div>
{/if}

<!-- Change expiry modal -->
{#if expiryOpen && selected}
	<div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="expiry-title">
		<div class="modal-box max-w-md">
			<h3 id="expiry-title" class="text-lg font-semibold">Change expiry</h3>
			<p class="mt-3 text-sm text-base-content/70">
				Update when the share link for the audit from
				<strong>{formatDate(selected.createdAt, "medium")}</strong>
				stops working. The URL itself is unchanged.
			</p>

			<div class="mt-4">
				<label for="new-expiry-select" class="label pb-1">
					<span class="label-text text-sm">New expiry</span>
				</label>
				<select
					id="new-expiry-select"
					class="select select-bordered select-sm w-full"
					bind:value={newExpiryDays}
				>
					<option value={undefined}>No expiry</option>
					<option value={7}>7 days</option>
					<option value={30}>30 days</option>
					<option value={90}>90 days</option>
				</select>
			</div>

			<div class="modal-action mt-6">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={closeExpiry}
					disabled={loading}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={confirmExpiryChange}
					disabled={loading}
				>
					{#if loading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Save
				</button>
			</div>
		</div>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" onclick={closeExpiry}></div>
	</div>
{/if}

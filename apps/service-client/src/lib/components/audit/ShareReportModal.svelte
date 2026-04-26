<script lang="ts">
	import { createShareLink, revokeShareLink, reinstateShareLink } from '$lib/api/content-audit.remote';
	import { formatRelativeTime, formatDate } from '$lib/utils/formatting';

	type ShareStatus =
		| { isShared: false }
		| {
				isShared: true;
				isRevoked: boolean;
				isExpired: boolean;
				shareUrl: string;
				token: string;
				createdAt: string | null;
				expiresAt: string | null;
				viewCount: number;
				firstViewedAt: string | null;
				lastViewedAt: string | null;
		  };

	interface Props {
		auditId: string;
		status: ShareStatus;
		onUpdated?: () => void | Promise<void>;
		open?: boolean;
	}

	let { auditId, status, onUpdated, open = $bindable(false) }: Props = $props();
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let copiedFeedback = $state(false);
	let expiresInDays = $state<number | undefined>(undefined);

	// Optimistic override — wins until parent's invalidateAll() refreshes `status`.
	// Avoids the forbidden prop→state $effect sync pattern: override is cleared
	// imperatively after mutations when we know the parent will reload.
	let override = $state<ShareStatus | null>(null);
	let current = $derived(override ?? status);

	function close() {
		open = false;
		errorMsg = null;
	}

	async function handleCreate() {
		loading = true;
		errorMsg = null;
		try {
			const result = await createShareLink({ auditId, expiresInDays });
			override = {
				isShared: true,
				isRevoked: false,
				isExpired: false,
				shareUrl: result.shareUrl,
				token: result.token,
				createdAt: new Date().toISOString(),
				expiresAt: result.expiresAt,
				viewCount: 0,
				firstViewedAt: null,
				lastViewedAt: null,
			};
			await onUpdated?.();
			override = null;
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to create share link.';
		} finally {
			loading = false;
		}
	}

	async function handleRevoke() {
		loading = true;
		errorMsg = null;
		try {
			await revokeShareLink({ auditId });
			if (current.isShared) {
				override = { ...current, isRevoked: true };
			}
			await onUpdated?.();
			override = null;
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to revoke share link.';
		} finally {
			loading = false;
		}
	}

	async function handleReinstate() {
		loading = true;
		errorMsg = null;
		try {
			const result = await reinstateShareLink({ auditId });
			if (current.isShared) {
				override = { ...current, isRevoked: false, shareUrl: result.shareUrl };
			}
			await onUpdated?.();
			override = null;
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Failed to re-enable share link.';
		} finally {
			loading = false;
		}
	}

	async function handleCopy() {
		if (!current.isShared) return;
		try {
			await navigator.clipboard.writeText(current.shareUrl);
			copiedFeedback = true;
			setTimeout(() => (copiedFeedback = false), 2000);
		} catch {
			errorMsg = 'Could not copy to clipboard.';
		}
	}
</script>

<button
	type="button"
	class="btn btn-outline btn-sm"
	onclick={() => (open = true)}
>
	Share Report
</button>

{#if open}
	<div class="modal modal-open" role="dialog" aria-modal="true">
		<div class="modal-box max-w-md">
			<button
				type="button"
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				onclick={close}
				aria-label="Close"
			>
				&#x2715;
			</button>

			<h3 class="mb-4 text-lg font-semibold">Share Report</h3>

			{#if errorMsg}
				<div class="alert alert-error mb-4 py-2 text-sm">
					<span>{errorMsg}</span>
				</div>
			{/if}

			{#if !current.isShared}
				<!-- No token yet — create -->
				<p class="mb-4 text-sm text-base-content/70">
					Generate a shareable link so your client can view this report without logging in.
				</p>

				<div class="mb-4">
					<label for="expiry-select" class="label pb-1">
						<span class="label-text text-sm">Link expiry</span>
					</label>
					<select
						id="expiry-select"
						class="select select-bordered select-sm w-full"
						bind:value={expiresInDays}
					>
						<option value={undefined}>No expiry</option>
						<option value={7}>7 days</option>
						<option value={30}>30 days</option>
						<option value={90}>90 days</option>
					</select>
				</div>

				<div class="modal-action mt-2">
					<button type="button" class="btn btn-ghost btn-sm" onclick={close} disabled={loading}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={handleCreate}
						disabled={loading}
					>
						{#if loading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Create link
					</button>
				</div>

			{:else if current.isRevoked}
				<!-- Revoked state -->
				<div class="mb-4 rounded-lg bg-base-200 px-4 py-3 text-sm">
					<p class="font-medium text-warning">This link has been revoked.</p>
					<p class="mt-1 text-base-content/60">Clients cannot access the report with the current link.</p>
					{#if current.isExpired}
						<p class="mt-2 text-xs text-error">
							The link also expired on {formatDate(current.expiresAt, 'medium')}. Re-enabling will restore access
							but the link remains expired — create a new link to extend the expiry.
						</p>
					{/if}
				</div>

				<div class="modal-action mt-2">
					<button type="button" class="btn btn-ghost btn-sm" onclick={close} disabled={loading}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary btn-sm"
						onclick={handleReinstate}
						disabled={loading}
					>
						{#if loading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Re-enable link
					</button>
				</div>

			{:else}
				<!-- Active token -->
				{#if current.isExpired}
					<div class="alert alert-warning mb-4 py-2 text-sm">
						<span>This link expired on {formatDate(current.expiresAt, 'medium')}. Create a new link to extend access.</span>
					</div>
				{:else if current.expiresAt}
					<p class="mb-3 text-xs text-base-content/50">
						Expires {formatDate(current.expiresAt, 'medium')}
					</p>
				{/if}

				<!-- URL copy row -->
				<div class="mb-4 flex items-center gap-2">
					<input
						type="text"
						readonly
						value={current.shareUrl}
						class="input input-bordered input-sm flex-1 truncate text-xs"
					/>
					<button
						type="button"
						class="btn btn-outline btn-sm shrink-0"
						onclick={handleCopy}
					>
						{copiedFeedback ? 'Copied!' : 'Copy'}
					</button>
				</div>

				<!-- View analytics -->
				<div class="mb-4 rounded-lg bg-base-200 px-4 py-3 text-sm">
					<p class="font-medium">
						{current.viewCount}
						{current.viewCount === 1 ? 'view' : 'views'}
					</p>
					{#if current.lastViewedAt}
						<p class="mt-0.5 text-xs text-base-content/60">
							Last viewed {formatRelativeTime(current.lastViewedAt)}
						</p>
					{:else}
						<p class="mt-0.5 text-xs text-base-content/60">Not yet viewed</p>
					{/if}
				</div>

				<div class="modal-action mt-2">
					<button
						type="button"
						class="btn btn-warning btn-sm"
						onclick={handleRevoke}
						disabled={loading}
					>
						{#if loading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Revoke
					</button>
					<button type="button" class="btn btn-ghost btn-sm" onclick={close} disabled={loading}>
						Done
					</button>
				</div>
			{/if}
		</div>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" onclick={close}></div>
	</div>
{/if}

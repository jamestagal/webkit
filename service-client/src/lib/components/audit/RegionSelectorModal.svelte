<script lang="ts">
	import { startAudit } from '$lib/api/content-audit.remote';

	interface Props {
		clientId: string;
		open: boolean;
		onClose: () => void;
		onStarted?: (auditId: string) => void;
	}

	let { clientId, open, onClose, onStarted }: Props = $props();

	const REGIONS = [
		{ value: 'au', label: 'Australia' },
		{ value: 'us', label: 'United States' },
		{ value: 'uk', label: 'United Kingdom' },
		{ value: 'nz', label: 'New Zealand' },
		{ value: 'ca', label: 'Canada' },
	] as const;

	type Region = (typeof REGIONS)[number]['value'];

	let selectedRegion = $state<Region>('au');
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);

	function handleClose() {
		if (loading) return;
		errorMsg = null;
		onClose();
	}

	async function handleSubmit() {
		loading = true;
		errorMsg = null;
		try {
			const result = await startAudit({
				clientId,
				targetRegion: selectedRegion,
				targetLanguage: 'en',
			});
			onStarted?.(result.id);
			onClose();
		} catch (err) {
			if (err && typeof err === 'object' && 'body' in err) {
				const body = (err as { body?: { message?: string } }).body;
				errorMsg = body?.message ?? 'Failed to start audit.';
			} else {
				errorMsg = err instanceof Error ? err.message : 'Failed to start audit.';
			}
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div class="modal modal-open" role="dialog" aria-modal="true">
		<div class="modal-box max-w-sm">
			<button
				type="button"
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				onclick={handleClose}
				disabled={loading}
				aria-label="Close"
			>
				&#x2715;
			</button>

			<h3 class="mb-4 text-lg font-semibold">Start SEO Audit</h3>

			{#if errorMsg}
				<div class="alert alert-error mb-4 py-2 text-sm">
					<span>{errorMsg}</span>
				</div>
			{/if}

			<div class="mb-4">
				<label for="region-select" class="label pb-1">
					<span class="label-text text-sm">Target region</span>
				</label>
				<select
					id="region-select"
					class="select select-bordered w-full"
					bind:value={selectedRegion}
					disabled={loading}
				>
					{#each REGIONS as region (region.value)}
						<option value={region.value}>{region.label}</option>
					{/each}
				</select>
			</div>

			<div class="mb-6">
				<label class="label pb-1">
					<span class="label-text text-sm">Language</span>
				</label>
				<input
					type="text"
					value="English"
					disabled
					class="input input-bordered w-full cursor-not-allowed opacity-60"
				/>
			</div>

			<div class="modal-action mt-0">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={handleClose}
					disabled={loading}
				>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					onclick={handleSubmit}
					disabled={loading}
				>
					{#if loading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Start Audit
				</button>
			</div>
		</div>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" onclick={handleClose}></div>
	</div>
{/if}

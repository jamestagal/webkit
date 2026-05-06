<script lang="ts">
	import { Search, RotateCcw, Building2, Gift, ExternalLink, XCircle, Calendar } from 'lucide-svelte';
	import { getFreemiumAgencies, updateAgencyAccess } from '$lib/api/super-admin.remote';
	import { normalizeExpiry } from '$lib/utils/freemium';
	import { formatDate } from '$lib/utils/formatting';
	import { goto } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';

	const toast = getToast();

	interface FreemiumAgency {
		id: string;
		name: string;
		slug: string;
		email: string;
		status: string;
		isFreemium: boolean;
		freemiumReason: string | null;
		freemiumExpiresAt: Date | null;
		freemiumGrantedAt: Date | null;
		freemiumGrantedBy: string | null;
		createdAt: Date;
		ownerEmail: string | null;
	}

	// Filter state — anchored query refetches automatically when these change.
	let filters = $state({ search: '', reasonFilter: '' });
	let searchInput = $state('');
	let currentPage = $state(1);
	const pageSize = 20;

	// Expiry modal
	let showExpiryModal = $state(false);
	let selectedAgency = $state<FreemiumAgency | null>(null);
	let newExpiryDate = $state('');
	let updatingExpiry = $state(false);

	// Revoke confirmation modal
	let showRevokeModal = $state(false);
	let revokingAgency = $state<{ id: string; name: string } | null>(null);
	type FreemiumReason = 'beta_tester' | 'partner' | 'promotional' | 'early_signup' | 'referral_reward' | 'internal';
	let isRevoking = $state(false);

	let searchDebounce: ReturnType<typeof setTimeout>;

	const reasonLabels: Record<string, string> = {
		beta_tester: 'Beta Tester',
		partner: 'Partner',
		promotional: 'Promotional',
		early_signup: 'Early Signup',
		referral_reward: 'Referral Reward',
		internal: 'Internal'
	};

	// Anchored query: $derived recomputes when filters or pagination change,
	// triggering refetch with the new args. Replaces the prior loadAgencies()
	// imperative path + explicit cache-bust pattern.
	const freemiumQuery = $derived(
		getFreemiumAgencies({
			search: filters.search || undefined,
			reason: filters.reasonFilter || undefined,
			limit: pageSize,
			offset: (currentPage - 1) * pageSize
		})
	);

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			filters.search = searchInput;
			currentPage = 1;
		}, 300);
	}

	function handleFilterChange() {
		currentPage = 1;
	}

	function openRevokeModal(agency: FreemiumAgency) {
		revokingAgency = { id: agency.id, name: agency.name };
		showRevokeModal = true;
	}

	function closeRevokeModal() {
		showRevokeModal = false;
		revokingAgency = null;
	}

	async function handleRevoke() {
		if (!revokingAgency) return;
		isRevoking = true;
		try {
			await updateAgencyAccess({
				agencyId: revokingAgency.id,
				freemium: { enabled: false }
			});
			closeRevokeModal();
			toast.success('Success', 'Freemium status revoked');
			await freemiumQuery.refresh();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to revoke freemium');
		} finally {
			isRevoking = false;
		}
	}

	function openExpiryModal(agency: FreemiumAgency) {
		selectedAgency = agency;
		newExpiryDate = agency.freemiumExpiresAt
			? new Date(agency.freemiumExpiresAt).toISOString().split('T')[0] ?? ''
			: '';
		showExpiryModal = true;
	}

	async function handleUpdateExpiry() {
		if (!selectedAgency) return;

		// Read the reason from the row snapshot captured at click time, not from a
		// page-level value that could have invalidated between load and submit.
		const currentReason = (selectedAgency.freemiumReason as FreemiumReason) ?? 'internal';

		updatingExpiry = true;
		try {
			await updateAgencyAccess({
				agencyId: selectedAgency.id,
				freemium: {
					enabled: true,
					reason: currentReason,
					expiresAt: normalizeExpiry(newExpiryDate)
				}
			});
			toast.success('Success', newExpiryDate ? 'Expiry date updated' : 'Expiry removed (no expiry)');
			showExpiryModal = false;
			selectedAgency = null;
			await freemiumQuery.refresh();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to update expiry');
		} finally {
			updatingExpiry = false;
		}
	}

	function formatDateOrExpiry(date: Date | string | null): string {
		if (!date) return 'No expiry';
		return formatDate(date);
	}

	function getReasonBadgeClass(reason: string | null): string {
		switch (reason) {
			case 'beta_tester':
				return 'badge-primary';
			case 'partner':
				return 'badge-secondary';
			case 'promotional':
				return 'badge-accent';
			case 'early_signup':
				return 'badge-info';
			case 'referral_reward':
				return 'badge-success';
			case 'internal':
				return 'badge-warning';
			default:
				return 'badge-ghost';
		}
	}

	const totalPages = $derived(Math.ceil((freemiumQuery.current?.total ?? 0) / pageSize));
	const totalFreemium = $derived(
		freemiumQuery.current?.stats
			? Object.values(freemiumQuery.current.stats).reduce((a, b) => a + b, 0)
			: 0
	);
</script>

<svelte:head>
	<title>Freemium Users | Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold">Freemium Users</h1>
		<p class="text-base-content/60">Manage agencies with freemium access</p>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
		<div class="rounded-lg bg-base-200 p-4">
			<div class="text-2xl font-bold">{totalFreemium}</div>
			<div class="text-sm text-base-content/60">Total</div>
		</div>
		{#each Object.entries(reasonLabels) as [key, label]}
			<div class="rounded-lg bg-base-200 p-4">
				<div class="text-2xl font-bold">{freemiumQuery.current?.stats?.[key] || 0}</div>
				<div class="text-sm text-base-content/60">{label}</div>
			</div>
		{/each}
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="join">
			<span class="btn btn-sm join-item btn-disabled">
				<Search class="h-4 w-4" />
			</span>
			<input
				type="text"
				placeholder="Search by name or email..."
				class="input input-sm input-bordered join-item w-64"
				bind:value={searchInput}
				oninput={handleSearchInput}
			/>
		</div>

		<select
			class="select select-bordered select-sm"
			bind:value={filters.reasonFilter}
			onchange={handleFilterChange}
		>
			<option value="">All Reasons</option>
			{#each Object.entries(reasonLabels) as [key, label]}
				<option value={key}>{label}</option>
			{/each}
		</select>

		<button class="btn btn-ghost btn-sm" onclick={() => freemiumQuery.refresh()}>
			<RotateCcw class="h-4 w-4" />
			Refresh
		</button>
	</div>

	<!-- Table -->
	{#if !freemiumQuery.ready}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if freemiumQuery.error}
		<div class="alert alert-error">
			<span>{freemiumQuery.error?.message ?? 'Failed to load agencies'}</span>
		</div>
	{:else if freemiumQuery.ready && freemiumQuery.current.agencies.length === 0}
		<div class="rounded-lg bg-base-200 p-12 text-center">
			<Gift class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No freemium agencies</h3>
			<p class="text-base-content/60">Agencies with freemium status will appear here.</p>
		</div>
	{:else if freemiumQuery.ready}
		<div class="overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead>
					<tr>
						<th>Agency</th>
						<th>Owner</th>
						<th>Reason</th>
						<th>Granted</th>
						<th>Expires</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each freemiumQuery.current.agencies as agency}
						<tr class="hover">
							<td>
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
										<Building2 class="h-5 w-5 text-primary" />
									</div>
									<div>
										<div class="font-medium">{agency.name}</div>
										<div class="text-sm text-base-content/50">{agency.slug}</div>
									</div>
								</div>
							</td>
							<td class="text-sm">{agency.ownerEmail || '-'}</td>
							<td>
								<span class="badge {getReasonBadgeClass(agency.freemiumReason)}">
									{reasonLabels[agency.freemiumReason || ''] || agency.freemiumReason || 'Unknown'}
								</span>
							</td>
							<td class="text-sm text-base-content/70">
								{formatDate(agency.freemiumGrantedAt)}
							</td>
							<td class="text-sm text-base-content/70">
								{formatDateOrExpiry(agency.freemiumExpiresAt)}
							</td>
							<td>
								<div class="flex gap-2">
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => goto(`/super-admin/agencies/${agency.id}`)}
										title="View agency"
									>
										<ExternalLink class="h-3 w-3" />
									</button>
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => openExpiryModal(agency)}
										title="Edit expiry"
									>
										<Calendar class="h-3 w-3" />
									</button>
									<button
										class="btn btn-ghost btn-xs text-error"
										onclick={() => openRevokeModal(agency)}
										title="Revoke freemium"
									>
										<XCircle class="h-3 w-3" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<div class="text-sm text-base-content/60">
					Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, freemiumQuery.current.total)} of {freemiumQuery.current.total}
				</div>
				<div class="join">
					<button
						class="btn btn-sm join-item"
						disabled={currentPage === 1}
						onclick={() => currentPage--}
					>
						Previous
					</button>
					<button class="btn btn-sm join-item btn-disabled">
						Page {currentPage} of {totalPages}
					</button>
					<button
						class="btn btn-sm join-item"
						disabled={currentPage === totalPages}
						onclick={() => currentPage++}
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Edit Expiry Modal -->
{#if showExpiryModal && selectedAgency}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Edit Freemium Expiry</h3>
			<p class="py-2 text-base-content/60">
				Set or remove expiry date for <strong>{selectedAgency.name}</strong>
			</p>

			<div class="form-control mt-4">
				<label class="label">
					<span class="label-text">Expiry Date</span>
				</label>
				<input
					type="date"
					class="input input-bordered"
					bind:value={newExpiryDate}
				/>
				<label class="label">
					<span class="label-text-alt text-base-content/50">
						Leave empty for no expiry (permanent freemium)
					</span>
				</label>
			</div>

			<div class="modal-action">
				<button class="btn" onclick={() => (showExpiryModal = false)}>Cancel</button>
				<button class="btn btn-primary" onclick={handleUpdateExpiry} disabled={updatingExpiry}>
					{#if updatingExpiry}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (showExpiryModal = false)}></div>
	</div>
{/if}
<!-- Revoke Freemium Confirmation Modal -->
{#if showRevokeModal && revokingAgency}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Revoke Freemium</h3>
			<p class="py-4">
				Are you sure you want to revoke freemium status from <strong>{revokingAgency.name}</strong>? They will be reverted to the free tier.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={closeRevokeModal} disabled={isRevoking}>
					Cancel
				</button>
				<button class="btn btn-warning" onclick={handleRevoke} disabled={isRevoking}>
					{#if isRevoking}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Revoke Freemium
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={closeRevokeModal}></div>
	</div>
{/if}

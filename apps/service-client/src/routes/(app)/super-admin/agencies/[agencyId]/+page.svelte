<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { ArrowLeft, ExternalLink, Users, FileText, Briefcase, Receipt, Shield, Gift } from 'lucide-svelte';
	import { getAgencyDetails, updateAgencyAccess, impersonateAgency } from '$lib/api/super-admin.remote';
	import { formatDateTime } from '$lib/utils/formatting';
	import { normalizeExpiry } from '$lib/utils/freemium';
	import { getToast } from '$lib/ui/toast_store.svelte';

	type FreemiumReason =
		| 'beta_tester'
		| 'partner'
		| 'promotional'
		| 'early_signup'
		| 'referral_reward'
		| 'internal';

	const reasonLabels: Record<FreemiumReason, string> = {
		beta_tester: 'Beta Tester',
		partner: 'Partner',
		promotional: 'Promotional',
		early_signup: 'Early Signup',
		referral_reward: 'Referral Reward',
		internal: 'Internal'
	};

	const toast = getToast();

	let agencyId = $derived(page.params.agencyId!);

	// Anchored at component setup; recomputes when agencyId changes; the singleton
	// query instance is shared with .refresh() callers, so the post-mutation reload
	// path no longer needs an imperative re-fetch wrapper.
	const detailsQuery = $derived(getAgencyDetails(agencyId));

	let updating = $state(false);

	// Modal state
	let showStatusModal = $state(false);
	let newStatus = $state<'active' | 'suspended' | 'cancelled'>('active');
	let newTier = $state('free');
	let freemiumEnabled = $state(false);
	let freemiumReason = $state<FreemiumReason>('internal');
	let freemiumExpiresAt = $state('');
	let freemiumDirty = $state(false);

	// Seed modal form state from query result. Guarded by !freemiumDirty so a
	// background refetch can't trample user mid-edit changes. handleUpdateStatus
	// resets freemiumDirty=false before refresh() so the post-save seed re-applies.
	$effect(() => {
		if (detailsQuery.ready && detailsQuery.current && !freemiumDirty) {
			const a = detailsQuery.current.agency;
			newStatus = a.status as 'active' | 'suspended' | 'cancelled';
			newTier = a.subscriptionTier;
			freemiumEnabled = a.isFreemium;
			freemiumReason = (a.freemiumReason as FreemiumReason) ?? 'internal';
			freemiumExpiresAt = a.freemiumExpiresAt
				? new Date(a.freemiumExpiresAt).toISOString().slice(0, 10)
				: '';
		}
	});

	function markFreemiumDirty() {
		freemiumDirty = true;
	}

	function clearExpiry() {
		freemiumExpiresAt = '';
		freemiumDirty = true;
	}

	function formatActor(value: string | null, name: string | null): string {
		if (!value) return 'Unknown';
		if (value === 'system:beta_invite') return 'System (beta invite)';
		if (value.startsWith('system:')) return 'System';
		return name ?? value;
	}

	async function handleUpdateStatus() {
		const current = detailsQuery.current;
		if (!current) return;
		updating = true;
		try {
			const payload: Parameters<typeof updateAgencyAccess>[0] = {
				agencyId: current.agency.id,
				status: newStatus,
				subscriptionTier: newTier
			};
			if (freemiumDirty) {
				payload.freemium = freemiumEnabled
					? {
							enabled: true,
							reason: freemiumReason,
							expiresAt: normalizeExpiry(freemiumExpiresAt)
						}
					: { enabled: false };
			}
			await updateAgencyAccess(payload);
			toast.success('Updated', 'Agency access updated successfully');
			showStatusModal = false;
			freemiumDirty = false;
			await detailsQuery.refresh();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to update agency');
		} finally {
			updating = false;
		}
	}

	async function handleImpersonate() {
		const current = detailsQuery.current;
		if (!current) return;
		try {
			const result = await impersonateAgency(current.agency.id);
			if (result.success && result.slug) {
				await invalidateAll();
				await goto(`/${result.slug}`);
			} else {
				toast.error('Error', result.error || 'Failed to access agency');
			}
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to access agency');
		}
	}

	function formatDate(date: Date | string): string {
		return formatDateTime(date);
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'active':
				return 'badge-success';
			case 'suspended':
				return 'badge-warning';
			case 'cancelled':
				return 'badge-error';
			default:
				return 'badge-ghost';
		}
	}

	function getTierBadgeClass(tier: string): string {
		switch (tier) {
			case 'free':
				return 'badge-ghost';
			case 'starter':
				return 'badge-info';
			case 'growth':
				return 'badge-success';
			case 'agency_pro':
				return 'badge-primary';
			default:
				return 'badge-ghost';
		}
	}

	function getRoleBadgeClass(role: string): string {
		switch (role) {
			case 'owner':
				return 'badge-primary';
			case 'admin':
				return 'badge-secondary';
			default:
				return 'badge-ghost';
		}
	}
</script>

<div>
	<!-- Header -->
	<div class="mb-6 flex items-center gap-4">
		<a href="/super-admin/agencies" class="btn btn-ghost btn-sm btn-circle">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div class="flex-1">
			<h1 class="text-2xl font-bold">Agency Details</h1>
		</div>
	</div>

	{#if !detailsQuery.ready}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if detailsQuery.error}
		<div class="alert alert-error">
			<span>{detailsQuery.error?.message ?? 'Failed to load agency details'}</span>
		</div>
	{:else if !detailsQuery.current}
		<div class="alert alert-warning">
			<span>Agency not found.</span>
		</div>
	{:else}
		{@const details = detailsQuery.current}
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Agency Info -->
			<div class="lg:col-span-2 space-y-6">
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<!-- Mobile: Stacked layout -->
						<div class="flex flex-col gap-4 sm:hidden">
							<div class="flex items-center gap-4">
								{#if details.agency.logoAvatarUrl || details.agency.logoUrl}
									<img
										src={details.agency.logoAvatarUrl || details.agency.logoUrl}
										alt={details.agency.name}
										class="h-16 w-16 shrink-0 rounded-lg object-cover"
									/>
								{:else}
									<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<span class="text-2xl font-bold text-primary">
											{details.agency.name.charAt(0)}
										</span>
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<h2 class="text-xl font-bold truncate">{details.agency.name}</h2>
									<p class="text-base-content/60 truncate">/{details.agency.slug}</p>
								</div>
							</div>
							<div class="flex gap-2">
								<span class="badge {getStatusBadgeClass(details.agency.status)} capitalize">
									{details.agency.status}
								</span>
								<span class="badge {getTierBadgeClass(details.agency.subscriptionTier)} capitalize">
									{details.agency.subscriptionTier}
								</span>
							</div>
						</div>

						<!-- Desktop: Side-by-side layout -->
						<div class="hidden sm:flex sm:items-start sm:justify-between">
							<div class="flex items-center gap-4">
								{#if details.agency.logoAvatarUrl || details.agency.logoUrl}
									<img
										src={details.agency.logoAvatarUrl || details.agency.logoUrl}
										alt={details.agency.name}
										class="h-16 w-16 shrink-0 rounded-lg object-cover"
									/>
								{:else}
									<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<span class="text-2xl font-bold text-primary">
											{details.agency.name.charAt(0)}
										</span>
									</div>
								{/if}
								<div>
									<h2 class="text-xl font-bold">{details.agency.name}</h2>
									<p class="text-base-content/60">/{details.agency.slug}</p>
								</div>
							</div>
							<div class="flex gap-2 shrink-0">
								<span class="badge {getStatusBadgeClass(details.agency.status)} capitalize">
									{details.agency.status}
								</span>
								<span class="badge {getTierBadgeClass(details.agency.subscriptionTier)} capitalize">
									{details.agency.subscriptionTier}
								</span>
								{#if details.agency.isFreemium}
									<span class="badge badge-success gap-1">
										<Gift class="h-3 w-3" />
										Freemium
									</span>
								{/if}
							</div>
						</div>

						{#if details.agency.isFreemium}
							<div class="mt-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
								<div class="flex items-center gap-2 font-medium">
									<Gift class="h-4 w-4 text-success" />
									Freemium Access
								</div>
								<div class="mt-1 text-base-content/70">
									Reason: <span class="font-medium">{reasonLabels[(details.agency.freemiumReason as FreemiumReason) ?? 'internal'] ?? details.agency.freemiumReason ?? '-'}</span>
									· Granted by <span class="font-medium">{formatActor(details.agency.freemiumGrantedBy, details.agency.freemiumGrantedByName)}</span>
									{#if details.agency.freemiumGrantedAt} on {formatDate(details.agency.freemiumGrantedAt)}{/if}
									· {details.agency.freemiumExpiresAt ? `Expires ${formatDate(details.agency.freemiumExpiresAt)}` : 'No expiry'}
								</div>
							</div>
						{/if}

						<div class="divider"></div>

						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<p class="text-sm text-base-content/60">Email</p>
								<p class="break-all">{details.agency.email || '-'}</p>
							</div>
							<div>
								<p class="text-sm text-base-content/60">Phone</p>
								<p>{details.agency.phone || '-'}</p>
							</div>
							<div>
								<p class="text-sm text-base-content/60">Website</p>
								<p class="break-all">{details.agency.website || '-'}</p>
							</div>
							<div>
								<p class="text-sm text-base-content/60">Created</p>
								<p>{formatDate(details.agency.createdAt)}</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Stats -->
				<div class="grid gap-4 sm:grid-cols-3">
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body py-4">
							<div class="flex items-center gap-3">
								<FileText class="h-5 w-5 text-primary" />
								<div>
									<p class="text-sm text-base-content/60">Proposals</p>
									<p class="text-xl font-bold">{details.stats.proposals}</p>
								</div>
							</div>
						</div>
					</div>
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body py-4">
							<div class="flex items-center gap-3">
								<Briefcase class="h-5 w-5 text-secondary" />
								<div>
									<p class="text-sm text-base-content/60">Contracts</p>
									<p class="text-xl font-bold">{details.stats.contracts}</p>
								</div>
							</div>
						</div>
					</div>
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body py-4">
							<div class="flex items-center gap-3">
								<Receipt class="h-5 w-5 text-accent" />
								<div>
									<p class="text-sm text-base-content/60">Invoices</p>
									<p class="text-xl font-bold">{details.stats.invoices}</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Members -->
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h3 class="card-title text-lg">
							<Users class="h-5 w-5" />
							Members ({details.members.length})
						</h3>
						{#if details.members.length > 0}
							<!-- Mobile: Card layout -->
							<div class="space-y-3 lg:hidden">
								{#each details.members as member (member.id)}
									<div class="rounded-lg border border-base-300 p-3">
										<div class="flex items-start justify-between gap-2">
											<p class="font-medium text-sm break-all">{member.userEmail}</p>
											<span class="badge {getRoleBadgeClass(member.role)} badge-sm capitalize shrink-0">
												{member.role}
											</span>
										</div>
										<div class="mt-2 flex items-center justify-between text-xs text-base-content/60">
											<span class="badge badge-ghost badge-xs capitalize">{member.status}</span>
											<span>{formatDate(member.createdAt)}</span>
										</div>
									</div>
								{/each}
							</div>

							<!-- Desktop: Table layout -->
							<div class="hidden lg:block overflow-x-auto">
								<table class="table table-sm">
									<thead>
										<tr>
											<th>Email</th>
											<th>Role</th>
											<th>Status</th>
											<th>Joined</th>
										</tr>
									</thead>
									<tbody>
										{#each details.members as member (member.id)}
											<tr>
												<td>{member.userEmail}</td>
												<td>
													<span class="badge {getRoleBadgeClass(member.role)} badge-sm capitalize">
														{member.role}
													</span>
												</td>
												<td>
													<span class="badge badge-ghost badge-sm capitalize">
														{member.status}
													</span>
												</td>
												<td class="text-sm text-base-content/60">
													{formatDate(member.createdAt)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p class="text-base-content/60">No members</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Actions Sidebar -->
			<div class="space-y-4">
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h3 class="card-title text-lg">Actions</h3>

						<div class="space-y-3">
							<button onclick={handleImpersonate} class="btn btn-error btn-outline w-full gap-2">
								<Shield class="h-4 w-4" />
								Access as Owner
							</button>

							<a
								href="/{details.agency.slug}"
								target="_blank"
								class="btn btn-outline w-full gap-2"
							>
								<ExternalLink class="h-4 w-4" />
								View Agency (New Tab)
							</a>

							<button onclick={() => (showStatusModal = true)} class="btn btn-outline w-full">
								Change Access
							</button>
						</div>
					</div>
				</div>

				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h3 class="text-sm font-medium text-base-content/60">Last Updated</h3>
						<p class="text-sm">{formatDate(details.agency.updatedAt)}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Change Access Modal -->
{#if showStatusModal && detailsQuery.current}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Change Access</h3>
			<p class="py-2 text-base-content/70">Modify status, subscription tier, or freemium access for this agency.</p>

			<div class="form-control mt-4">
				<label class="label" for="status-select">
					<span class="label-text">Status</span>
				</label>
				<select id="status-select" class="select select-bordered" bind:value={newStatus}>
					<option value="active">Active</option>
					<option value="suspended">Suspended</option>
				</select>
			</div>

			<div class="form-control mt-4">
				<label class="label" for="tier-select">
					<span class="label-text">Subscription Tier</span>
				</label>
				<select id="tier-select" class="select select-bordered" bind:value={newTier}>
					<option value="free">Free</option>
					<option value="starter">Starter</option>
					<option value="growth">Growth</option>
					<option value="agency_pro">Agency Pro</option>
				</select>
				{#if freemiumEnabled}
					<label class="label">
						<span class="label-text-alt text-warning">⚠ Tier limits ignored while freemium is active</span>
					</label>
				{/if}
			</div>

			<div class="divider mt-6 mb-2 text-xs">Freemium Access</div>

			<div class="form-control">
				<div class="flex gap-6">
					<label class="label cursor-pointer gap-2">
						<input
							type="radio"
							class="radio radio-sm"
							name="freemium-enabled"
							value={false}
							checked={!freemiumEnabled}
							onchange={() => {
								freemiumEnabled = false;
								markFreemiumDirty();
							}}
						/>
						<span class="label-text">None</span>
					</label>
					<label class="label cursor-pointer gap-2">
						<input
							type="radio"
							class="radio radio-sm"
							name="freemium-enabled"
							value={true}
							checked={freemiumEnabled}
							onchange={() => {
								freemiumEnabled = true;
								markFreemiumDirty();
							}}
						/>
						<span class="label-text">Granted</span>
					</label>
				</div>
			</div>

			{#if freemiumEnabled}
				<div class="form-control mt-3">
					<label class="label" for="freemium-reason">
						<span class="label-text">Reason</span>
					</label>
					<select
						id="freemium-reason"
						class="select select-bordered"
						bind:value={freemiumReason}
						onchange={markFreemiumDirty}
					>
						{#each Object.entries(reasonLabels) as [key, label]}
							<option value={key}>{label}</option>
						{/each}
					</select>
				</div>

				<div class="form-control mt-3">
					<label class="label" for="freemium-expires">
						<span class="label-text">Expires</span>
					</label>
					<div class="join">
						<input
							id="freemium-expires"
							type="date"
							class="input input-bordered join-item flex-1"
							bind:value={freemiumExpiresAt}
							oninput={markFreemiumDirty}
						/>
						<button type="button" class="btn join-item" onclick={clearExpiry}>Clear</button>
					</div>
					<label class="label">
						<span class="label-text-alt text-base-content/50">Empty = no expiry (permanent)</span>
					</label>
				</div>
			{/if}

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showStatusModal = false)}>Cancel</button>
				<button class="btn btn-primary" onclick={handleUpdateStatus} disabled={updating}>
					{#if updating}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save Changes
				</button>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-black/50"
			onclick={() => (showStatusModal = false)}
			aria-label="Close modal"
		></button>
	</div>
{/if}

<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { ArrowLeft, ExternalLink, Users, FileText, Briefcase, Receipt, Shield } from 'lucide-svelte';
	import { getAgencyDetails, updateAgencyStatus, impersonateAgency } from '$lib/api/super-admin.remote';
	import { onMount } from 'svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';

	const toast = getToast();

	interface AgencyDetails {
		agency: {
			id: string;
			name: string;
			slug: string;
			email: string;
			phone: string;
			website: string;
			status: string;
			subscriptionTier: string;
			createdAt: Date;
			updatedAt: Date;
			logoUrl: string;
			logoAvatarUrl: string;
		};
		members: Array<{
			id: string;
			userId: string;
			role: string;
			status: string;
			displayName: string;
			createdAt: Date;
			userEmail: string;
		}>;
		stats: {
			proposals: number;
			contracts: number;
			invoices: number;
		};
	}

	let agencyId = $derived(page.params.agencyId!);
	let details = $state<AgencyDetails | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let updating = $state(false);

	// Modal state
	let showStatusModal = $state(false);
	let newStatus = $state<'active' | 'suspended' | 'cancelled'>('active');
	let newTier = $state('free');

	async function loadDetails() {
		loading = true;
		error = null;
		try {
			details = await getAgencyDetails(agencyId);
			if (details) {
				newStatus = details.agency.status as 'active' | 'suspended' | 'cancelled';
				newTier = details.agency.subscriptionTier;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load agency details';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadDetails();
	});

	async function handleUpdateStatus() {
		if (!details) return;
		updating = true;
		try {
			await updateAgencyStatus({
				agencyId: details.agency.id,
				status: newStatus,
				subscriptionTier: newTier
			});
			toast.success('Updated', 'Agency settings updated successfully');
			showStatusModal = false;
			await loadDetails();
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to update agency');
		} finally {
			updating = false;
		}
	}

	async function handleImpersonate() {
		if (!details) return;
		try {
			const result = await impersonateAgency(details.agency.id);
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
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
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
			case 'enterprise':
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

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if details}
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
							</div>
						</div>

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
								Change Status / Tier
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

<!-- Status/Tier Modal -->
{#if showStatusModal && details}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Update Agency Settings</h3>
			<p class="py-2 text-base-content/70">Modify status or subscription tier for this agency.</p>

			<div class="form-control mt-4">
				<label class="label" for="status-select">
					<span class="label-text">Status</span>
				</label>
				<select id="status-select" class="select select-bordered" bind:value={newStatus}>
					<option value="active">Active</option>
					<option value="suspended">Suspended</option>
					<option value="cancelled">Cancelled</option>
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
					<option value="enterprise">Enterprise</option>
				</select>
			</div>

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

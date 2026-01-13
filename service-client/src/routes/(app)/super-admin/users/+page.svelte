<script lang="ts">
	import { Search, ChevronLeft, ChevronRight, Users, Shield, ShieldOff, Building2 } from 'lucide-svelte';
	import { getUsers, getUserDetails, updateUserAccess } from '$lib/api/super-admin.remote';
	import { onMount } from 'svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';

	const toast = getToast();

	interface User {
		id: string;
		email: string;
		access: number;
		created: Date;
		agencyCount: number;
		isSuperAdmin: boolean;
	}

	interface UserDetails {
		user: {
			id: string;
			email: string;
			access: number;
			created: Date;
			isSuperAdmin: boolean;
		};
		memberships: Array<{
			id: string;
			agencyId: string;
			role: string;
			status: string;
			createdAt: Date;
			agencyName: string;
			agencySlug: string;
		}>;
	}

	let users = $state<User[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let search = $state('');
	let superAdminOnly = $state(false);
	let currentPage = $state(1);
	const pageSize = 20;

	let searchDebounce: ReturnType<typeof setTimeout>;

	// Detail modal
	let showDetailModal = $state(false);
	let selectedUser = $state<UserDetails | null>(null);
	let loadingDetails = $state(false);
	let updating = $state(false);

	async function loadUsers() {
		loading = true;
		error = null;
		try {
			const result = await getUsers({
				search: search || undefined,
				superAdminOnly: superAdminOnly || undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			users = result.users;
			total = result.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load users';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadUsers();
	});

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadUsers();
		}, 300);
	}

	function handleFilterChange() {
		currentPage = 1;
		loadUsers();
	}

	async function openUserDetails(userId: string) {
		loadingDetails = true;
		showDetailModal = true;
		try {
			selectedUser = await getUserDetails(userId);
		} catch (e) {
			toast.error('Error', 'Failed to load user details');
			showDetailModal = false;
		} finally {
			loadingDetails = false;
		}
	}

	async function handleToggleSuperAdmin() {
		if (!selectedUser) return;
		updating = true;
		try {
			const result = await updateUserAccess({
				userId: selectedUser.user.id,
				grantSuperAdmin: !selectedUser.user.isSuperAdmin,
				revokeSuperAdmin: selectedUser.user.isSuperAdmin
			});

			if (result.success) {
				toast.success(
					'Updated',
					selectedUser.user.isSuperAdmin ? 'Super admin access revoked' : 'Super admin access granted'
				);
				// Refresh details
				selectedUser = await getUserDetails(selectedUser.user.id);
				// Refresh list
				await loadUsers();
			} else {
				toast.error('Error', result.error || 'Failed to update user');
			}
		} catch (e) {
			toast.error('Error', e instanceof Error ? e.message : 'Failed to update user');
		} finally {
			updating = false;
		}
	}

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
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

	// Truncate email for mobile display
	function truncateEmail(email: string, maxLength: number = 24): string {
		if (email.length <= maxLength) return email;
		const [local, domain] = email.split('@');
		if (!domain) return email.slice(0, maxLength) + '...';
		const maxLocal = maxLength - domain.length - 4; // 4 for "...@"
		if (maxLocal < 4) return email.slice(0, maxLength) + '...';
		return local.slice(0, maxLocal) + '...@' + domain;
	}

	let totalPages = $derived(Math.ceil(total / pageSize));
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Users</h1>
		<p class="text-base-content/70">Manage all users on the platform</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 space-y-3">
		<!-- Search - full width -->
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
			<input
				type="text"
				placeholder="Search by email..."
				class="input input-bordered w-full pl-10"
				bind:value={search}
				oninput={handleSearchInput}
			/>
		</div>

		<!-- Filter checkbox -->
		<label class="label cursor-pointer justify-start gap-2">
			<input
				type="checkbox"
				class="checkbox checkbox-sm checkbox-error"
				bind:checked={superAdminOnly}
				onchange={handleFilterChange}
			/>
			<span class="label-text">Super admins only</span>
		</label>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<span>{error}</span>
		</div>
	{:else if users.length === 0}
		<div class="text-center py-12">
			<Users class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No users found</h3>
			<p class="text-base-content/60">Try adjusting your search</p>
		</div>
	{:else}
		<!-- Mobile: Card Layout -->
		<div class="space-y-3 lg:hidden">
			{#each users as user (user.id)}
				<button
					class="w-full text-left rounded-lg border border-base-300 p-4 hover:bg-base-200/50 transition-colors"
					onclick={() => openUserDetails(user.id)}
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<p class="font-medium text-sm truncate">{user.email}</p>
							<p class="text-xs text-base-content/60 mt-1">
								{user.agencyCount} {user.agencyCount === 1 ? 'agency' : 'agencies'}
							</p>
						</div>
						{#if user.isSuperAdmin}
							<span class="badge badge-error badge-sm gap-1 shrink-0">
								<Shield class="h-3 w-3" />
								Admin
							</span>
						{/if}
					</div>
					<div class="mt-2 text-xs text-base-content/60">
						Created {formatDate(user.created)}
					</div>
				</button>
			{/each}
		</div>

		<!-- Desktop: Table Layout -->
		<div class="hidden lg:block overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead class="bg-base-200">
					<tr>
						<th>Email</th>
						<th>Super Admin</th>
						<th>Agencies</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each users as user (user.id)}
						<tr class="hover:bg-base-200/50">
							<td>{user.email}</td>
							<td>
								{#if user.isSuperAdmin}
									<span class="badge badge-error badge-sm gap-1">
										<Shield class="h-3 w-3" />
										Super Admin
									</span>
								{:else}
									<span class="text-base-content/40">-</span>
								{/if}
							</td>
							<td>
								<span class="badge badge-ghost badge-sm">{user.agencyCount}</span>
							</td>
							<td class="text-sm text-base-content/60">{formatDate(user.created)}</td>
							<td>
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => openUserDetails(user.id)}
								>
									View
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
				<p class="text-sm text-base-content/60">
					Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total}
				</p>
				<div class="flex items-center gap-2">
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === 1}
						onclick={() => {
							currentPage--;
							loadUsers();
						}}
					>
						<ChevronLeft class="h-4 w-4" />
						<span class="hidden sm:inline">Previous</span>
					</button>
					<span class="text-sm">
						{currentPage} / {totalPages}
					</span>
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === totalPages}
						onclick={() => {
							currentPage++;
							loadUsers();
						}}
					>
						<span class="hidden sm:inline">Next</span>
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- User Detail Modal -->
{#if showDetailModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-2xl">
			{#if loadingDetails}
				<div class="flex items-center justify-center py-8">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:else if selectedUser}
				<h3 class="text-lg font-bold">User Details</h3>

				<div class="mt-4 space-y-4">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
						<div class="min-w-0">
							<p class="text-sm text-base-content/60">Email</p>
							<p class="font-medium break-all">{selectedUser.user.email}</p>
						</div>
						{#if selectedUser.user.isSuperAdmin}
							<span class="badge badge-error gap-1 shrink-0 self-start sm:self-center">
								<Shield class="h-3 w-3" />
								Super Admin
							</span>
						{/if}
					</div>

					<div>
						<p class="text-sm text-base-content/60">Account Created</p>
						<p>{formatDate(selectedUser.user.created)}</p>
					</div>

					<div class="divider"></div>

					<div>
						<h4 class="font-medium flex items-center gap-2">
							<Building2 class="h-4 w-4" />
							Agency Memberships ({selectedUser.memberships.length})
						</h4>
						{#if selectedUser.memberships.length > 0}
							<div class="mt-2 space-y-2">
								{#each selectedUser.memberships as membership (membership.id)}
									<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-base-300 p-3">
										<div class="min-w-0">
											<a
												href="/super-admin/agencies/{membership.agencyId}"
												class="font-medium hover:text-primary"
											>
												{membership.agencyName}
											</a>
											<p class="text-sm text-base-content/60">/{membership.agencySlug}</p>
										</div>
										<span class="badge {getRoleBadgeClass(membership.role)} badge-sm capitalize shrink-0 self-start sm:self-center">
											{membership.role}
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="mt-2 text-base-content/60">No agency memberships</p>
						{/if}
					</div>

					<div class="divider"></div>

					<div>
						<h4 class="font-medium mb-2">Super Admin Access</h4>
						<button
							class="btn {selectedUser.user.isSuperAdmin ? 'btn-warning' : 'btn-error'} gap-2"
							onclick={handleToggleSuperAdmin}
							disabled={updating}
						>
							{#if updating}
								<span class="loading loading-spinner loading-sm"></span>
							{:else if selectedUser.user.isSuperAdmin}
								<ShieldOff class="h-4 w-4" />
								Revoke Super Admin
							{:else}
								<Shield class="h-4 w-4" />
								Grant Super Admin
							{/if}
						</button>
						{#if selectedUser.user.isSuperAdmin}
							<p class="mt-2 text-sm text-warning">
								This user currently has super admin access to the entire platform.
							</p>
						{/if}
					</div>
				</div>

				<div class="modal-action">
					<button class="btn btn-ghost" onclick={() => (showDetailModal = false)}>Close</button>
				</div>
			{/if}
		</div>
		<button
			type="button"
			class="modal-backdrop bg-black/50"
			onclick={() => (showDetailModal = false)}
			aria-label="Close modal"
		></button>
	</div>
{/if}

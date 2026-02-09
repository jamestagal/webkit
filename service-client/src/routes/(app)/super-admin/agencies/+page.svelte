<script lang="ts">
	import { Search, Filter, ChevronLeft, ChevronRight, Building2 } from 'lucide-svelte';
	import { getAgencies } from '$lib/api/super-admin.remote';
	import { formatDate } from '$lib/utils/formatting';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface Agency {
		id: string;
		name: string;
		slug: string;
		email: string;
		status: string;
		subscriptionTier: string;
		isFreemium: boolean;
		createdAt: Date;
		memberCount: number;
	}

	let agencies = $state<Agency[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let search = $state('');
	let statusFilter = $state<'active' | 'suspended' | 'cancelled' | ''>('');
	let tierFilter = $state('');
	let currentPage = $state(1);
	const pageSize = 20;

	let searchDebounce: ReturnType<typeof setTimeout>;

	async function loadAgencies() {
		loading = true;
		error = null;
		try {
			const result = await getAgencies({
				search: search || undefined,
				status: statusFilter || undefined,
				tier: tierFilter || undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			agencies = result.agencies;
			total = result.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load agencies';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadAgencies();
	});

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadAgencies();
		}, 300);
	}

	function handleFilterChange() {
		currentPage = 1;
		loadAgencies();
	}

	// formatDate imported from '$lib/utils/formatting'

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

	let totalPages = $derived(Math.ceil(total / pageSize));
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Agencies</h1>
		<p class="text-base-content/70">Manage all agencies on the platform</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 space-y-3">
		<!-- Search - full width on mobile -->
		<div class="relative">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
			<input
				type="text"
				placeholder="Search agencies..."
				class="input input-bordered w-full pl-10"
				bind:value={search}
				oninput={handleSearchInput}
			/>
		</div>

		<!-- Filter dropdowns - row on mobile -->
		<div class="flex items-center gap-2">
			<Filter class="h-4 w-4 text-base-content/60 shrink-0" />
			<select
				class="select select-bordered select-sm flex-1"
				bind:value={statusFilter}
				onchange={handleFilterChange}
			>
				<option value="">All Status</option>
				<option value="active">Active</option>
				<option value="suspended">Suspended</option>
				<option value="cancelled">Cancelled</option>
			</select>

			<select
				class="select select-bordered select-sm flex-1"
				bind:value={tierFilter}
				onchange={handleFilterChange}
			>
				<option value="">All Tiers</option>
				<option value="free">Free</option>
				<option value="starter">Starter</option>
				<option value="growth">Growth</option>
				<option value="enterprise">Enterprise</option>
			</select>
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
	{:else if agencies.length === 0}
		<div class="text-center py-12">
			<Building2 class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No agencies found</h3>
			<p class="text-base-content/60">Try adjusting your search or filters</p>
		</div>
	{:else}
		<!-- Mobile: Card Layout -->
		<div class="space-y-3 lg:hidden">
			{#each agencies as agency (agency.id)}
				<button
					class="w-full text-left rounded-lg border border-base-300 p-4 hover:bg-base-200/50 transition-colors"
					onclick={() => goto(`/super-admin/agencies/${agency.id}`)}
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<p class="font-medium truncate">{agency.name}</p>
							<p class="text-sm text-base-content/60 truncate">/{agency.slug}</p>
						</div>
						<div class="flex flex-col items-end gap-1">
							<span class="badge {getStatusBadgeClass(agency.status)} badge-sm capitalize">
								{agency.status}
							</span>
							<div class="flex items-center gap-1">
								<span class="badge {getTierBadgeClass(agency.subscriptionTier)} badge-sm capitalize">
									{agency.subscriptionTier}
								</span>
								{#if agency.isFreemium}
									<span class="badge badge-warning badge-sm">Free</span>
								{/if}
							</div>
						</div>
					</div>
					<div class="mt-3 flex items-center justify-between text-sm text-base-content/60">
						<span>{agency.memberCount} member{agency.memberCount !== 1 ? 's' : ''}</span>
						<span>{formatDate(agency.createdAt)}</span>
					</div>
				</button>
			{/each}
		</div>

		<!-- Desktop: Table Layout -->
		<div class="hidden lg:block overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead class="bg-base-200">
					<tr>
						<th>Agency</th>
						<th>Status</th>
						<th>Tier</th>
						<th>Members</th>
						<th>Created</th>
					</tr>
				</thead>
				<tbody>
					{#each agencies as agency (agency.id)}
						<tr
							class="cursor-pointer hover:bg-base-200/50"
							onclick={() => goto(`/super-admin/agencies/${agency.id}`)}
						>
							<td>
								<div>
									<p class="font-medium">{agency.name}</p>
									<p class="text-sm text-base-content/60">/{agency.slug}</p>
								</div>
							</td>
							<td>
								<span class="badge {getStatusBadgeClass(agency.status)} badge-sm capitalize">
									{agency.status}
								</span>
							</td>
							<td>
								<div class="flex items-center gap-1">
									<span class="badge {getTierBadgeClass(agency.subscriptionTier)} badge-sm capitalize">
										{agency.subscriptionTier}
									</span>
									{#if agency.isFreemium}
										<span class="badge badge-warning badge-sm">Free</span>
									{/if}
								</div>
							</td>
							<td>{agency.memberCount}</td>
							<td class="text-sm text-base-content/60">{formatDate(agency.createdAt)}</td>
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
							loadAgencies();
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
							loadAgencies();
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

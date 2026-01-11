<script lang="ts">
	import { Search, ChevronLeft, ChevronRight, ScrollText, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { getSystemAuditLogs, getAgencies } from '$lib/api/super-admin.remote';
	import { onMount } from 'svelte';

	interface AuditLog {
		id: string;
		createdAt: Date;
		action: string;
		entityType: string;
		entityId: string | null;
		oldValues: unknown;
		newValues: unknown;
		ipAddress: string | null;
		agencyId: string;
		userId: string | null;
		agencyName: string | null;
		userEmail: string | null;
	}

	interface Agency {
		id: string;
		name: string;
		slug: string;
	}

	let logs = $state<AuditLog[]>([]);
	let agencies = $state<Agency[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let agencyFilter = $state('');
	let actionFilter = $state('');
	let currentPage = $state(1);
	const pageSize = 25;

	// Expanded rows
	let expandedRows = $state<Set<string>>(new Set());

	let searchDebounce: ReturnType<typeof setTimeout>;

	async function loadAgencies() {
		try {
			const result = await getAgencies({ limit: 100 });
			agencies = result.agencies;
		} catch (e) {
			console.error('Failed to load agencies for filter:', e);
		}
	}

	async function loadLogs() {
		loading = true;
		error = null;
		try {
			const result = await getSystemAuditLogs({
				agencyId: agencyFilter || undefined,
				action: actionFilter || undefined,
				limit: pageSize,
				offset: (currentPage - 1) * pageSize
			});
			logs = result.logs;
			total = result.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load audit logs';
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		await loadAgencies();
		await loadLogs();
	});

	function handleFilterChange() {
		currentPage = 1;
		loadLogs();
	}

	function handleActionInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			currentPage = 1;
			loadLogs();
		}, 300);
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

	function toggleExpanded(id: string) {
		if (expandedRows.has(id)) {
			expandedRows.delete(id);
		} else {
			expandedRows.add(id);
		}
		expandedRows = new Set(expandedRows);
	}

	function formatJson(value: unknown): string {
		if (!value) return '-';
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

	function getActionBadgeClass(action: string): string {
		if (action.includes('create') || action.includes('add')) return 'badge-success';
		if (action.includes('delete') || action.includes('remove')) return 'badge-error';
		if (action.includes('update') || action.includes('edit')) return 'badge-warning';
		return 'badge-ghost';
	}

	let totalPages = $derived(Math.ceil(total / pageSize));
</script>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Audit Log</h1>
		<p class="text-base-content/70">System-wide activity log across all agencies</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex flex-wrap items-center gap-4">
		<select
			class="select select-bordered"
			bind:value={agencyFilter}
			onchange={handleFilterChange}
		>
			<option value="">All Agencies</option>
			{#each agencies as agency (agency.id)}
				<option value={agency.id}>{agency.name}</option>
			{/each}
		</select>

		<div class="relative flex-1 min-w-[200px] max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
			<input
				type="text"
				placeholder="Filter by action..."
				class="input input-bordered w-full pl-10"
				bind:value={actionFilter}
				oninput={handleActionInput}
			/>
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
	{:else if logs.length === 0}
		<div class="text-center py-12">
			<ScrollText class="mx-auto h-12 w-12 text-base-content/30" />
			<h3 class="mt-4 text-lg font-medium">No audit logs found</h3>
			<p class="text-base-content/60">Try adjusting your filters</p>
		</div>
	{:else}
		<!-- Table -->
		<div class="overflow-x-auto rounded-lg border border-base-300">
			<table class="table">
				<thead class="bg-base-200">
					<tr>
						<th class="w-8"></th>
						<th>Time</th>
						<th>Agency</th>
						<th>User</th>
						<th>Action</th>
						<th>Entity</th>
					</tr>
				</thead>
				<tbody>
					{#each logs as log (log.id)}
						<tr class="hover:bg-base-200/50">
							<td>
								<button
									class="btn btn-ghost btn-xs btn-circle"
									onclick={() => toggleExpanded(log.id)}
								>
									{#if expandedRows.has(log.id)}
										<ChevronUp class="h-4 w-4" />
									{:else}
										<ChevronDown class="h-4 w-4" />
									{/if}
								</button>
							</td>
							<td class="text-sm whitespace-nowrap">{formatDate(log.createdAt)}</td>
							<td>
								{#if log.agencyName}
									<a
										href="/super-admin/agencies/{log.agencyId}"
										class="link link-hover text-sm"
									>
										{log.agencyName}
									</a>
								{:else}
									<span class="text-base-content/40">-</span>
								{/if}
							</td>
							<td class="text-sm">{log.userEmail || 'System'}</td>
							<td>
								<span class="badge {getActionBadgeClass(log.action)} badge-sm">
									{log.action}
								</span>
							</td>
							<td class="text-sm text-base-content/60">
								{log.entityType}
								{#if log.entityId}
									<span class="text-xs">({log.entityId.slice(0, 8)}...)</span>
								{/if}
							</td>
						</tr>
						{#if expandedRows.has(log.id)}
							<tr class="bg-base-200/30">
								<td colspan="6" class="p-4">
									<div class="grid gap-4 md:grid-cols-2">
										<div>
											<p class="text-sm font-medium text-base-content/60 mb-1">Old Values</p>
											<pre class="text-xs bg-base-300 p-3 rounded-lg overflow-auto max-h-48">{formatJson(log.oldValues)}</pre>
										</div>
										<div>
											<p class="text-sm font-medium text-base-content/60 mb-1">New Values</p>
											<pre class="text-xs bg-base-300 p-3 rounded-lg overflow-auto max-h-48">{formatJson(log.newValues)}</pre>
										</div>
									</div>
									{#if log.ipAddress}
										<p class="mt-2 text-xs text-base-content/50">
											IP Address: {log.ipAddress}
										</p>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="mt-4 flex items-center justify-between">
				<p class="text-sm text-base-content/60">
					Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total}
				</p>
				<div class="flex items-center gap-2">
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === 1}
						onclick={() => {
							currentPage--;
							loadLogs();
						}}
					>
						<ChevronLeft class="h-4 w-4" />
						Previous
					</button>
					<span class="text-sm">
						Page {currentPage} of {totalPages}
					</span>
					<button
						class="btn btn-ghost btn-sm"
						disabled={currentPage === totalPages}
						onclick={() => {
							currentPage++;
							loadLogs();
						}}
					>
						Next
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

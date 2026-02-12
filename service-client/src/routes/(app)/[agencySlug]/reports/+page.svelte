<script lang="ts">
	import { BarChart3, TrendingUp, PieChart, Clock, Users, Lock } from 'lucide-svelte';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import DoughnutChart from '$lib/components/charts/DoughnutChart.svelte';
	let { data } = $props();

	// Status color maps
	const consultationColors: Record<string, string> = {
		draft: '#94a3b8',
		in_progress: '#6366f1',
		completed: '#10b981',
		archived: '#9ca3af',
	};

	const proposalColors: Record<string, string> = {
		draft: '#94a3b8',
		sent: '#3b82f6',
		viewed: '#8b5cf6',
		accepted: '#10b981',
		declined: '#ef4444',
		expired: '#f59e0b',
	};

	let aging = $derived(data.agingBuckets ?? { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 });
	let hasAging = $derived(aging.current + aging.overdue30 + aging.overdue60 + aging.overdue90 > 0);
</script>

<svelte:head>
	<title>{data.agency.name} - Reports</title>
</svelte:head>

{#if data.gated}
	<!-- Upgrade prompt for Free/Starter tiers -->
	<div class="flex flex-col items-center justify-center py-16 text-center">
		<div class="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 mb-4">
			<Lock class="h-8 w-8 text-warning" />
		</div>
		<h1 class="text-2xl font-bold">Reports & Analytics</h1>
		<p class="text-base-content/60 mt-2 max-w-md">
			Upgrade to the Growth plan to access detailed reports, revenue analytics, and team
			performance insights.
		</p>
		<a href="/{data.agency.slug}/settings/billing" class="btn btn-primary mt-6">
			Upgrade Plan
		</a>
	</div>
{:else}
	<div class="space-y-6">
		<div>
			<h1 class="text-2xl font-bold">Reports & Analytics</h1>
			<p class="text-base-content/60 mt-1">Track your agency's performance and growth.</p>
		</div>

		<!-- Report sections grid -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Revenue Overview -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base flex items-center gap-2">
						<BarChart3 class="h-5 w-5 text-primary" />
						Revenue Overview
					</h2>
					{#if data.revenue.data.length > 0}
						<BarChart
							labels={data.revenue.labels}
							datasets={[
								{
									label: 'Revenue',
									data: data.revenue.data,
									backgroundColor: '#6366f1',
								},
							]}
						/>
					{:else}
						<div class="h-48 flex items-center justify-center text-base-content/40">
							<p class="text-sm">No revenue data yet</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Consultation Pipeline -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base flex items-center gap-2">
						<PieChart class="h-5 w-5 text-secondary" />
						Consultation Pipeline
					</h2>
					{#if data.consultationPipeline.length > 0}
						<DoughnutChart
							labels={data.consultationPipeline.map((c) => c.status.replace('_', ' '))}
							data={data.consultationPipeline.map((c) => c.count)}
							backgroundColor={data.consultationPipeline.map(
								(c) => consultationColors[c.status] ?? '#94a3b8',
							)}
						/>
					{:else}
						<div class="h-48 flex items-center justify-center text-base-content/40">
							<p class="text-sm">No consultations yet</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Proposal Conversion -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base flex items-center gap-2">
						<TrendingUp class="h-5 w-5 text-success" />
						Proposal Conversion Rate
					</h2>
					{#if data.proposalStats.length > 0}
						{@const totalSent = data.proposalStats
							.filter((p) => ['sent', 'viewed', 'accepted', 'declined'].includes(p.status))
							.reduce((sum, p) => sum + p.count, 0)}
						{@const accepted = data.proposalStats.find((p) => p.status === 'accepted')?.count ?? 0}
						{@const conversionRate = totalSent > 0 ? Math.round((accepted / totalSent) * 100) : 0}
						<div class="flex items-center justify-between mb-4">
							<span class="text-3xl font-bold">{conversionRate}%</span>
							<span class="text-sm text-base-content/60">{accepted} of {totalSent} accepted</span>
						</div>
						<DoughnutChart
							labels={data.proposalStats.map((p) => p.status.replace('_', ' '))}
							data={data.proposalStats.map((p) => p.count)}
							backgroundColor={data.proposalStats.map(
								(p) => proposalColors[p.status] ?? '#94a3b8',
							)}
							height={160}
						/>
					{:else}
						<div class="h-48 flex items-center justify-center text-base-content/40">
							<p class="text-sm">No proposals yet</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Invoice Aging -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base flex items-center gap-2">
						<Clock class="h-5 w-5 text-warning" />
						Invoice Aging
					</h2>
					{#if hasAging}
						<BarChart
							labels={['Current', '1-30 days', '31-60 days', '60+ days']}
							datasets={[
								{
									label: 'Unpaid Amount',
									data: [aging.current, aging.overdue30, aging.overdue60, aging.overdue90],
									backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
								},
							]}
						/>
					{:else}
						<div class="h-48 flex items-center justify-center text-base-content/40">
							<p class="text-sm">No unpaid invoices</p>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Team Activity (full width) -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h2 class="card-title text-base flex items-center gap-2">
					<Users class="h-5 w-5 text-info" />
					Team Activity
					<span class="text-xs font-normal text-base-content/50">(last 30 days)</span>
				</h2>
				{#if data.teamActivity.length > 0}
					<BarChart
						labels={data.teamActivity.map((t) => t.name)}
						datasets={[
							{
								label: 'Actions',
								data: data.teamActivity.map((t) => t.actions),
								backgroundColor: '#3b82f6',
							},
						]}
						height={160}
					/>
				{:else}
					<div class="h-48 flex items-center justify-center text-base-content/40">
						<p class="text-sm">No team activity recorded yet</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

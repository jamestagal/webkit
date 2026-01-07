<script lang="ts">
	import { MessageCircle, ClipboardList, Users, TrendingUp } from 'lucide-svelte';

	let { data } = $props();

	// Quick stats (placeholder - would be loaded from server)
	let stats = $state([
		{
			label: 'Active Consultations',
			value: '-',
			icon: MessageCircle,
			href: `/${data.agency.slug}/consultation/history?status=in_progress`
		},
		{
			label: 'Completed This Month',
			value: '-',
			icon: ClipboardList,
			href: `/${data.agency.slug}/consultation/history`
		},
		{
			label: 'Team Members',
			value: '-',
			icon: Users,
			href: `/${data.agency.slug}/settings/members`
		}
	]);
</script>

<svelte:head>
	<title>{data.agency.name} - Dashboard</title>
</svelte:head>

<div class="space-y-8">
	<!-- Welcome Header -->
	<div>
		<h1 class="text-2xl font-bold">Welcome to WebKit</h1>
		<p class="text-base-content/70 mt-1">
			{#if data.membership.displayName}
				Logged in as {data.membership.displayName} ({data.membership.role})
			{:else}
				You're logged in as {data.membership.role}
			{/if}
		</p>
	</div>

	<!-- Quick Stats -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each stats as stat (stat.label)}
			<a href={stat.href} class="card bg-base-100 hover:bg-base-200 transition-colors border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-4">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"
							style="background-color: {data.agency.primaryColor}20"
						>
							<stat.icon class="h-6 w-6" style="color: {data.agency.primaryColor}" />
						</div>
						<div>
							<p class="text-2xl font-bold">{stat.value}</p>
							<p class="text-sm text-base-content/60">{stat.label}</p>
						</div>
					</div>
				</div>
			</a>
		{/each}
	</div>

	<!-- Quick Actions -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Quick Actions</h2>
			<div class="mt-4 flex flex-wrap gap-3">
				<a href="/{data.agency.slug}/consultation" class="btn btn-primary">
					<MessageCircle class="h-4 w-4" />
					New Consultation
				</a>
				<a href="/{data.agency.slug}/consultation/history" class="btn btn-outline">
					<ClipboardList class="h-4 w-4" />
					View All Consultations
				</a>
				{#if data.membership.role === 'owner' || data.membership.role === 'admin'}
					<a href="/{data.agency.slug}/settings" class="btn btn-outline">
						<TrendingUp class="h-4 w-4" />
						Agency Settings
					</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- Recent Activity Placeholder -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">Recent Activity</h2>
			<div class="mt-4 text-center py-8 text-base-content/60">
				<p>Activity feed coming soon...</p>
				<p class="text-sm mt-1">Your recent consultations and updates will appear here.</p>
			</div>
		</div>
	</div>
</div>

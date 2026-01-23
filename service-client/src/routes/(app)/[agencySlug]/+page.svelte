<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		MessageCircle,
		ClipboardList,
		Users,
		TrendingUp,
		Rocket,
		Check,
		Sparkles,
		Trash2,
		Lock,
		FileText,
		FileSignature,
		Receipt,
		ClipboardCheck,
		ArrowRight,
		Plus,
		X,
		Loader2,
		AlertTriangle,
		ScrollText,
		UserPlus
	} from 'lucide-svelte';
	import { loadDemoData, clearDemoData } from '$lib/api/demo.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { FEATURES } from '$lib/config/features';

	let { data } = $props();

	const toast = getToast();
	let isLoadingDemo = $state(false);
	let showLoadModal = $state(false);
	let showClearModal = $state(false);

	// Core features for the dashboard
	const coreFeatures = [
		{
			title: 'Consultations',
			description: 'Discover client needs through guided discovery sessions. Capture pain points, goals, and requirements.',
			icon: MessageCircle,
			color: '#6366f1', // Indigo
			viewHref: `/${data.agency.slug}/consultation/history`,
			createHref: `/${data.agency.slug}/consultation`,
			viewLabel: 'View All',
			createLabel: 'New Session'
		},
		{
			title: 'Proposals',
			description: 'Create compelling proposals with performance audits, ROI projections, and professional pricing.',
			icon: FileText,
			color: '#8b5cf6', // Violet
			viewHref: `/${data.agency.slug}/proposals`,
			createHref: `/${data.agency.slug}/proposals/new`,
			viewLabel: 'View All',
			createLabel: 'New Proposal'
		},
		{
			title: 'Contracts',
			description: 'Generate legally-binding agreements with e-signatures. Protect your business and clients.',
			icon: FileSignature,
			color: '#06b6d4', // Cyan
			viewHref: `/${data.agency.slug}/contracts`,
			createHref: `/${data.agency.slug}/contracts/new`,
			viewLabel: 'View All',
			createLabel: 'New Contract'
		},
		{
			title: 'Invoices',
			description: 'Send professional invoices with online payments. Track payments and automate reminders.',
			icon: Receipt,
			color: '#10b981', // Emerald
			viewHref: `/${data.agency.slug}/invoices`,
			createHref: `/${data.agency.slug}/invoices/new`,
			viewLabel: 'View All',
			createLabel: 'New Invoice'
		},
		{
			title: 'Forms',
			description: 'Send customizable forms to clients. Collect project requirements and business details.',
			icon: ClipboardCheck,
			color: '#f59e0b', // Amber
			viewHref: `/${data.agency.slug}/forms`,
			createHref: `/${data.agency.slug}/forms/new`,
			viewLabel: 'View All',
			createLabel: 'New Form'
		},
		{
			title: 'Clients',
			description: 'Central hub for managing client relationships. View all linked documents in one place.',
			icon: Users,
			color: FEATURES.clients.color,
			viewHref: `/${data.agency.slug}/clients`,
			createHref: `/${data.agency.slug}/clients?new=true`,
			viewLabel: 'View All',
			createLabel: 'New Client'
		}
	];

	// Quick stats (placeholder - would be loaded from server)
	let stats = $state([
		{
			label: 'Active Consultations',
			value: data.consultationCount.toString(),
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

	async function handleLoadDemo() {
		showLoadModal = false;
		isLoadingDemo = true;
		try {
			const result = await loadDemoData();
			if (result.success) {
				toast.success('Demo data loaded successfully!');
				await invalidateAll();
			} else {
				toast.error('Demo data already exists');
			}
		} catch (err) {
			toast.error('Failed to load demo data');
			console.error(err);
		} finally {
			isLoadingDemo = false;
		}
	}

	async function handleClearDemo() {
		showClearModal = false;
		isLoadingDemo = true;
		try {
			await clearDemoData();
			toast.success('Demo data cleared');
			await invalidateAll();
		} catch (err) {
			toast.error('Failed to clear demo data');
			console.error(err);
		} finally {
			isLoadingDemo = false;
		}
	}
</script>

<svelte:head>
	<title>{data.agency.name} - Dashboard</title>
</svelte:head>

<div class="space-y-8">
	<!-- Welcome Header -->
	<div class="flex items-start justify-between gap-4">
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
		<a
			href="/{data.agency.slug}/clients?new=true"
			class="btn btn-sm gap-1.5 shrink-0"
			style="background-color: {FEATURES.clients.color}; border-color: {FEATURES.clients.color}; color: white"
		>
			<UserPlus class="h-4 w-4" />
			<span class="hidden sm:inline">Create New Client</span>
			<span class="sm:hidden">New Client</span>
		</a>
	</div>

	<!-- Onboarding Section (shown until profile is complete AND demo data is loaded) -->
	{#if !data.isProfileComplete || !data.hasDemoData}
		<div class="card bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
			<div class="card-body">
				<h2 class="card-title flex items-center gap-2">
					<Rocket class="h-5 w-5" />
					Get Started with Your Agency
				</h2>
				<p class="text-base-content/70 text-sm">Complete these steps to set up your agency and explore the platform.</p>

				<div class="space-y-4 mt-4">
					<!-- Step 1: Agency Settings (Required) -->
					<div class="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
						<div class="flex items-center gap-2">
							<div class="badge badge-outline">Step 1</div>
							{#if data.isProfileComplete}
								<div class="badge badge-success gap-1">
									<Check class="h-3 w-3" /> Complete
								</div>
							{/if}
						</div>
						<div class="flex-1">
							<p class="font-medium">Complete Agency Settings</p>
							<p class="text-sm text-base-content/60">Add your business details, address, and payment info</p>
						</div>
						{#if !data.isProfileComplete}
							<a href="/{data.agency.slug}/settings/profile" class="btn btn-sm btn-primary">
								Go to Settings
							</a>
						{/if}
					</div>

					<!-- Step 2: Demo Data (Locked until Step 1 complete) -->
					<div class="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
						<div class="flex items-center gap-2">
							{#if !data.isProfileComplete}
								<div class="badge badge-ghost gap-1">
									<Lock class="h-3 w-3" /> Step 2
								</div>
							{:else}
								<div class="badge badge-outline">Step 2</div>
								{#if data.hasDemoData}
									<div class="badge badge-success gap-1">
										<Check class="h-3 w-3" /> Loaded
									</div>
								{/if}
							{/if}
						</div>
						<div class="flex-1">
							<p class="font-medium">Load Demo Data (Optional)</p>
							{#if !data.isProfileComplete}
								<p class="text-sm text-base-content/60">Complete Step 1 first to enable demo data</p>
							{:else}
								<p class="text-sm text-base-content/60">See how a full client journey works with sample data</p>
							{/if}
						</div>
						{#if !data.hasDemoData}
							<button
								class="btn btn-sm btn-outline gap-1"
								onclick={() => showLoadModal = true}
								disabled={isLoadingDemo || !data.isProfileComplete}
							>
								{#if isLoadingDemo}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<Sparkles class="h-3 w-3" />
								{/if}
								Load Demo
							</button>
						{:else}
							<button
								class="btn btn-sm btn-ghost text-error gap-1"
								onclick={() => showClearModal = true}
								disabled={isLoadingDemo}
							>
								{#if isLoadingDemo}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<Trash2 class="h-3 w-3" />
								{/if}
								Clear Demo
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

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

	<!-- Core Features Section -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold">Your Toolkit</h2>
				<p class="text-sm text-base-content/60 mt-0.5">Everything you need to manage your client projects</p>
			</div>
			{#if data.membership.role === 'owner' || data.membership.role === 'admin'}
				<a href="/{data.agency.slug}/settings" class="btn btn-sm btn-ghost gap-1.5 text-base-content/70 hover:text-base-content">
					<TrendingUp class="h-4 w-4" />
					Settings
				</a>
			{/if}
		</div>

		<!-- Feature Cards Grid -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each coreFeatures as feature, i}
				<div
					class="group relative overflow-hidden rounded-xl border border-base-300 bg-base-100 transition-all duration-300 hover:border-base-content/20 hover:shadow-lg hover:shadow-base-content/5"
					style="animation: fadeInUp 0.4s ease-out {i * 0.05}s both"
				>
					<!-- Subtle gradient overlay on hover -->
					<div
						class="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
						style="background: linear-gradient(135deg, {feature.color}08 0%, transparent 50%)"
					></div>

					<div class="relative p-5">
						<!-- Header with icon -->
						<div class="flex items-start gap-4">
							<div
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
								style="background-color: {feature.color}15; color: {feature.color}"
							>
								<feature.icon class="h-5 w-5" />
							</div>
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-base-content">{feature.title}</h3>
								<p class="mt-1 text-sm text-base-content/60 leading-relaxed line-clamp-2">
									{feature.description}
								</p>
							</div>
						</div>

						<!-- Action buttons -->
						<div class="mt-4 flex items-center gap-2">
							<a
								href={feature.createHref}
								class="btn btn-sm gap-1.5 flex-1 transition-all duration-200"
								style="background-color: {feature.color}; border-color: {feature.color}; color: white"
							>
								<Plus class="h-3.5 w-3.5" />
								{feature.createLabel}
							</a>
							<a
								href={feature.viewHref}
								class="btn btn-sm btn-ghost gap-1 text-base-content/70 hover:text-base-content"
							>
								{feature.viewLabel}
								<ArrowRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
							</a>
						</div>
					</div>

					<!-- Bottom accent line -->
					<div
						class="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full"
						style="background-color: {feature.color}"
					></div>
				</div>
			{/each}
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

<!-- Load Demo Data Modal -->
{#if showLoadModal}
<dialog class="modal modal-open">
	<div class="modal-box">
		<button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => showLoadModal = false}>
			<X class="h-4 w-4" />
		</button>

		<div class="flex items-center gap-3 mb-4">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
				<Sparkles class="h-5 w-5 text-primary" />
			</div>
			<h3 class="font-bold text-lg">Load Demo Data</h3>
		</div>

		<p class="text-base-content/70 mb-4">
			This will create a complete Murray's Plumbing demo scenario including:
		</p>

		<div class="grid grid-cols-2 gap-2 mb-4">
			<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
				<Users class="h-4 w-4 text-primary" />
				<span>Client</span>
			</div>
			<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
				<MessageCircle class="h-4 w-4 text-primary" />
				<span>Consultation</span>
			</div>
			<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
				<FileText class="h-4 w-4 text-primary" />
				<span>Proposal</span>
			</div>
			<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
				<ScrollText class="h-4 w-4 text-primary" />
				<span>Contract</span>
			</div>
			<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
				<Receipt class="h-4 w-4 text-primary" />
				<span>Invoice</span>
			</div>
		</div>

		<p class="text-sm text-base-content/60">
			All entities are linked via a unified client record for easy tracking.
		</p>

		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => showLoadModal = false}>
				Cancel
			</button>
			<button type="button" class="btn btn-primary" onclick={handleLoadDemo} disabled={isLoadingDemo}>
				{#if isLoadingDemo}
					<Loader2 class="h-4 w-4 animate-spin" />
					Loading...
				{:else}
					<Sparkles class="h-4 w-4" />
					Load Demo Data
				{/if}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="button" onclick={() => showLoadModal = false}>close</button>
	</form>
</dialog>
{/if}

<!-- Clear Demo Data Modal -->
{#if showClearModal}
<dialog class="modal modal-open">
	<div class="modal-box">
		<button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => showClearModal = false}>
			<X class="h-4 w-4" />
		</button>

		<div class="flex items-center gap-3 mb-4">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-error/10">
				<Trash2 class="h-5 w-5 text-error" />
			</div>
			<h3 class="font-bold text-lg">Clear Demo Data</h3>
		</div>

		<p class="text-base-content/70 mb-4">
			Are you sure you want to delete all demo data? This will remove:
		</p>

		<ul class="list-disc list-inside text-sm text-base-content/70 space-y-1 mb-4">
			<li>Demo client (Murray's Plumbing)</li>
			<li>All linked consultations</li>
			<li>All linked proposals</li>
			<li>All linked contracts</li>
			<li>All linked invoices</li>
		</ul>

		<div class="alert alert-warning py-2">
			<AlertTriangle class="h-4 w-4" />
			<span class="text-sm">This action cannot be undone.</span>
		</div>

		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => showClearModal = false}>
				Cancel
			</button>
			<button type="button" class="btn btn-error" onclick={handleClearDemo} disabled={isLoadingDemo}>
				{#if isLoadingDemo}
					<Loader2 class="h-4 w-4 animate-spin" />
					Clearing...
				{:else}
					<Trash2 class="h-4 w-4" />
					Clear Demo Data
				{/if}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="button" onclick={() => showClearModal = false}>close</button>
	</form>
</dialog>
{/if}

<style>
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

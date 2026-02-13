<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { loadDemoData, clearDemoData, getDemoDataStatus } from '$lib/api/demo.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import { Sparkles, Trash2, Play, CheckCircle, FileText, MessageCircle, Receipt, ScrollText, ClipboardCheck, AlertTriangle, X, Loader2, Users } from 'lucide-svelte';

	let { data } = $props();

	const toast = getToast();
	let isLoading = $state(false);
	let hasDemoData = $state(false);
	let showClearModal = $state(false);
	let showLoadModal = $state(false);

	// Check demo data status on mount
	$effect(() => {
		getDemoDataStatus().then((status) => {
			hasDemoData = status.hasDemoData;
		});
	});

	async function handleLoad() {
		showLoadModal = false;
		isLoading = true;
		try {
			const result = await loadDemoData();
			if (result.success) {
				hasDemoData = true;
				toast.success('Demo data loaded successfully!');
				await invalidateAll();
			} else {
				toast.error('Demo data already exists');
			}
		} catch (err) {
			toast.error('Failed to load demo data');
			console.error(err);
		} finally {
			isLoading = false;
		}
	}

	async function handleClear() {
		showClearModal = false;
		isLoading = true;
		try {
			await clearDemoData();
			hasDemoData = false;
			toast.success('Demo data cleared');
			await invalidateAll();
		} catch (err) {
			toast.error('Failed to clear demo data');
			console.error(err);
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Demo Data - {data.agency.name}</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Demo Data</h1>
		<p class="text-base-content/70 mt-1">Load sample data to explore all features of the platform</p>
	</div>

	{#if !data.isProfileComplete}
		<div class="alert alert-warning">
			<AlertTriangle class="h-5 w-5" />
			<div>
				<h3 class="font-bold">Complete Agency Settings First</h3>
				<p class="text-sm">Demo data requires your agency profile (business name, address, etc.) to be complete so that proposals and invoices display correctly.</p>
			</div>
			<a href="/{data.agency.slug}/settings/profile" class="btn btn-sm">Go to Settings</a>
		</div>
	{/if}

	<SettingsSection title="Murray's Plumbing Demo" icon={Sparkles}>
		<p class="text-base-content/70 mb-4">
			This creates a complete client journey example to help you understand how the platform works.
			All demo entities are prefixed with "Demo:" for easy identification.
		</p>

		<div class="grid gap-3 sm:grid-cols-2 mb-6">
			<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">
				<MessageCircle class="h-5 w-5 text-primary" />
				<div>
					<p class="font-medium text-sm">Consultation</p>
					<p class="text-xs text-base-content/60">Demo: Murray's Plumbing</p>
				</div>
			</div>
			<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">
				<FileText class="h-5 w-5 text-primary" />
				<div>
					<p class="font-medium text-sm">Proposal</p>
					<p class="text-xs text-base-content/60">Demo: Website Redesign</p>
				</div>
			</div>
			<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">
				<ScrollText class="h-5 w-5 text-primary" />
				<div>
					<p class="font-medium text-sm">Contract</p>
					<p class="text-xs text-base-content/60">Demo: Service Agreement</p>
				</div>
			</div>
			<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">
				<Receipt class="h-5 w-5 text-primary" />
				<div>
					<p class="font-medium text-sm">Invoice</p>
					<p class="text-xs text-base-content/60">Demo: Deposit Invoice</p>
				</div>
			</div>
			<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">
				<ClipboardCheck class="h-5 w-5 text-primary" />
				<div>
					<p class="font-medium text-sm">Quotation</p>
					<p class="text-xs text-base-content/60">Demo: Bathroom Shower Retile</p>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-4">
			{#if !hasDemoData}
				<button class="btn btn-primary" onclick={() => showLoadModal = true} disabled={isLoading || !data.isProfileComplete}>
					{#if isLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Play class="h-4 w-4" />
					{/if}
					Load Demo Data
				</button>
			{:else}
				<button class="btn btn-error btn-outline" onclick={() => showClearModal = true} disabled={isLoading}>
					{#if isLoading}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<Trash2 class="h-4 w-4" />
					{/if}
					Clear Demo Data
				</button>
				<div class="flex items-center gap-2 text-success">
					<CheckCircle class="h-5 w-5" />
					<span class="text-sm font-medium">Demo data loaded</span>
				</div>
			{/if}
		</div>
	</SettingsSection>

	{#if hasDemoData}
		<SettingsSection title="Explore Demo Data" description="Navigate to see the demo entities in action">
			<div class="flex flex-wrap gap-2">
				<a href="/{data.agency.slug}/consultation/history" class="btn btn-outline btn-sm">
					<MessageCircle class="h-4 w-4" />
					View Consultations
				</a>
				<a href="/{data.agency.slug}/proposals" class="btn btn-outline btn-sm">
					<FileText class="h-4 w-4" />
					View Proposals
				</a>
				<a href="/{data.agency.slug}/contracts" class="btn btn-outline btn-sm">
					<ScrollText class="h-4 w-4" />
					View Contracts
				</a>
				<a href="/{data.agency.slug}/invoices" class="btn btn-outline btn-sm">
					<Receipt class="h-4 w-4" />
					View Invoices
				</a>
				<a href="/{data.agency.slug}/quotations" class="btn btn-outline btn-sm">
					<ClipboardCheck class="h-4 w-4" />
					View Quotations
				</a>
			</div>
		</SettingsSection>
	{/if}
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
			<div class="flex items-center gap-2 text-sm p-2 bg-base-200 rounded">
				<ClipboardCheck class="h-4 w-4 text-primary" />
				<span>Quotation</span>
			</div>
		</div>

		<p class="text-sm text-base-content/60">
			All entities are linked via a unified client record for easy tracking.
		</p>

		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => showLoadModal = false}>
				Cancel
			</button>
			<button type="button" class="btn btn-primary" onclick={handleLoad} disabled={isLoading}>
				{#if isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
					Loading...
				{:else}
					<Play class="h-4 w-4" />
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
			<li>All linked quotations</li>
		</ul>

		<div class="alert alert-warning py-2">
			<AlertTriangle class="h-4 w-4" />
			<span class="text-sm">This action cannot be undone.</span>
		</div>

		<div class="modal-action">
			<button type="button" class="btn btn-ghost" onclick={() => showClearModal = false}>
				Cancel
			</button>
			<button type="button" class="btn btn-error" onclick={handleClear} disabled={isLoading}>
				{#if isLoading}
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

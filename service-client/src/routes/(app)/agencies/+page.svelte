<script lang="ts">
	import { goto } from '$app/navigation';
	import { Building2, Plus, Star, ChevronRight, AlertTriangle } from 'lucide-svelte';
	import { setDefaultAgency } from '$lib/api/agency.remote';

	let { data } = $props();

	let settingDefault = $state<string | null>(null);

	async function handleSetDefault(agencyId: string) {
		settingDefault = agencyId;
		try {
			await setDefaultAgency(agencyId);
			// Refresh the page to update the default indicator
			window.location.reload();
		} catch (err) {
			console.error('Failed to set default agency:', err);
		} finally {
			settingDefault = null;
		}
	}

	function handleSelectAgency(slug: string) {
		goto(`/${slug}`);
	}
</script>

<svelte:head>
	<title>Your Agencies</title>
</svelte:head>

<div class="mx-auto max-w-4xl">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold">Your Agencies</h1>
		<p class="text-base-content/70 mt-1">Select an agency to continue or create a new one.</p>
	</div>

	<!-- Access revoked warning -->
	{#if data.reason === 'access_revoked'}
		<div class="alert alert-warning mb-6">
			<AlertTriangle class="h-5 w-5" />
			<span>Your access to the previous agency was revoked. Please select another agency.</span>
		</div>
	{/if}

	<!-- No agencies prompt -->
	{#if data.showCreatePrompt}
		<div class="card bg-base-200 text-center py-12">
			<div class="card-body items-center">
				<Building2 class="h-16 w-16 text-base-content/30 mb-4" />
				<h2 class="card-title">No Agencies Yet</h2>
				<p class="text-base-content/70 max-w-md">
					You don't belong to any agencies yet. Create your first agency to get started with
					consultations and proposals.
				</p>
				<div class="card-actions mt-6">
					<a href="/agencies/create" class="btn btn-primary">
						<Plus class="h-5 w-5" />
						Create Your First Agency
					</a>
				</div>
			</div>
		</div>
	{:else}
		<!-- Agency list -->
		<div class="space-y-3">
			{#each data.agencies as agency (agency.id)}
				<div
					class="card bg-base-100 hover:bg-base-200 transition-colors cursor-pointer border border-base-300"
				>
					<div class="card-body p-4">
						<div class="flex items-center gap-4">
							<!-- Agency Logo/Initial -->
							{#if agency.logoUrl}
								<img
									src={agency.logoUrl}
									alt={agency.name}
									class="h-12 w-12 rounded-lg object-cover"
								/>
							{:else}
								<div
									class="flex h-12 w-12 items-center justify-center rounded-lg text-white text-xl font-bold"
									style="background-color: {agency.primaryColor}"
								>
									{agency.name.charAt(0).toUpperCase()}
								</div>
							{/if}

							<!-- Agency Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<h3 class="font-semibold truncate">{agency.name}</h3>
									{#if data.defaultAgencyId === agency.id}
										<span class="badge badge-sm badge-primary">Default</span>
									{/if}
								</div>
								<p class="text-sm text-base-content/60 capitalize">{agency.role}</p>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-2">
								<!-- Set as default button -->
								{#if data.defaultAgencyId !== agency.id}
									<button
										class="btn btn-ghost btn-sm tooltip"
										data-tip="Set as default"
										onclick={() => handleSetDefault(agency.id)}
										disabled={settingDefault === agency.id}
									>
										{#if settingDefault === agency.id}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<Star class="h-4 w-4" />
										{/if}
									</button>
								{/if}

								<!-- Select button -->
								<button
									class="btn btn-primary btn-sm"
									onclick={() => handleSelectAgency(agency.slug)}
								>
									Open
									<ChevronRight class="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Create new agency button -->
		<div class="mt-6">
			<a href="/agencies/create" class="btn btn-outline w-full">
				<Plus class="h-5 w-5" />
				Create New Agency
			</a>
		</div>
	{/if}
</div>

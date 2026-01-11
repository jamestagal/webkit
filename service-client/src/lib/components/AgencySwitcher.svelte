<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Building2, ChevronDown, Check, Plus, Settings, Users, LogOut, Shield } from 'lucide-svelte';
	import { switchAgency, setDefaultAgency } from '$lib/api/agency.remote';
	import type { AgencyRole } from '$lib/server/schema';

	interface Agency {
		id: string;
		name: string;
		slug: string;
		logoUrl: string | null;
		primaryColor: string;
		role: AgencyRole;
	}

	interface Props {
		currentAgency: Agency;
		agencies: Agency[];
		showManageLink?: boolean;
		isSuperAdmin?: boolean;
	}

	let { currentAgency, agencies, showManageLink = true, isSuperAdmin = false }: Props = $props();

	// Local state
	let showDropdown = $state(false);
	let isSwitching = $state<string | null>(null);

	// Derived state
	let otherAgencies = $derived(agencies.filter((a) => a.id !== currentAgency.id));
	let canAdmin = $derived(currentAgency.role === 'owner' || currentAgency.role === 'admin');

	async function handleAgencySelect(agency: Agency) {
		if (isSwitching) return;

		try {
			isSwitching = agency.id;
			showDropdown = false;

			await switchAgency(agency.id);

			// Navigate to the new agency's dashboard
			await goto(`/${agency.slug}`);

			// Invalidate all data to refresh with new context
			await invalidateAll();
		} catch (error) {
			console.error('Failed to switch agency:', error);
			// Still try to navigate even if switch failed
			await goto(`/${agency.slug}`);
		} finally {
			isSwitching = null;
		}
	}

	async function handleSetDefault(agencyId: string, e: MouseEvent) {
		e.stopPropagation();
		try {
			await setDefaultAgency(agencyId);
		} catch (error) {
			console.error('Failed to set default agency:', error);
		}
	}

	function getInitial(name: string): string {
		return name ? name.charAt(0).toUpperCase() : '?';
	}

	function toggleDropdown() {
		showDropdown = !showDropdown;
	}

	function closeDropdown() {
		showDropdown = false;
	}

	// Handle click outside to close dropdown
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const dropdown = target.closest('.agency-switcher-container');
		if (!dropdown && showDropdown) {
			showDropdown = false;
		}
	}

	// Add/remove click listener when dropdown opens/closes
	$effect(() => {
		if (showDropdown) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="agency-switcher-container dropdown dropdown-end">
	<!-- Trigger Button -->
	<button
		class="btn btn-ghost gap-2 px-2"
		onclick={toggleDropdown}
		disabled={isSwitching !== null}
	>
		<!-- Agency Avatar -->
		{#if currentAgency.logoUrl}
			<img
				src={currentAgency.logoUrl}
				alt={currentAgency.name}
				class="h-8 w-8 rounded-lg object-cover"
			/>
		{:else}
			<div
				class="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-sm"
				style="background-color: {currentAgency.primaryColor}"
			>
				{getInitial(currentAgency.name)}
			</div>
		{/if}

		<!-- Agency Info (hidden on mobile) -->
		<div class="hidden sm:flex flex-col items-start">
			<span class="text-sm font-medium truncate max-w-[120px]">{currentAgency.name}</span>
			<span class="text-xs text-base-content/60">/{currentAgency.slug}</span>
		</div>

		<ChevronDown class="h-4 w-4 text-base-content/60" />
	</button>

	<!-- Dropdown Content -->
	{#if showDropdown}
		<div
			class="dropdown-content menu bg-base-100 rounded-box z-50 mt-2 w-72 p-2 shadow-lg border border-base-300"
		>
			<!-- Current Agency Header -->
			<div class="px-3 py-2">
				<span class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
					Current Agency
				</span>
			</div>

			<div class="mx-1 mb-2 flex items-center gap-3 rounded-lg bg-primary/10 p-3">
				{#if currentAgency.logoUrl}
					<img
						src={currentAgency.logoUrl}
						alt={currentAgency.name}
						class="h-10 w-10 rounded-lg object-cover"
					/>
				{:else}
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold"
						style="background-color: {currentAgency.primaryColor}"
					>
						{getInitial(currentAgency.name)}
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<div class="font-medium truncate">{currentAgency.name}</div>
					<div class="text-sm text-base-content/60">/{currentAgency.slug}</div>
				</div>
				<Check class="h-5 w-5 text-primary" />
			</div>

			<!-- Quick Links for Current Agency -->
			<div class="divider my-1"></div>

			<li>
				<a href="/{currentAgency.slug}" onclick={closeDropdown}>
					<Building2 class="h-4 w-4" />
					Dashboard
				</a>
			</li>
			{#if canAdmin}
				<li>
					<a href="/{currentAgency.slug}/settings" onclick={closeDropdown}>
						<Settings class="h-4 w-4" />
						Settings
					</a>
				</li>
				<li>
					<a href="/{currentAgency.slug}/settings/members" onclick={closeDropdown}>
						<Users class="h-4 w-4" />
						Team Members
					</a>
				</li>
			{/if}

			<!-- Other Agencies -->
			{#if otherAgencies.length > 0}
				<div class="divider my-1"></div>

				<div class="px-3 py-2">
					<span class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
						Switch Agency
					</span>
				</div>

				{#each otherAgencies as agency (agency.id)}
					<li>
						<button
							class="flex items-center gap-3 w-full"
							onclick={() => handleAgencySelect(agency)}
							disabled={isSwitching === agency.id}
						>
							{#if agency.logoUrl}
								<img
									src={agency.logoUrl}
									alt={agency.name}
									class="h-8 w-8 rounded-lg object-cover"
								/>
							{:else}
								<div
									class="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-sm"
									style="background-color: {agency.primaryColor}"
								>
									{getInitial(agency.name)}
								</div>
							{/if}
							<div class="flex-1 min-w-0 text-left">
								<div class="font-medium truncate">{agency.name}</div>
								<div class="text-xs text-base-content/60">/{agency.slug}</div>
							</div>
							{#if isSwitching === agency.id}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
						</button>
					</li>
				{/each}
			{/if}

			<!-- Manage Link -->
			{#if showManageLink}
				<div class="divider my-1"></div>

				<li>
					<a href="/agencies" class="text-primary" onclick={closeDropdown}>
						<Building2 class="h-4 w-4" />
						Manage Agencies
					</a>
				</li>
				<li>
					<a href="/agencies/create" onclick={closeDropdown}>
						<Plus class="h-4 w-4" />
						Create New Agency
					</a>
				</li>
			{/if}

			<!-- Super Admin Link -->
			{#if isSuperAdmin}
				<div class="divider my-1"></div>

				<li>
					<a href="/super-admin" class="text-error font-medium" onclick={closeDropdown}>
						<Shield class="h-4 w-4" />
						Super Admin
					</a>
				</li>
			{/if}
		</div>
	{/if}
</div>

<style>
	.agency-switcher-container {
		position: relative;
	}

	.dropdown-content {
		position: absolute;
		right: 0;
	}
</style>

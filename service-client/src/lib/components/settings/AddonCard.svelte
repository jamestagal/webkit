<script lang="ts">
	import { MoreVertical, Pencil, Copy, Trash2, GripVertical } from 'lucide-svelte';
	import type { getAddonsWithPackages } from '$lib/api/agency-addons.remote';

	type AgencyAddonWithPackages = Awaited<ReturnType<typeof getAddonsWithPackages>>[number];

	interface Props {
		addon: AgencyAddonWithPackages;
		agencySlug: string;
		onDuplicate?: (id: string) => void;
		onDelete?: (id: string) => void;
		isDragging?: boolean;
	}

	let { addon, agencySlug, onDuplicate, onDelete, isDragging = false }: Props = $props();

	let menuOpen = $state(false);

	// Format price display
	function formatPrice(price: string | null): string {
		if (!price || price === '0.00') return '-';
		return `$${parseFloat(price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
	}

	// Get pricing type label
	function getPricingLabel(type: string): string {
		switch (type) {
			case 'one_time':
				return 'One-time';
			case 'monthly':
				return 'Monthly';
			case 'per_unit':
				return `Per ${addon.unitLabel || 'unit'}`;
			default:
				return type;
		}
	}
</script>

<div
	class="card bg-base-100 border border-base-300 transition-all duration-200"
	class:opacity-50={isDragging}
	class:ring-2={isDragging}
	class:ring-primary={isDragging}
>
	<div class="card-body p-4">
		<div class="flex items-start justify-between gap-3">
			<!-- Drag handle -->
			<div class="cursor-grab text-base-content/30 hover:text-base-content/60 mt-1">
				<GripVertical class="h-5 w-5" />
			</div>

			<!-- Addon info -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<h3 class="font-semibold truncate">{addon.name}</h3>
					{#if !addon.isActive}
						<div class="badge badge-ghost badge-sm">Inactive</div>
					{/if}
				</div>

				<div class="flex items-baseline gap-1 mt-1">
					<span class="text-xl font-bold">{formatPrice(addon.price)}</span>
					<span class="text-sm text-base-content/60">{getPricingLabel(addon.pricingType)}</span>
				</div>

				{#if addon.description}
					<p class="text-sm text-base-content/60 mt-2 line-clamp-2">{addon.description}</p>
				{/if}

				<!-- Package availability -->
				<div class="mt-2">
					{#if addon.packageNames.length === 1 && addon.packageNames[0] === 'All packages'}
						<span class="badge badge-outline badge-sm">All packages</span>
					{:else}
						<div class="flex flex-wrap gap-1">
							{#each addon.packageNames as pkgName}
								<span class="badge badge-outline badge-sm">{pkgName}</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Actions dropdown -->
			<div class="dropdown dropdown-end">
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-square"
					onclick={() => (menuOpen = !menuOpen)}
				>
					<MoreVertical class="h-4 w-4" />
				</button>
				{#if menuOpen}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<ul
						class="dropdown-content menu bg-base-100 rounded-box z-10 w-40 p-2 shadow-lg border border-base-300"
						onclick={() => (menuOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
					>
						<li>
							<a href="/{agencySlug}/settings/addons/{addon.id}">
								<Pencil class="h-4 w-4" />
								Edit
							</a>
						</li>
						<li>
							<button type="button" onclick={() => onDuplicate?.(addon.id)}>
								<Copy class="h-4 w-4" />
								Duplicate
							</button>
						</li>
						<li>
							<button
								type="button"
								class="text-error"
								onclick={() => onDelete?.(addon.id)}
							>
								<Trash2 class="h-4 w-4" />
								Delete
							</button>
						</li>
					</ul>
				{/if}
			</div>
		</div>
	</div>
</div>

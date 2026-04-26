<script lang="ts">
	import { page } from "$app/state";
	import { goto, invalidateAll } from "$app/navigation";
	import { Plus, Share2, Trash2 } from "lucide-svelte";
	import { SOCIAL_PLATFORMS } from "$lib/api/content-social.types";
	import { deleteCopy } from "$lib/api/content-copy.remote";
	import { formatDate } from "$lib/utils/formatting";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);

	// Filter state
	let statusFilter = $derived(page.url.searchParams.get("status") || "");
	let platformFilter = $derived(page.url.searchParams.get("platform") || "");

	// Client-side status filter (Go endpoint doesn't support ?status= yet)
	let filteredPosts = $derived(statusFilter ? data.posts.filter(p => p.status === statusFilter) : data.posts);

	// Delete modal state
	let showDeleteModal = $state(false);
	let deletingItem: (typeof data.posts)[number] | null = $state(null);
	let isDeleting = $state(false);

	function formatPlatform(p: string): string {
		return p.charAt(0).toUpperCase() + p.slice(1);
	}

	function platformBadgeClass(platform: string): string {
		switch (platform) {
			case "twitter":
				return "badge-info";
			case "linkedin":
				return "badge-primary";
			case "facebook":
				return "badge-secondary";
			case "instagram":
				return "badge-accent";
			default:
				return "badge-ghost";
		}
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case "final":
				return "badge-success";
			case "draft":
			default:
				return "badge-ghost";
		}
	}

	function parseGenerationConfig(configStr: string): { angle?: string; platform?: string; hashtags?: string[]; post_goal?: string } {
		try {
			return JSON.parse(configStr);
		} catch {
			return {};
		}
	}

	function updateFilter(key: string, value: string | null) {
		const params = new URLSearchParams(page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		goto(`?${params.toString()}`, { replaceState: true });
	}

	function openDeleteModal(post: (typeof data.posts)[number]) {
		deletingItem = post;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!deletingItem) return;
		isDeleting = true;
		try {
			await deleteCopy(deletingItem.id);
			showDeleteModal = false;
			deletingItem = null;
			await invalidateAll();
		} catch {
			// Error handled by remote function
		} finally {
			isDeleting = false;
		}
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div class="flex items-center gap-2">
			<h2 class="text-xl font-semibold">Social Posts</h2>
			<span class="badge badge-neutral badge-sm">{data.posts.length}</span>
		</div>
		<a
			href="/{agencySlug}/content/{clientId}/social/generate"
			class="btn btn-primary btn-sm"
		>
			<Plus class="h-4 w-4" />
			Generate New
		</a>
	</div>

	<!-- Platform filter pills -->
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="btn btn-sm"
			class:btn-active={!platformFilter}
			onclick={() => updateFilter("platform", null)}
		>
			All
		</button>
		{#each SOCIAL_PLATFORMS as p}
			<button
				type="button"
				class="btn btn-sm"
				class:btn-active={platformFilter === p}
				onclick={() => updateFilter("platform", p)}
			>
				{formatPlatform(p)}
			</button>
		{/each}
	</div>

	<!-- Status filter -->
	<div role="tablist" class="tabs tabs-boxed tabs-sm w-fit">
		<button
			role="tab"
			class="tab"
			class:tab-active={!statusFilter}
			onclick={() => updateFilter("status", null)}
		>
			All
		</button>
		<button
			role="tab"
			class="tab"
			class:tab-active={statusFilter === "draft"}
			onclick={() => updateFilter("status", "draft")}
		>
			Drafts
		</button>
		<button
			role="tab"
			class="tab"
			class:tab-active={statusFilter === "final"}
			onclick={() => updateFilter("status", "final")}
		>
			Final
		</button>
	</div>

	{#if filteredPosts.length === 0}
		<!-- Empty state -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
					<Share2 class="h-8 w-8 text-base-content/30" />
				</div>
				{#if statusFilter || platformFilter}
					<h3 class="text-lg font-semibold">No posts found</h3>
					<p class="text-base-content/60 max-w-sm">
						No social posts match your current filters. Try adjusting your platform or status filter.
					</p>
					<button
						type="button"
						class="btn btn-outline mt-4"
						onclick={() => goto("?", { replaceState: true })}
					>
						Clear Filters
					</button>
				{:else}
					<h3 class="text-lg font-semibold">No Social Posts Generated</h3>
					<p class="text-base-content/60 max-w-sm">
						Generate your first AI-powered social media posts for this client.
					</p>
					<a
						href="/{agencySlug}/content/{clientId}/social/generate"
						class="btn btn-primary mt-4"
					>
						<Plus class="h-4 w-4" />
						Generate your first post
					</a>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Mobile Card Layout -->
		<div class="space-y-3 md:hidden">
			{#each filteredPosts as post (post.id)}
				{@const config = parseGenerationConfig(post.generation_config)}
				<div class="card bg-base-100 border border-base-300 hover:border-base-content/20 transition-colors">
					<a
						href="/{agencySlug}/content/{clientId}/social/{post.id}"
						class="card-body p-4"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="flex-1 min-w-0">
								<div class="font-medium truncate">{post.title}</div>
								<div class="flex items-center gap-2 mt-1 flex-wrap">
									<span class="badge badge-sm {platformBadgeClass(config.platform || 'unknown')}">{formatPlatform(config.platform || "unknown")}</span>
									{#if config.angle}
										<span class="badge badge-sm badge-outline">{config.angle}</span>
									{/if}
									<span class="badge badge-sm {statusBadgeClass(post.status)}">{post.status}</span>
								</div>
							</div>
						</div>
						<div class="flex items-center gap-4 mt-2 pt-2 border-t border-base-200 text-xs text-base-content/50">
							<span>{post.content.length} chars</span>
							<span>{formatDate(post.created_at, "short")}</span>
						</div>
					</a>
					{#if post.status === "draft"}
						<div class="px-4 pb-3">
							<button
								type="button"
								class="btn btn-ghost btn-xs text-error"
								onclick={() => openDeleteModal(post)}
							>
								<Trash2 class="h-3 w-3" />
								Delete
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Desktop Table Layout -->
		<div class="hidden md:block card bg-base-100 border border-base-300 overflow-x-auto">
			<table class="table">
				<thead>
					<tr class="bg-base-200">
						<th>Title</th>
						<th>Platform</th>
						<th>Angle</th>
						<th class="text-right">Chars</th>
						<th>Status</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredPosts as post (post.id)}
						{@const config = parseGenerationConfig(post.generation_config)}
						<tr
							class="hover:bg-base-50 cursor-pointer group"
							onclick={() => goto(`/${agencySlug}/content/${clientId}/social/${post.id}`)}
						>
							<td>
								<span class="text-sm font-medium truncate block max-w-xs">{post.title}</span>
							</td>
							<td>
								<span class="badge badge-sm {platformBadgeClass(config.platform || 'unknown')}">{formatPlatform(config.platform || "unknown")}</span>
							</td>
							<td>
								{#if config.angle}
									<span class="badge badge-sm badge-outline">{config.angle}</span>
								{:else}
									<span class="text-base-content/40">&mdash;</span>
								{/if}
							</td>
							<td class="text-right">
								<span class="text-sm">{post.content.length}</span>
							</td>
							<td>
								<span class="badge badge-sm {statusBadgeClass(post.status)}">{post.status}</span>
							</td>
							<td>
								<span class="text-sm text-base-content/70">{formatDate(post.created_at, "short")}</span>
							</td>
							<td>
								{#if post.status === "draft"}
									<button
										type="button"
										class="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
										onclick={(e) => {
											e.stopPropagation();
											openDeleteModal(post);
										}}
									>
										<Trash2 class="h-3 w-3" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deletingItem}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Delete Social Post</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{deletingItem.title}</strong>? This action cannot be undone.
			</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={() => {
						showDeleteModal = false;
						deletingItem = null;
					}}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button class="btn btn-error" onclick={handleDelete} disabled={isDeleting}>
					{#if isDeleting}<span class="loading loading-spinner loading-sm"></span>{/if}
					Delete
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button
				type="button"
				onclick={() => {
					showDeleteModal = false;
					deletingItem = null;
				}}>close</button
			>
		</form>
	</dialog>
{/if}

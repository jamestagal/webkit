<script lang="ts">
	import { page } from "$app/state";
	import { invalidateAll } from "$app/navigation";
	import { updatePageType } from "$lib/api/content.remote";
	import { PAGE_TYPES } from "$lib/api/content.types";
	import {
		ExternalLink,
		FileText,
		Globe,
		Link,
		Image,
		Loader2,
		Tag,
	} from "lucide-svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId ?? "");
	let pageId = $derived(page.params.pageId ?? "");

	let isUpdating = $state(false);
	let selectedType = $state("");

	// Keep selectedType in sync with server data
	$effect(() => {
		selectedType = data.contentPage.page_type;
	});

	function badgeClass(pageType: string): string {
		switch (pageType) {
			case "homepage":
				return "badge-primary";
			case "service":
				return "badge-info";
			case "blog_post":
				return "badge-accent";
			case "contact":
				return "badge-warning";
			case "product":
				return "badge-secondary";
			case "about":
				return "badge-neutral";
			case "unknown":
				return "badge-ghost";
			default:
				return "badge-outline";
		}
	}

	function formatPageType(type: string): string {
		return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	async function handleTypeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newType = target.value;
		if (newType === data.contentPage.page_type) return;

		isUpdating = true;
		try {
			await updatePageType({
				clientId,
				pageId,
				pageType: newType,
			});
			await invalidateAll();
		} catch {
			// Revert on error
			selectedType = data.contentPage.page_type;
		} finally {
			isUpdating = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<div class="text-sm breadcrumbs">
		<ul>
			<li><a href="/{agencySlug}/content">Content</a></li>
			<li><a href="/{agencySlug}/content/{clientId}/pages">{data.client.businessName}</a></li>
			<li><a href="/{agencySlug}/content/{clientId}/pages">Pages</a></li>
			<li>{data.contentPage.title || data.contentPage.url}</li>
		</ul>
	</div>

	<!-- Main Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Overview Card (2/3) -->
		<div class="lg:col-span-2 space-y-6">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title flex items-center gap-2">
						<FileText class="h-5 w-5 text-base-content/60" />
						Overview
					</h2>

					<div class="space-y-4 mt-2">
						<!-- Title -->
						<div>
							<label class="text-sm font-medium text-base-content/60">Title</label>
							<p class="text-lg font-semibold mt-0.5">
								{data.contentPage.title || "Untitled"}
							</p>
						</div>

						<!-- URL -->
						<div>
							<label class="text-sm font-medium text-base-content/60">URL</label>
							<p class="mt-0.5">
								<a
									href={data.contentPage.url}
									target="_blank"
									rel="noopener noreferrer"
									class="link link-primary inline-flex items-center gap-1 break-all"
								>
									{data.contentPage.url}
									<ExternalLink class="h-3 w-3 flex-shrink-0" />
								</a>
							</p>
						</div>

						<!-- Type + Meta -->
						<div class="flex flex-wrap gap-4">
							<div>
								<label class="text-sm font-medium text-base-content/60">Page Type</label>
								<div class="mt-1">
									<span class="badge {badgeClass(data.contentPage.page_type)}">
										{formatPageType(data.contentPage.page_type)}
									</span>
								</div>
							</div>
							<div>
								<label class="text-sm font-medium text-base-content/60">Words</label>
								<p class="mt-1 font-medium">{data.contentPage.word_count.toLocaleString()}</p>
							</div>
							<div>
								<label class="text-sm font-medium text-base-content/60">Reading Time</label>
								<p class="mt-1 font-medium">{data.contentPage.reading_time_minutes} min</p>
							</div>
						</div>

						<!-- Meta Description -->
						{#if data.contentPage.meta_description}
							<div>
								<label class="text-sm font-medium text-base-content/60">Meta Description</label>
								<p class="mt-0.5 text-sm text-base-content/80 bg-base-200 p-3 rounded-lg">
									{data.contentPage.meta_description}
								</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Right Column (1/3) -->
		<div class="space-y-6">
			<!-- Technical Card -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base flex items-center gap-2">
						<Globe class="h-4 w-4 text-base-content/60" />
						Technical
					</h2>

					<div class="space-y-3 mt-2">
						<div class="flex justify-between text-sm">
							<span class="text-base-content/60">HTTP Status</span>
							<span class="font-medium">
								{#if data.contentPage.http_status}
									<span
										class="badge badge-sm"
										class:badge-success={data.contentPage.http_status >= 200 && data.contentPage.http_status < 300}
										class:badge-warning={data.contentPage.http_status >= 300 && data.contentPage.http_status < 400}
										class:badge-error={data.contentPage.http_status >= 400}
									>
										{data.contentPage.http_status}
									</span>
								{:else}
									<span class="text-base-content/40">--</span>
								{/if}
							</span>
						</div>

						<div class="flex justify-between text-sm">
							<span class="text-base-content/60">Canonical URL</span>
							<span class="font-medium text-right max-w-[60%] truncate" title={data.contentPage.canonical_url || ""}>
								{data.contentPage.canonical_url ? "Yes" : "No"}
							</span>
						</div>

						<div class="flex justify-between text-sm">
							<span class="text-base-content/60">Robots Meta</span>
							<span class="font-medium">{data.contentPage.has_robots_meta ? "Yes" : "No"}</span>
						</div>

						<div class="divider my-1"></div>

						<div class="flex justify-between text-sm">
							<span class="text-base-content/60 flex items-center gap-1">
								<Link class="h-3 w-3" /> Internal Links
							</span>
							<span class="font-medium">{data.contentPage.internal_links_count}</span>
						</div>

						<div class="flex justify-between text-sm">
							<span class="text-base-content/60 flex items-center gap-1">
								<ExternalLink class="h-3 w-3" /> External Links
							</span>
							<span class="font-medium">{data.contentPage.external_links_count}</span>
						</div>

						<div class="divider my-1"></div>

						<div class="flex justify-between text-sm">
							<span class="text-base-content/60 flex items-center gap-1">
								<Image class="h-3 w-3" /> Images
							</span>
							<span class="font-medium">{data.contentPage.image_count}</span>
						</div>

						<div class="flex justify-between text-sm">
							<span class="text-base-content/60">Missing Alt</span>
							<span class="font-medium" class:text-warning={data.contentPage.images_missing_alt > 0}>
								{data.contentPage.images_missing_alt}
							</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Classification Card -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h2 class="card-title text-base flex items-center gap-2">
						<Tag class="h-4 w-4 text-base-content/60" />
						Classification
					</h2>

					<div class="space-y-3 mt-2">
						<!-- Current classification -->
						<div class="flex items-center gap-2 flex-wrap">
							<span class="badge {badgeClass(data.contentPage.page_type)}">
								{formatPageType(data.contentPage.page_type)}
							</span>
							<span class="text-sm text-base-content/60">
								{Math.round(data.contentPage.classification_confidence * 100)}% confidence
							</span>
						</div>

						{#if data.contentPage.classification_method}
							<div class="text-sm text-base-content/60">
								Method: <span class="capitalize font-medium">{data.contentPage.classification_method}</span>
							</div>
						{/if}

						<div class="divider my-1"></div>

						<!-- Change type -->
						<div>
							<label class="text-sm font-medium text-base-content/60" for="page-type-select">
								Change Type
							</label>
							<div class="relative mt-1">
								<select
									id="page-type-select"
									class="select select-bordered select-sm w-full"
									bind:value={selectedType}
									onchange={handleTypeChange}
									disabled={isUpdating}
								>
									{#each PAGE_TYPES as pt}
										<option value={pt}>{formatPageType(pt)}</option>
									{/each}
								</select>
								{#if isUpdating}
									<div class="absolute right-8 top-1/2 -translate-y-1/2">
										<Loader2 class="h-4 w-4 animate-spin text-base-content/40" />
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import { page } from "$app/state";
	import { invalidateAll } from "$app/navigation";
	import { FEATURES } from "$lib/config/features";
	import { Brain, ArrowLeft, Loader2, Globe, X, CheckCircle, AlertTriangle, XCircle } from "lucide-svelte";
	import { startCrawl, getCrawlStatus, cancelCrawl } from "$lib/api/content.remote";
	import { createClient } from "$lib/api/clients.remote";
	import type { CrawlJob } from "$lib/api/content.types";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);

	// Form state — pre-select client from URL param if present
	let selectedClientId = $state(page.url.searchParams.get('clientId') || "");
	let sourceUrl = $state("");
	let maxDepth = $state(3);
	let crawlJob = $state<CrawlJob | null>(null);
	let isStarting = $state(false);
	let isCancelling = $state(false);

	// Quick Create client state
	let showQuickCreate = $state(false);
	let qcBusinessName = $state("");
	let qcEmail = $state("");
	let qcWebsite = $state("");
	let isCreatingClient = $state(false);
	let createClientError = $state("");

	// Auto-populate URL from client's saved website
	$effect(() => {
		if (!selectedClientId) return;
		const client = data.clients.find((c: any) => c.id === selectedClientId);
		if (client?.website && !sourceUrl) {
			sourceUrl = client.website;
		}
	});

	async function handleQuickCreateClient() {
		if (!qcBusinessName || !qcEmail) return;
		isCreatingClient = true;
		createClientError = "";
		try {
			const client = await createClient({
				businessName: qcBusinessName,
				email: qcEmail,
				website: qcWebsite || undefined,
			});
			if (!client) throw new Error("Failed to create client.");
			selectedClientId = client.id;
			if (qcWebsite) sourceUrl = qcWebsite;
			showQuickCreate = false;
			qcBusinessName = "";
			qcEmail = "";
			qcWebsite = "";
			await invalidateAll();
		} catch (err: unknown) {
			createClientError = err instanceof Error ? err.message : "Failed to create client.";
		} finally {
			isCreatingClient = false;
		}
	}

	// Derived terminal status check
	let isTerminal = $derived(
		crawlJob?.status === "complete" ||
			crawlJob?.status === "failed" ||
			crawlJob?.status === "cancelled"
	);

	// Polling effect
	$effect(() => {
		if (!crawlJob) return;
		const status = crawlJob.status;
		if (status === "complete" || status === "failed" || status === "cancelled") return;

		const interval = setInterval(async () => {
			try {
				const updated = await getCrawlStatus(crawlJob!.id).run();
				crawlJob = updated;
			} catch (e) {
				console.error("Poll failed:", e);
			}
		}, 2000);

		return () => clearInterval(interval);
	});

	function statusBadgeClass(status: string): string {
		switch (status) {
			case "pending":
				return "badge-ghost";
			case "crawling":
				return "badge-info";
			case "embedding":
				return "badge-warning";
			case "complete":
				return "badge-success";
			case "failed":
				return "badge-error";
			case "cancelled":
				return "badge-ghost";
			default:
				return "badge-ghost";
		}
	}

	async function handleStartCrawl() {
		if (!selectedClientId || !sourceUrl) return;

		isStarting = true;
		try {
			const result = await startCrawl({
				clientId: selectedClientId,
				sourceUrl,
				maxDepth,
			});
			// Fetch full status after starting
			crawlJob = await getCrawlStatus(result.id).run();
		} catch (e) {
			console.error("Failed to start crawl:", e);
		} finally {
			isStarting = false;
		}
	}

	async function handleCancelCrawl() {
		if (!crawlJob) return;

		isCancelling = true;
		try {
			await cancelCrawl(crawlJob.id);
			const updated = await getCrawlStatus(crawlJob.id).run();
			crawlJob = updated;
		} catch (e) {
			console.error("Failed to cancel crawl:", e);
		} finally {
			isCancelling = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<div class="text-sm breadcrumbs">
		<ul>
			<li><a href="/{agencySlug}/content">Content</a></li>
			<li>Crawl Website</li>
		</ul>
	</div>

	<!-- Page Header -->
	<div class="flex items-center gap-4">
		<a href="/{agencySlug}/content" class="btn btn-ghost btn-sm btn-circle">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<Brain class="h-7 w-7" style="color: {FEATURES.content.color}" />
				Crawl Website
			</h1>
			<p class="text-base-content/70 mt-1">Extract page content for AI-powered copy generation, social posts, and brand voice analysis</p>
		</div>
	</div>

	{#if !crawlJob}
		<!-- Crawl Form -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleStartCrawl();
					}}
				>
					<div class="space-y-4">
						<!-- Client Selection -->
						<div class="form-control">
							<label class="label" for="client-select">
								<span class="label-text">Client <span class="text-error">*</span></span>
							</label>
							<select
								id="client-select"
								class="select select-bordered w-full"
								bind:value={selectedClientId}
								required
							>
								<option value="" disabled>Select a client</option>
								{#each data.clients as client (client.id)}
									<option value={client.id}>{client.businessName}</option>
								{/each}
							</select>
							<!-- Quick Create toggle -->
							<div class="mt-2">
								{#if !showQuickCreate}
									<button
										type="button"
										class="btn btn-ghost btn-xs text-primary"
										onclick={() => (showQuickCreate = true)}
									>
										Client not listed? Create one →
									</button>
								{:else}
									<div class="card bg-base-200 border border-base-300 mt-2">
										<div class="card-body p-4 space-y-3">
											<div class="flex items-center justify-between">
												<span class="font-medium text-sm">Quick Create Client</span>
												<button
													type="button"
													class="btn btn-ghost btn-xs btn-circle"
													onclick={() => (showQuickCreate = false)}
												>
													<X class="h-3 w-3" />
												</button>
											</div>

											{#if createClientError}
												<div class="alert alert-error text-sm py-2">
													<span>{createClientError}</span>
												</div>
											{/if}

											<input
												type="text"
												class="input input-bordered input-sm w-full"
												placeholder="Business name *"
												bind:value={qcBusinessName}
												disabled={isCreatingClient}
											/>
											<input
												type="email"
												class="input input-bordered input-sm w-full"
												placeholder="Email *"
												bind:value={qcEmail}
												disabled={isCreatingClient}
											/>
											<input
												type="url"
												class="input input-bordered input-sm w-full"
												placeholder="Website URL"
												bind:value={qcWebsite}
												disabled={isCreatingClient}
											/>
											<button
												type="button"
												class="btn btn-primary btn-sm w-full"
												onclick={handleQuickCreateClient}
												disabled={isCreatingClient || !qcBusinessName || !qcEmail}
											>
												{#if isCreatingClient}
													<span class="loading loading-spinner loading-sm"></span>
												{/if}
												Create & Select
											</button>
										</div>
									</div>
								{/if}
							</div>
						</div>

						<!-- Website URL -->
						<div class="form-control">
							<label class="label" for="source-url">
								<span class="label-text">Website URL <span class="text-error">*</span></span>
							</label>
							<input
								type="url"
								id="source-url"
								class="input input-bordered w-full"
								placeholder="https://example.com"
								bind:value={sourceUrl}
								required
							/>
						</div>

						<!-- Max Depth -->
						<div class="form-control">
							<label class="label" for="max-depth">
								<span class="label-text">Max Depth</span>
							</label>
							<select
								id="max-depth"
								class="select select-bordered w-full max-w-xs"
								bind:value={maxDepth}
							>
								{#each [1, 2, 3, 4, 5] as depth}
									<option value={depth}>{depth} {depth === 1 ? "level" : "levels"}</option>
								{/each}
							</select>
							<label class="label">
								<span class="label-text-alt text-base-content/50">
									How many link levels deep to crawl from the homepage
								</span>
							</label>
						</div>

						<!-- Submit -->
						<div class="pt-2">
							<button
								type="submit"
								class="btn btn-primary"
								disabled={isStarting || !selectedClientId || !sourceUrl}
							>
								{#if isStarting}
									<Loader2 class="h-4 w-4 animate-spin" />
									Starting...
								{:else}
									<Globe class="h-4 w-4" />
									Start Crawl
								{/if}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	{:else}
		<!-- Crawl Progress -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body space-y-4">
				<!-- Status Header -->
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold">Crawl Progress</h2>
					<span class="badge {statusBadgeClass(crawlJob.status)}">
						{#if crawlJob.status === "crawling"}
							<span class="loading loading-spinner loading-xs mr-1"></span>
						{/if}
						{crawlJob.status}
					</span>
				</div>

				<!-- Stats -->
				<div class="grid grid-cols-3 gap-4">
					<div class="stat bg-base-200 rounded-lg p-4">
						<div class="stat-title text-xs">Pages Discovered</div>
						<div class="stat-value text-xl">{crawlJob.pages_discovered}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg p-4">
						<div class="stat-title text-xs">Pages Processed</div>
						<div class="stat-value text-xl">{crawlJob.pages_processed}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg p-4">
						<div class="stat-title text-xs">Pages Changed</div>
						<div class="stat-value text-xl">{crawlJob.pages_changed}</div>
					</div>
				</div>

				<!-- Progress Bar -->
				{#if crawlJob.pages_discovered > 0}
					<progress
						class="progress progress-primary w-full"
						value={crawlJob.pages_processed}
						max={crawlJob.pages_discovered}
					></progress>
				{:else if !isTerminal}
					<progress class="progress progress-primary w-full"></progress>
				{/if}

				<!-- Terminal States -->
				{#if crawlJob.status === "complete"}
					<div class="alert alert-success">
						<CheckCircle class="h-5 w-5" />
						<div>
							<h3 class="font-bold">Crawl Complete</h3>
							<p class="text-sm">
								Successfully processed {crawlJob.pages_processed} pages.
							</p>
						</div>
						<a
							href="/{agencySlug}/content/{selectedClientId}/pages"
							class="btn btn-sm btn-outline"
						>
							View Pages
						</a>
					</div>
				{:else if crawlJob.status === "failed"}
					<div class="alert alert-error">
						<XCircle class="h-5 w-5" />
						<div>
							<h3 class="font-bold">Crawl Failed</h3>
							<p class="text-sm">{crawlJob.error_message || "An unknown error occurred."}</p>
						</div>
					</div>
				{:else if crawlJob.status === "cancelled"}
					<div class="alert alert-warning">
						<AlertTriangle class="h-5 w-5" />
						<div>
							<h3 class="font-bold">Crawl Cancelled</h3>
							<p class="text-sm">The crawl was cancelled before completion.</p>
						</div>
					</div>
				{:else}
					<!-- Cancel button for running crawls -->
					<div class="flex justify-end">
						<button
							type="button"
							class="btn btn-outline btn-error btn-sm"
							onclick={handleCancelCrawl}
							disabled={isCancelling}
						>
							{#if isCancelling}
								<Loader2 class="h-4 w-4 animate-spin" />
								Cancelling...
							{:else}
								<X class="h-4 w-4" />
								Cancel Crawl
							{/if}
						</button>
					</div>
				{/if}

				<!-- Back / Start New after terminal state -->
				{#if isTerminal}
					<div class="flex gap-2 pt-2">
						<a href="/{agencySlug}/content" class="btn btn-ghost btn-sm">
							Back to Dashboard
						</a>
						<button
							type="button"
							class="btn btn-outline btn-sm"
							onclick={() => {
								crawlJob = null;
								sourceUrl = "";
								selectedClientId = "";
							}}
						>
							Start New Crawl
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

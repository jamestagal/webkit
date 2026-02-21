<script lang="ts">
	import { page } from "$app/state";
	import {
		Globe,
		FileText,
		Search,
		Brain,
		Share2,
		CheckCircle2,
		Circle,
		AlertCircle,
		X,
		Sparkles,
		Clock,
		ClipboardList,
	} from "lucide-svelte";
	import { formatRelativeTime } from "$lib/utils/formatting";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId);
	let overview = $derived(data.overview);

	// Wizard dismiss state (localStorage)
	let wizardDismissed = $state(false);

	$effect(() => {
		if (typeof window !== "undefined") {
			wizardDismissed =
				localStorage.getItem(`wizard_dismissed_${clientId}`) === "true";
		}
	});

	function dismissWizard() {
		wizardDismissed = true;
		if (typeof window !== "undefined") {
			localStorage.setItem(`wizard_dismissed_${clientId}`, "true");
		}
	}

	// Wizard step detection
	let wizardSteps = $derived(
		overview
			? [
					{
						label: "Crawl website",
						done: overview.crawl.total_pages > 0,
						href: `/${agencySlug}/content/import`,
					},
					{
						label: "Brand profile",
						done: overview.brand.has_profile,
						href: `/${agencySlug}/content/${clientId}/brand`,
					},
					{
						label: "SEO audit",
						done: overview.seo.score > 0,
						href: `/${agencySlug}/content/${clientId}/audit`,
					},
					{
						label: "Generate copy",
						done: overview.copy.total > 0,
						href: `/${agencySlug}/content/${clientId}/copy/generate`,
					},
				]
			: [],
	);

	let allStepsDone = $derived(wizardSteps.every((s) => s.done));

	// Activity icons
	function activityIcon(type: string) {
		switch (type) {
			case "crawl":
				return Globe;
			case "copy":
				return FileText;
			case "audit":
				return Search;
			case "brand":
				return Brain;
			case "social":
				return Share2;
			default:
				return FileText;
		}
	}

	// Score color
	function scoreColor(score: number): string {
		if (score >= 80) return "text-success";
		if (score >= 50) return "text-warning";
		return "text-error";
	}

	// Crawl status badge
	function statusBadge(status: string): string {
		switch (status) {
			case "completed":
				return "badge-success";
			case "running":
				return "badge-info";
			case "failed":
				return "badge-error";
			default:
				return "badge-ghost";
		}
	}
</script>

{#if overview}
	<div class="space-y-6">
		<!-- Post-crawl wizard banner -->
		{#if !allStepsDone && !wizardDismissed}
			<div class="alert shadow-lg bg-base-100 border border-base-300 relative">
				<div class="flex items-start gap-3 w-full">
					<Sparkles class="h-5 w-5 text-primary shrink-0 mt-0.5" />
					<div class="flex-1">
						<h3 class="font-semibold text-sm">Get started with content intelligence</h3>
						<p class="text-xs text-base-content/60 mt-0.5">
							Complete these steps to unlock AI-powered content generation.
						</p>
						<div class="flex flex-wrap gap-4 mt-3">
							{#each wizardSteps as step}
								<a
									href={step.href}
									class="flex items-center gap-2 text-sm hover:underline {step.done ? 'opacity-50' : ''}"
								>
									{#if step.done}
										<CheckCircle2 class="h-4 w-4 text-success" />
									{:else}
										<Circle class="h-4 w-4 text-base-content/30" />
									{/if}
									<span class:line-through={step.done}>{step.label}</span>
								</a>
							{/each}
						</div>
					</div>
					<button
						type="button"
						class="btn btn-ghost btn-xs btn-circle absolute top-2 right-2"
						onclick={dismissWizard}
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			</div>
		{/if}

		<!-- Feature status cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<!-- Pages card -->
			<a
				href="/{agencySlug}/content/{clientId}/pages"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-5">
					<div class="flex items-center justify-between mb-3">
						<div class="flex items-center gap-2">
							<Globe class="h-4 w-4 text-primary" />
							<span class="text-sm font-medium">Pages</span>
						</div>
						<span class="badge badge-sm {statusBadge(overview.crawl.status)}">
							{overview.crawl.status}
						</span>
					</div>
					<div class="stat p-0">
						<div class="stat-value text-2xl">{overview.crawl.total_pages}</div>
						<div class="stat-desc">
							{#if overview.crawl.last_crawled_at}
								Crawled {formatRelativeTime(overview.crawl.last_crawled_at)}
							{:else}
								Not crawled yet
							{/if}
						</div>
					</div>
				</div>
			</a>

			<!-- Brand card -->
			<a
				href="/{agencySlug}/content/{clientId}/brand"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-5">
					<div class="flex items-center justify-between mb-3">
						<div class="flex items-center gap-2">
							<Brain class="h-4 w-4 text-secondary" />
							<span class="text-sm font-medium">Brand Profile</span>
						</div>
						{#if overview.brand.has_profile}
							<span class="badge badge-sm badge-success">Active</span>
						{:else}
							<span class="badge badge-sm badge-ghost">Not set</span>
						{/if}
					</div>
					<div class="stat p-0">
						<div class="stat-value text-2xl">
							{#if overview.brand.has_profile}
								<CheckCircle2 class="h-6 w-6 text-success inline" />
							{:else}
								<Circle class="h-6 w-6 text-base-content/20 inline" />
							{/if}
						</div>
						<div class="stat-desc">
							{#if overview.brand.source_type}
								Source: {overview.brand.source_type}
							{:else}
								Set up brand voice and tone
							{/if}
						</div>
					</div>
				</div>
			</a>

			<!-- Audit card -->
			<a
				href="/{agencySlug}/content/{clientId}/audit"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-5">
					<div class="flex items-center justify-between mb-3">
						<div class="flex items-center gap-2">
							<Search class="h-4 w-4 text-accent" />
							<span class="text-sm font-medium">SEO Audit</span>
						</div>
					</div>
					<div class="stat p-0">
						{#if overview.seo.score > 0}
							<div class="stat-value text-2xl {scoreColor(overview.seo.score)}">
								{overview.seo.score}
							</div>
						{:else}
							<div class="stat-value text-2xl text-base-content/20">--</div>
						{/if}
						<div class="stat-desc">
							<div class="flex gap-2 mt-1">
								{#if overview.seo.critical > 0}
									<span class="badge badge-error badge-xs">{overview.seo.critical} critical</span>
								{/if}
								{#if overview.seo.warnings > 0}
									<span class="badge badge-warning badge-xs">{overview.seo.warnings} warnings</span>
								{/if}
								{#if overview.seo.critical === 0 && overview.seo.warnings === 0 && overview.seo.score > 0}
									<span class="text-success">No issues found</span>
								{/if}
								{#if overview.seo.score === 0}
									<span>Run an audit to get started</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</a>

			<!-- Copy card -->
			<a
				href="/{agencySlug}/content/{clientId}/copy"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-5">
					<div class="flex items-center justify-between mb-3">
						<div class="flex items-center gap-2">
							<FileText class="h-4 w-4 text-info" />
							<span class="text-sm font-medium">Copy</span>
						</div>
					</div>
					<div class="stat p-0">
						<div class="stat-value text-2xl">{overview.copy.total}</div>
						<div class="stat-desc">
							{#if overview.copy.total > 0}
								{overview.copy.drafts} drafts, {overview.copy.finals} final
							{:else}
								No copy generated yet
							{/if}
						</div>
					</div>
				</div>
			</a>

			<!-- Social card -->
			<a
				href="/{agencySlug}/content/{clientId}/social"
				class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
			>
				<div class="card-body p-5">
					<div class="flex items-center justify-between mb-3">
						<div class="flex items-center gap-2">
							<Share2 class="h-4 w-4 text-primary" />
							<span class="text-sm font-medium">Social</span>
						</div>
					</div>
					<div class="stat p-0">
						<div class="stat-value text-2xl">
							{overview.copy.by_type?.["social_post"] ?? 0}
						</div>
						<div class="stat-desc">Social posts generated</div>
					</div>
				</div>
			</a>
		</div>

		<!-- Bottom row: AI Context Sources + Recent Activity -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<!-- AI Context Sources -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-5">
					<div class="flex items-center gap-2 mb-4">
						<Sparkles class="h-4 w-4 text-primary" />
						<h3 class="font-semibold text-sm">AI Context Sources</h3>
					</div>
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								{#if overview.crawl.total_pages > 0}
									<CheckCircle2 class="h-4 w-4 text-success" />
								{:else}
									<Circle class="h-4 w-4 text-base-content/20" />
								{/if}
								<span class="text-sm">Crawled pages</span>
							</div>
							{#if overview.crawl.total_pages > 0}
								<span class="text-xs text-base-content/50">{overview.crawl.total_pages} pages</span>
							{:else}
								<a
									href="/{agencySlug}/content/import"
									class="text-xs text-primary hover:underline"
								>
									Import
								</a>
							{/if}
						</div>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								{#if overview.brand.has_profile}
									<CheckCircle2 class="h-4 w-4 text-success" />
								{:else}
									<Circle class="h-4 w-4 text-base-content/20" />
								{/if}
								<span class="text-sm">Brand profile</span>
							</div>
							{#if !overview.brand.has_profile}
								<a
									href="/{agencySlug}/content/{clientId}/brand"
									class="text-xs text-primary hover:underline"
								>
									Set up
								</a>
							{/if}
						</div>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								{#if overview.seo.score > 0}
									<CheckCircle2 class="h-4 w-4 text-success" />
								{:else}
									<Circle class="h-4 w-4 text-base-content/20" />
								{/if}
								<span class="text-sm">SEO audit</span>
							</div>
							{#if overview.seo.score === 0}
								<a
									href="/{agencySlug}/content/{clientId}/audit"
									class="text-xs text-primary hover:underline"
								>
									Run audit
								</a>
							{/if}
						</div>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								{#if overview.questionnaire.completed}
									<CheckCircle2 class="h-4 w-4 text-success" />
								{:else}
									<Circle class="h-4 w-4 text-base-content/20" />
								{/if}
								<span class="text-sm">Questionnaire</span>
							</div>
							{#if !overview.questionnaire.completed}
								<span class="text-xs text-base-content/40">Pending</span>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Recent Activity -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-5">
					<div class="flex items-center gap-2 mb-4">
						<Clock class="h-4 w-4 text-primary" />
						<h3 class="font-semibold text-sm">Recent Activity</h3>
					</div>
					{#if overview.activity.length > 0}
						<div class="space-y-3">
							{#each overview.activity as item}
								{@const Icon = activityIcon(item.type)}
								<div class="flex items-start gap-3">
									<div class="flex h-7 w-7 items-center justify-center rounded-full bg-base-200 shrink-0 mt-0.5">
										<Icon class="h-3.5 w-3.5 text-base-content/50" />
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm truncate">{item.title}</p>
										<p class="text-xs text-base-content/50">
											{formatRelativeTime(item.created_at)}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center py-6 text-base-content/40">
							<ClipboardList class="h-8 w-8 mb-2" />
							<p class="text-sm">No activity yet</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Error state -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body items-center text-center py-12">
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4">
				<AlertCircle class="h-8 w-8 text-base-content/30" />
			</div>
			<h3 class="text-lg font-semibold">Unable to load overview data</h3>
			<p class="text-base-content/60 max-w-sm">
				The content service may be unavailable. Please try again later.
			</p>
			<a
				href="/{agencySlug}/content/{clientId}"
				class="btn btn-outline mt-4"
			>
				Retry
			</a>
		</div>
	</div>
{/if}

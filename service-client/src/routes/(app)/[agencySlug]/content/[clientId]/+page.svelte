<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		Search,
		PenTool,
		ExternalLink,
		Zap,
		Share2,
		AlertCircle
	} from 'lucide-svelte';
	import type { PageData } from './$types';
	import ScoreDonut from '$lib/components/audit/ScoreDonut.svelte';
	import ProgressFlow from '$lib/components/content-intelligence/ProgressFlow.svelte';
	import LaneHeader from '$lib/components/content-intelligence/LaneHeader.svelte';
	import InfoBanner from '$lib/components/content-intelligence/InfoBanner.svelte';
	import ModuleCard from '$lib/components/content-intelligence/ModuleCard.svelte';
	import SharedContextBar from '$lib/components/content-intelligence/SharedContextBar.svelte';

	let { data }: { data: PageData } = $props();

	let agencySlug = $derived(page.params.agencySlug);
	let clientId = $derived(page.params.clientId!);
	let overview = $derived(data.overview);
	let analysisModules = $derived(data.analysisModules);
	let contentModules = $derived(data.contentModules);
	let progressSteps = $derived(data.progressSteps);

	let expandedModule = $state<string | null>(null);

	function toggleModule(id: string) {
		expandedModule = expandedModule === id ? null : id;
	}

	let analysisComplete = $derived(
		analysisModules.length > 0 && analysisModules.every((m) => m.status === 'complete')
	);

	function scoreColor(score: number): string {
		if (score >= 70) return 'text-success';
		if (score >= 40) return 'text-warning';
		return 'text-error';
	}
</script>

{#if overview}
	<div class="space-y-6">
		<!-- Top score bar -->
		<div
			class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-base-100 rounded-2xl border border-base-200 p-5 shadow-sm"
		>
			<div class="flex items-center gap-4">
				<ScoreDonut score={overview.seo.score || null} size="sm" />
				<div>
					<div class="text-xs text-base-content/50 uppercase tracking-wider">
						Overall Score
					</div>
					<div class="text-2xl font-bold {scoreColor(overview.seo.score)}">
						{overview.seo.score || '\u2014'}
					</div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<a
					href="/{agencySlug}/content/{clientId}/audit?share=1"
					class="btn btn-success btn-sm gap-2"
				>
					<Share2 size={14} />
					Share Report
				</a>
				<a
					href="/{agencySlug}/content/{clientId}/audit"
					class="btn btn-warning btn-sm gap-2"
				>
					<Zap size={14} />
					Re-run Audit
				</a>
			</div>
		</div>

		<!-- Progress strip -->
		<div class="bg-base-100 rounded-lg border border-base-200/50 px-4 py-3">
			<ProgressFlow steps={progressSteps} />
		</div>

		<!-- Two-lane grid -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Analysis Lane -->
			<div class="bg-base-100 rounded-2xl border border-base-200 p-5 shadow-sm">
				<LaneHeader
					icon={Search}
					title="Analysis"
					subtitle="Understand the client's current position"
					color="#a855f7"
					actionLabel="View Report"
					actionIcon={ExternalLink}
					onaction={() => goto(`/${agencySlug}/content/${clientId}/audit`)}
				>
					{#snippet badge()}
						{#if analysisComplete}
							<span
								class="text-[10px] font-bold uppercase tracking-wider bg-success/15 text-success px-1.5 py-0.5 rounded-full"
							>
								All complete
							</span>
						{/if}
					{/snippet}
				</LaneHeader>

				<InfoBanner
					variant="purple"
					label="Feeds into: Shareable Report, Proposals, Content Generation"
				/>

				<div class="space-y-3">
					{#each analysisModules as mod (mod.id)}
						<ModuleCard
							module={mod}
							expanded={expandedModule === mod.id}
							ontoggle={toggleModule}
						/>
					{/each}
				</div>
			</div>

			<!-- Content Lane -->
			<div class="bg-base-100 rounded-2xl border border-base-200 p-5 shadow-sm">
				<LaneHeader
					icon={PenTool}
					title="Content"
					subtitle="Produce deliverables for the client"
					color="#ec4899"
					actionLabel="New Content Sprint"
					actionIcon={Zap}
					disabled={true}
				/>

				{#if analysisComplete}
					<InfoBanner
						variant="emerald"
						label="All analysis data available — ready to generate content"
					/>
				{:else}
					<InfoBanner
						variant="amber"
						label="Run Complete Audit first to unlock full content generation"
					/>
				{/if}

				<div class="space-y-3">
					{#each contentModules as mod (mod.id)}
						<ModuleCard
							module={mod}
							expanded={expandedModule === mod.id}
							ontoggle={toggleModule}
						/>
					{/each}
				</div>

				<!-- Content Sprint History placeholder -->
				<div class="mt-4 border border-dashed border-base-200 rounded-xl p-4">
					<div
						class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-2"
					>
						Content Sprint History
					</div>
					<div class="text-sm text-base-content/50 text-center py-3">
						No content sprints yet.
						<br />
						<span class="text-xs text-base-content/35">
							Run your first sprint to see article history here.
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Shared Context Bar -->
		<SharedContextBar
			brandActive={overview.brand.has_profile}
			pagesActive={overview.crawl.total_pages > 0}
			keywordsActive={overview.seo.score > 0}
			gbpActive={false}
		/>
	</div>
{:else}
	<!-- Error state -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body items-center text-center py-12">
			<div
				class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4"
			>
				<AlertCircle class="h-8 w-8 text-base-content/30" />
			</div>
			<h3 class="text-lg font-semibold">Unable to load overview data</h3>
			<p class="text-base-content/60 max-w-sm">
				The content service may be unavailable. Please try again later.
			</p>
			<a href="/{agencySlug}/content/{clientId}" class="btn btn-outline mt-4">
				Retry
			</a>
		</div>
	</div>
{/if}

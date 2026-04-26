<script lang="ts">
	import { Layers, FileText, Scale } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let agencySlug = $derived(data.agency.slug);

	const cards = $derived([
		{
			label: 'Scope Templates',
			description: 'Reusable work item blocks for quotation sections',
			count: data.scopeCount,
			icon: Layers,
			href: `/${agencySlug}/settings/quotations/scopes`
		},
		{
			label: 'Terms Templates',
			description: 'Reusable terms and conditions blocks',
			count: data.termsCount,
			icon: Scale,
			href: `/${agencySlug}/settings/quotations/terms`
		},
		{
			label: 'Quotation Templates',
			description: 'Parent templates that bundle scope sections and terms',
			count: data.templateCount,
			icon: FileText,
			href: `/${agencySlug}/settings/quotations/templates`
		}
	]);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Quotation Settings</h1>
		<p class="text-base-content/70 mt-1">
			Manage your quotation templates, scope of work blocks, and terms
		</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each cards as card (card.href)}
			<a
				href={card.href}
				class="card bg-base-100 hover:bg-base-200 transition-colors border border-base-300"
			>
				<div class="card-body">
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500"
						>
							<card.icon class="h-5 w-5" />
						</div>
						<div class="flex-1">
							<h2 class="card-title text-base">{card.label}</h2>
							<p class="text-sm text-base-content/60">{card.description}</p>
						</div>
						<div class="badge badge-ghost">{card.count}</div>
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>

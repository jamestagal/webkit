<script lang="ts">
	/**
	 * Renders nothing for <80% usage, an amber banner at 80-99%, and a red
	 * banner at 100%. `upgradeHref` is the "Upgrade plan →" link target.
	 *
	 * Reads the same threshold semantics the Go service uses via the shared
	 * isAtWarning / isAtLimit helpers so frontend + backend stay aligned.
	 */
	import { isAtWarning, isAtLimit } from '$lib/server/usage';

	interface Props {
		feature: string;
		current: number;
		limit: number;
		upgradeHref?: string;
	}

	let { feature, current, limit, upgradeHref = './billing' }: Props = $props();

	const FEATURE_LABELS: Record<string, string> = {
		seo_audit: 'SEO audits',
		crawl: 'website crawls',
		ai_generation: 'AI generations',
		pdf_export: 'PDF exports',
		social_profile: 'social profiles',
		form: 'forms'
	};

	let label = $derived(FEATURE_LABELS[feature] ?? feature);
	let warning = $derived(isAtWarning(current, limit));
	let exceeded = $derived(isAtLimit(current, limit));
</script>

{#if exceeded}
	<div
		class="rounded-md bg-error/10 border border-error/30 px-4 py-3 text-sm text-error flex items-center justify-between gap-4"
		role="alert"
	>
		<span>
			You've used all <strong>{limit} {label}</strong> for this month.
		</span>
		<a href={upgradeHref} class="font-medium underline whitespace-nowrap"
			>Upgrade plan →</a
		>
	</div>
{:else if warning}
	<div
		class="rounded-md bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning flex items-center justify-between gap-4"
	>
		<span>
			You've used <strong>{current} of {limit} {label}</strong> this month.
		</span>
		<a href={upgradeHref} class="font-medium underline whitespace-nowrap"
			>Upgrade for more →</a
		>
	</div>
{/if}

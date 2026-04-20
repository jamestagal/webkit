<script lang="ts">
	/**
	 * ProposalDocument — CSS custom-property wrapper for proposal rendering.
	 *
	 * Phase 2.1a stub: injects all ProposalEffectiveBranding values as
	 * `--brand-*` CSS custom properties on a zero-layout wrapper. Children
	 * (the existing article markup) currently still read `{branding.X}`
	 * directly; step 2.1c will translate those to `var(--brand-X)` so the
	 * CSS-var plumbing becomes the single source of truth.
	 *
	 * Wrapper uses `display: contents` so the extra element contributes
	 * nothing to layout while still inheriting custom properties down to
	 * every descendant via the CSS cascade.
	 *
	 * Naming convention is pinned in
	 * `.claude/plans/phase2-1-architecture-revision.md`.
	 */
	import type { Snippet } from 'svelte';
	import type { ProposalEffectiveBranding } from '$lib/server/document-branding';

	let {
		branding,
		children
	}: {
		branding: ProposalEffectiveBranding;
		children?: Snippet;
	} = $props();
</script>

<div
	class="branded-document"
	style:--brand-primary={branding.primaryColor}
	style:--brand-secondary={branding.secondaryColor}
	style:--brand-accent={branding.accentColor}
	style:--brand-accent-gradient={branding.accentGradient}
	style:--brand-cover-bg={branding.coverBgColor}
	style:--brand-cover-text={branding.coverTextColor}
	style:--brand-section-heading={branding.sectionHeadingColor}
	style:--brand-cta-bg={branding.ctaButtonColor}
	style:--brand-cta-text={branding.ctaButtonTextColor}
	style:--brand-footer-bg={branding.footerBgColor}
>
	{@render children?.()}
</div>

<style>
	.branded-document {
		display: contents;
	}
</style>

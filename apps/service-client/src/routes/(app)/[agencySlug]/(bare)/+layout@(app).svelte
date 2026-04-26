<script lang="ts">
	/**
	 * Bare layout for the branding-preview iframe.
	 *
	 * Uses the `@(app)` suffix to skip `[agencySlug]/+layout.svelte` (the
	 * full sidebar + top-nav + agency-switcher shell) while still rendering
	 * inside `(app)/+layout.svelte` (and the root layout above it). Page
	 * loads here are exactly what they'd be in the rest of `[agencySlug]`:
	 * the parent `[agencySlug]/+layout.server.ts` still fires, enforcing
	 * the membership check that agencies can only preview their own
	 * branding. `@` syntax only affects LAYOUT rendering, never DATA
	 * loading — no auth bypass.
	 *
	 * Root document chrome (fonts, error boundaries, theme provider) is
	 * preserved by the ancestor `(app)` + root layouts. Settings chrome
	 * (sidebar / nav / breadcrumbs) is what this bare layout strips.
	 */
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}

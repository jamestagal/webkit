<script lang="ts">
	import '$lib/styles/report-design-system.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	let agency = $derived(data.agency);

	// Inline agency-colour CSS vars — safer than <style> blocks (Svelte scope-hashes
	// :root selectors unless wrapped in :global, inline styles are unscoped).
	let brandStyle = $derived(
		[
			`--agency-primary: ${agency.primaryColor || '#155eef'}`,
			`--agency-secondary: ${agency.secondaryColor || '#f2f4f7'}`,
			`--agency-accent: ${agency.accentColor || '#004eeb'}`,
			agency.accentGradient ? `--agency-accent-gradient: ${agency.accentGradient}` : null,
		]
			.filter(Boolean)
			.join('; '),
	);
</script>

<div class="report-scope min-h-screen" data-theme="light" style={brandStyle}>
	{@render children()}
</div>

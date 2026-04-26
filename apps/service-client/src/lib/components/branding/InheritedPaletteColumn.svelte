<script lang="ts">
	import ColorOverrideRow from './ColorOverrideRow.svelte';

	type Props = {
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
	};

	let { primaryColor, secondaryColor, accentColor }: Props = $props();

	// readonly mode disables clicks/edits — onChange is required by the prop
	// type but never invoked.
	function noop(_v: string) {}
</script>

<aside class="space-y-3">
	<header class="space-y-1">
		<h3 class="text-sm font-semibold">Global Palette</h3>
		<p class="text-xs text-base-content/60">
			Inherited from Agency Defaults — read-only here
		</p>
	</header>
	<div class="space-y-2">
		<ColorOverrideRow label="Primary" value={primaryColor} onChange={noop} readonly />
		<ColorOverrideRow label="Secondary" value={secondaryColor} onChange={noop} readonly />
		<ColorOverrideRow label="Accent" value={accentColor} onChange={noop} readonly />
	</div>
</aside>

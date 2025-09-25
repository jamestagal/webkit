<script>
	import { page } from "$app/state";
	import { slide } from "svelte/transition";
	let { link } = $props();

	let currentUrl = $derived(page.url.pathname);
	let isOpen = $derived(link.isOpen || currentUrl.startsWith(link.href));

	const {
		label,
		href,
		disabled = false,
		icon: Icon,
		chevron = false,
		external = false,
		sublinks = [],
	} = link;

	let iconSize = 16;
	let iconStrokeWidth = 2;

	let linkPadding = 8;
</script>

<div class="flex w-full flex-col">
	{#if href}
		<a
			{href}
			target={external ? "_blank" : ""}
			class="flex flex-row items-center justify-between gap-2 rounded-xl p-2 transition-all duration-100"
			class:hover:bg-primary-3={!isOpen}
			class:shadow-lg={isOpen}
			class:bg-secondary={isOpen}
			class:text-primary={isOpen}
			class:opacity-50={disabled}
			class:pointer-events-none={disabled}
		>
			<div class="flex flex-row items-center gap-2">
				{#if Icon && typeof Icon === "function"}
					<Icon size={iconSize} strokeWidth={iconStrokeWidth} />
				{/if}
				<span class="text-sm font-semibold">{label || "Unlabeled Link"}</span>
			</div>
			{#if chevron && !external}
				{@render chevronSnippet(isOpen)}
			{/if}
			{#if external}
				{@render externalIconSnippet()}
			{/if}
		</a>
	{:else}
		{@render seperatorSnippet(label, Icon)}
	{/if}

	{#if sublinks && sublinks.length > 0 && isOpen}
		<div class="border-primary-3 my-2 ml-4 flex flex-col border-l-1 pl-2" transition:slide>
			{#each sublinks as sublink}
				{#if sublink.href}
					<a
						href={sublink.href}
						class="hover:bg-primary-1 rounded-xl p-2 text-sm font-medium"
						class:text-primary-accent={currentUrl.startsWith(sublink.href)}
					>
						{sublink.label || "Unlabeled Sublink"}
					</a>
				{:else}
					{@render seperatorSnippet(sublink.label, sublink.icon)}
				{/if}
			{/each}
		</div>
	{/if}
</div>

{#snippet seperatorSnippet(name, Icon)}
	<div class="flex flex-row items-center gap-1 p-2">
		{#if Icon && typeof Icon === "function"}
			<Icon size={iconSize} strokeWidth={iconStrokeWidth} />
		{/if}
		<span class="text-secondary-4 text-xxs uppercase">{name || "Seperator"}</span>
	</div>
{/snippet}

{#snippet chevronSnippet(isOpen)}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={iconSize}
		height={iconSize}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={iconStrokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
		class={`transition-all duration-200 ${isOpen && sublinks.length > 0 ? "rotate-90" : ""}`}
	>
		<path d="m9 18 6-6-6-6" />
	</svg>
{/snippet}

{#snippet externalIconSnippet()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={iconSize}
		height={iconSize}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={iconStrokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
		<polyline points="15 3 21 3 21 9" />
		<line x1="10" y1="14" x2="21" y2="3" />
	</svg>
{/snippet}

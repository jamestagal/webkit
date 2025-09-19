<script lang="ts">
	import LoadingIcon from "$lib/assets/icons/LoadingIcon.svelte";
	import type { Snippet } from "svelte";

	type Props = {
		onclick?: () => void;
		type?: "button" | "submit" | "reset";
		variant?: "primary" | "secondary";
		form?: string;
		formaction?: string;
		href?: string;
		children: Snippet;
		icon?: Snippet;
		class?: string;
	};

	let {
		onclick,
		type = "submit",
		variant = "primary",
		form,
		formaction,
		href,
		children,
		icon,
		...rest
	}: Props = $props();
</script>

<svelte:element
	this={href ? "a" : "button"}
	role="button"
	tabindex="0"
	{onclick}
	{href}
	{formaction}
	{form}
	{type}
	class="group inline-flex cursor-pointer items-center justify-center gap-x-4 rounded px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2
        {variant === 'primary' &&
		'bg-gray-600 text-white shadow-md hover:bg-gray-500 focus-visible:outline-gray-600'}
        {variant === 'secondary' &&
		'bg-white text-gray-900 shadow-md hover:bg-gray-300 focus-visible:outline-gray-300'}
        {rest.class}
        "
>
	<div id="loading" class="hidden">
		<LoadingIcon class="h-5 w-5" />
	</div>
	{#if icon}
		<div id="icon">
			{@render icon()}
		</div>
	{/if}
	{@render children()}
</svelte:element>

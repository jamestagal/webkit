<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		type?: "button" | "submit" | "reset";
		size?: "xs" | "sm" | "md";
		isLoading?: boolean;
		disabled?: boolean;
		variant?: "action" | "outline" | "danger" | "success" | "warning" | "primary" | "secondary";
		href?: string | null;
		full?: boolean;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
		class?: string;
	}

	let {
		type = "button",
		size = "sm",
		isLoading = false,
		disabled = false,
		variant,
		href = null,
		full = false,
		onclick,
		children,
		class: customClass = "",
	}: Props = $props();

	const sizeStyles = {
		xs: { button: "text-xs py-1 px-2", loader: 16 },
		sm: { button: "text-sm py-2 px-4", loader: 18 },
		md: { button: "text-base py-3 px-6", loader: 20 },
	};

	const commonStyles =
		"cursor-pointer rounded-xl scale-100 active:scale-95 transition-all duration-100 font-medium disabled:opacity-30 disabled:pointer-events-none";
	const buttonStyles = {
		action: "shadow-xs bg-gray-800 text-white border border-gray-700",
		outline: "shadow-xs bg-transparent border border-primary-4",
		danger: "shadow-xs bg-danger text-white",
		success: "shadow-xs bg-success text-white",
		warning: "shadow-xs bg-warning text-white",
		primary: "shadow-xs bg-primary text-white",
		secondary: "shadow-xs bg-secondary-4 text-white",
	};

	const fullWidth = full ? "w-full" : "";
	const variantStyles = variant ? buttonStyles[variant] || "" : "";
	const styles = `${commonStyles} ${sizeStyles[size]?.button} ${variantStyles} ${fullWidth} ${customClass}`;

	// Only apply disabled opacity once in the disabled state
	const isDisabled = disabled || isLoading;
</script>

{#if href}
	<a {href} class={styles} class:opacity-50={isDisabled} class:pointer-events-none={isDisabled}>
		<span class="relative flex flex-row items-center justify-center">
			{#if isLoading}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width={sizeStyles[size]?.loader || 20}
					height={sizeStyles[size]?.loader || 20}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="absolute right-1/2 translate-x-1/2 animate-spin"
				>
					<path d="M21 12a9 9 0 1 1-6.219-8.56" />
				</svg>
			{/if}
			<span class="flex flex-row items-center justify-center gap-2 {isLoading ? 'invisible' : ''}">
				{@render children()}
			</span>
		</span>
	</a>
{:else}
	<button
		{type}
		class={styles}
		disabled={isDisabled}
		onclick={onclick}
		class:opacity-50={isDisabled}
	>
		<span class="relative flex flex-row items-center justify-center">
			{#if isLoading}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width={sizeStyles[size]?.loader || 20}
					height={sizeStyles[size]?.loader || 20}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="absolute right-1/2 translate-x-1/2 animate-spin"
				>
					<path d="M21 12a9 9 0 1 1-6.219-8.56" />
				</svg>
			{/if}
			<span class="flex flex-row items-center justify-center gap-2 {isLoading ? 'invisible' : ''}">
				{@render children()}
			</span>
		</span>
	</button>
{/if}

<!-- @component Button
### Usage
```svelte
<script>
    import Button from '$lib/components/ui/Button.svelte';
    let isLoading = $state(false);
</script>
<Button>Regular</Button>
<Button type="submit" variant="action">Submit</Button>
<Button variant="action" disabled={true}>Disabled</Button>
<Button variant="outline" {isLoading} onclick={() => isLoading = true}>Show loading</Button>
```
-->

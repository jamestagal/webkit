<script>
	let { variant = "default", size = "sm", children, ...restProps } = $props();

	// Variant styles
	const variants = {
		default: "bg-primary-2 text-primary border-primary-3",
		success: "bg-green-100 text-green-800 border-green-200",
		installed: "bg-violet-100 text-violet-800 border-violet-200",
		warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
		danger: "bg-red-100 text-red-800 border-red-200",
		info: "bg-blue-100 text-blue-800 border-blue-200",
		secondary: "bg-secondary-2 text-secondary border-secondary-3",
	};

	// Size styles
	const sizes = {
		xs: "px-2 py-0.5 text-xs",
		sm: "px-2.5 py-0.5 text-sm",
		md: "px-3 py-1 text-sm",
		lg: "px-3 py-1 text-base",
	};
</script>

<span
	class="inline-flex items-center rounded-full border font-medium {variants[variant]} {sizes[size]}"
	{...restProps}
>
	{@render children?.()}
</span>

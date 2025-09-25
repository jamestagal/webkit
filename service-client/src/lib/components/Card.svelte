<script>
	let { padding = "p-6", shadow = true, border = true, children, ...restProps } = $props();

	const shadowClass = shadow ? "shadow-sm" : "";
	const borderClass = border ? "border border-primary-2" : "";
</script>

<div class="bg-main rounded-lg {padding} {shadowClass} {borderClass}" {...restProps}>
	{@render children?.()}
</div>

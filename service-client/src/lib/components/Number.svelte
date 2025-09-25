<script>
	import { Plus, Minus } from "lucide-svelte";
	import { fly } from "svelte/transition";
	

	let {
		value = $bindable(0),
		step = 1,
		min,
		max,
		label,
		name,
		disabled = false,
		showRange = false,
		onchange = () => {},
		...restProps
	} = $props();
	let direction = $state(1); // 1 for increment, -1 for decrement
	let key = $state(0); // Force re-render for transition
	// Calculate decimal places for proper rounding
	const decimalPlaces = $derived(() => {
		const stepStr = step.toString();
		return stepStr.includes(".") ? stepStr.split(".")[1].length : 0;
	});
	function roundToPrecision(num) {
		return parseFloat(num.toFixed(decimalPlaces()));
	}
	function increment() {
		if (disabled || (max !== undefined && value >= max)) return;
		direction = 1;
		value = roundToPrecision(value + step);
		key++;
		onchange?.(value);
	function decrement() {
		if (disabled || (min !== undefined && value <= min)) return;
		direction = -1;
		value = roundToPrecision(value - step);
	function handleKeydown(event) {
		if (event.key === "ArrowUp") {
			event.preventDefault();
			increment();
		} else if (event.key === "ArrowDown") {
			decrement();
		}
	function handleInput(event) {
		let inputValue = event.target.value;
		// Handle empty input
		if (inputValue === "" || inputValue === "-") {
			return; // Allow empty or just minus sign for typing
		let numValue = parseFloat(inputValue);
		// Handle invalid numbers
		if (isNaN(numValue)) {
			// Reset to current valid value
			event.target.value = value;
			return;
		// Apply min/max constraints
		if (min !== undefined && numValue < min) {
			numValue = min;
		if (max !== undefined && numValue > max) {
			numValue = max;
		// Round to proper precision and update
		value = roundToPrecision(numValue);
		// Update input field if value was constrained
		if (event.target.value !== value.toString()) {
</script>
<div class="flex w-full flex-col gap-1 font-medium">
	{#if label}
		<span class="text-xs font-medium">{label}</span>
	{/if}
	<div class="border-primary-4 flex items-center overflow-hidden rounded-xl border">
		<button
			aria-label="Decrement"
			type="button"
			onclick={decrement}
			disabled={disabled || (min !== undefined && value <= min)}
			class="hover:bg-primary-2 p-2 transition-all duration-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-minus-icon lucide-minus"
			>
				<path d="M5 12h14" />
			</svg>
		</button>
		<div
			class="relative flex h-8 min-w-16 flex-1 items-center justify-center overflow-hidden focus-within:outline-2"
			{#key key}
				<input
					id="abc"
					{name}
					type="number"
					{min}
					{max}
					{step}
					oninput={handleInput}
					{value}
					{disabled}
					class="absolute inset-0 z-10 border-0 text-center outline-none"
					in:fly={{ y: direction * -15, duration: 200 }}
					out:fly={{ y: direction * 15, duration: 100 }}
				/>
			{/key}
		</div>
			aria-label="Increment"
			onclick={increment}
			disabled={disabled || (max !== undefined && value >= max)}
				class="lucide lucide-plus-icon lucide-plus"
				<path d="M12 5v14" />
	</div>
	{#if showRange}
		<div class="text-secondary-4 flex items-center gap-2 text-xs">
			{min ? min : "∞"} - {max ? max : "∞"}
</div>
<!-- @component Number
### Usage
```svelte
    import Number from '@components/ui/Number.svelte';
    let quantity = $state(0);
<Number 
    bind:value={quantity} 
    name="quantity"
    step={1} 
    min={0} 
    max={100} 
    label="Quantity" 
/>
```
-->
<style>
	input[type="number"]::-webkit-inner-spin-button,
	input[type="number"]::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
</style>

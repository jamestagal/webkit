<script lang="ts">
	import { fly } from "svelte/transition";

	interface Option {
		value: string;
		label?: string;
		name?: string;
		note?: string;
	}

	let randomId = `dropdown-${Math.random().toString(36).substring(2, 15)}`;
	let {
		placeholder = "Choose an option",
		options = [],
		value = $bindable(),
		name = randomId,
		id = randomId,
		label,
		onSelect = () => {},
		onchange = () => {},
		required = false,
		disabled = false,
	}: {
		placeholder?: string;
		options: Option[];
		value?: string;
		name?: string;
		id?: string;
		label?: string;
		onSelect?: (index: number) => void;
		onchange?: () => void;
		required?: boolean;
		disabled?: boolean;
	} = $props();

	let isOpen = $state(false);
	let dropdownRef = $state(null);
	let shouldOpenUp = $state(false);

	// This selects the option that has the value that matches the value prop
	let selected = $derived(
		Array.isArray(options) ? options.find((opt) => opt.value === value) || {} : {},
	);

	function handleSelect(index) {
		if (Array.isArray(options) && options[index]) {
			value = options[index].value;
			onSelect(index);
			onchange();
		}
		isOpen = false;
	}

	function handleClickOutside(event) {
		if (dropdownRef && !dropdownRef.contains(event.target)) {
			isOpen = false;
		}
	}

	function checkSpace() {
		if (!dropdownRef) return;
		const rect = dropdownRef.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;
		const dropdownHeight = options.length * 40; // Approximate height per option

		shouldOpenUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}
</script>

<svelte:window onresize={checkSpace} onmouseup={handleClickOutside} />

<div class="relative z-50 flex w-full flex-col gap-2" bind:this={dropdownRef}>
	<input {id} type="hidden" {name} value={value || ""} />
	{#if label}
		<div class="flex flex-row items-center gap-2">
			<span class="text-base-content text-sm font-medium">
				{label}
				{#if required}<span class="text-error ml-1">*</span>{/if}
			</span>
			{#if selected.value}
				<button
					type="button"
					class="cursor-pointer text-gray-400 hover:text-gray-600"
					transition:fly={{ x: 10, duration: 120 }}
					aria-label="Reset selection"
					onclick={() => {
						value = "";
						selected = {};
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M3 7v6h6" />
						<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
					</svg>
				</button>
			{/if}
		</div>
	{/if}
	{@render optionSnippet(selected, null)}

	{#if isOpen}
		<div
			transition:fly={{ y: shouldOpenUp ? 10 : -10, duration: 80 }}
			class="absolute w-full {shouldOpenUp
				? 'bottom-full mb-2'
				: 'top-full mt-2'} border-base-300 bg-base-100 z-[9999] max-h-60 overflow-y-auto rounded-xl border shadow-xl"
		>
			{#each options as option, index}
				{@render optionSnippet(option, index)}
			{/each}
		</div>
	{/if}
</div>

{#snippet optionSnippet(option: Option, index: number | null)}
	{@const isSelector = !index && index !== 0}
	{@const isSelectedOption = selected.value === option.value && option.value}
	<button
		type="button"
		class="hover:bg-base-200 text-base-content flex w-full cursor-pointer flex-row items-center justify-between overflow-hidden rounded-xl px-4 py-2 text-left text-nowrap disabled:cursor-not-allowed disabled:opacity-50"
		class:border={isSelector}
		class:border-base-300={isSelector}
		class:bg-primary={isSelectedOption}
		class:text-primary-content={isSelectedOption}
		class:font-semibold={isSelectedOption}
		onclick={() => (isSelector ? toggleDropdown() : handleSelect(index))}
		{disabled}
	>
		{#if option.value}
			<span class="capitalize">{option.label || option.name || option.value}</span>
		{:else}
			<span class="text-base-content/50">{isSelector ? placeholder : "No value provided"}</span>
		{/if}
		<div class="flex flex-row items-center gap-2">
			{#if option.note}
				<span class="text-sm text-gray-500">{option.note}</span>
			{/if}
			{#if isSelector}
				<!-- You can replace the chevron icon with any icon you want -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="lucide-icon lucide lucide-chevrons-up-down flex-shrink-0 text-gray-400"
				>
					<path d="m7 15 5 5 5-5"></path>
					<path d="m7 9 5-5 5 5"></path>
				</svg>
			{/if}
		</div>
	</button>
{/snippet}

<!-- @component
### Usage
```svelte
<script>
    import Dropdown from '$lib/components/ui/Dropdown.svelte';
    let options = [
        { name: 'Option 1', value: 'option1', note: 'This is a note' },
        { name: 'Option 2', value: 'option2' },
        { value: 'option3' },
    ];
    // Only value is required, others are optional
</script>
<Dropdown {options} value={options[1].value} name="dropdown" label="Options" placeholder="Select an option" />
```
-->

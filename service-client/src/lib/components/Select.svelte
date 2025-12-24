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
	let dropdownRef = $state<HTMLElement | null>(null);
	let shouldOpenUp = $state(false);

	// This selects the option that has the value that matches the value prop
	let selected = $derived(
		Array.isArray(options) ? options.find((opt) => opt.value === value) || {} : {},
	);

	function handleSelect(index: number) {
		if (Array.isArray(options) && options[index]) {
			value = options[index].value;
			onSelect(index);
			onchange();
		}
		isOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	function checkSpace() {
		if (!dropdownRef) return;
		const rect = dropdownRef.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;
		const dropdownHeight = Math.min(options.length * 40, 240);

		shouldOpenUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
	}

	function toggleDropdown() {
		if (disabled) return;
		checkSpace();
		isOpen = !isOpen;
	}
</script>

<svelte:window onresize={checkSpace} onmouseup={handleClickOutside} />

<div class="relative flex w-full flex-col gap-2 {isOpen ? 'z-[9999]' : 'z-40'}" bind:this={dropdownRef}>
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
						isOpen = false;
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

	<!-- Trigger Button -->
	<button
		type="button"
		class="hover:bg-base-200 text-base-content flex w-full cursor-pointer flex-row items-center justify-between overflow-hidden rounded-xl border border-base-300 px-4 py-2 text-left text-nowrap disabled:cursor-not-allowed disabled:opacity-50"
		onclick={toggleDropdown}
		{disabled}
	>
		{#if selected.value}
			<span class="capitalize">{selected.label || selected.name || selected.value}</span>
		{:else}
			<span class="text-base-content/50">{placeholder}</span>
		{/if}
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
			class="lucide-icon lucide lucide-chevrons-up-down shrink-0 text-gray-400"
		>
			<path d="m7 15 5 5 5-5"></path>
			<path d="m7 9 5-5 5 5"></path>
		</svg>
	</button>

	<!-- Dropdown Options -->
	{#if isOpen}
		<div
			transition:fly={{ y: shouldOpenUp ? 10 : -10, duration: 80 }}
			class="absolute z-[9999] max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl {shouldOpenUp
				? 'bottom-full mb-2'
				: 'top-full mt-2'}"
		>
			{#each options as option, index}
				{@const isSelectedOption = selected.value === option.value && option.value}
				<button
					type="button"
					class="flex w-full cursor-pointer flex-row items-center justify-between px-4 py-2 text-left text-gray-900 hover:bg-gray-100"
					class:bg-indigo-500={isSelectedOption}
					class:text-white={isSelectedOption}
					class:hover:bg-indigo-600={isSelectedOption}
					onclick={() => handleSelect(index)}
				>
					<span class="capitalize">{option.label || option.name || option.value || "No value provided"}</span>
					{#if option.note}
						<span class="text-sm opacity-70">{option.note}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

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

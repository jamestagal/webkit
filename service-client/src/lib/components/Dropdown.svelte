<script>
	import { slide, fly, fade, scale } from "svelte/transition";
	import { ChevronsUpDown } from "lucide-svelte";

	let {
		placeholder = "Select an option",
		options = [],
		value = $bindable(),
		name = "",
		onSelect = () => {},
	} = $props();

	let isOpen = $state(false);
	let dropdownRef = $state(null);
	let shouldOpenUp = $state(false);

	let selected = $derived(options.find((opt) => opt.value === value) || {});

	function handleSelect(option, index) {
		value = option.value;
		onSelect({ option, index });
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
		if (isOpen) {
			checkSpace();
			document.addEventListener("click", handleClickOutside);
		} else {
			document.removeEventListener("click", handleClickOutside);
		}
	}
</script>

<div class="relative z-[9999] flex flex-col" bind:this={dropdownRef}>
	<input type="hidden" {name} value={value || ""} />
	<button
		type="button"
		class="text-secondary-2 bg-main border-primary-3 focus:border-primary-4 hover:bg-primary-2 flex w-full cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 font-medium"
		onclick={toggleDropdown}
	>
		<div class="flex w-full flex-row items-center justify-between gap-2">
			<span class="capitalize">{selected.name || selected.value || placeholder}</span>
			{#if selected.note}
				<span class="text-fade text-sm">{selected.note}</span>
			{/if}
		</div>
		<ChevronsUpDown size={16} class="flex-shrink-0" />
	</button>

	{#if isOpen}
		<div
			in:fade={{ y: shouldOpenUp ? 10 : -10, duration: 30 }}
			out:fade={{ duration: 100 }}
			class="absolute z-[9999] w-full {shouldOpenUp
				? 'bottom-full mb-2'
				: 'top-full mt-2'} border-primary-3 bg-main rounded-xl border shadow-lg"
		>
			<div class="ring-opacity-5 max-h-60 overflow-auto rounded-xl py-1 focus:outline-none">
				{#each options as option, index}
					<button
						type="button"
						class="hover:bg-primary flex w-full cursor-pointer flex-row items-center justify-between px-4 py-2 text-left"
						onclick={() => handleSelect(option, index)}
					>
						<span class="capitalize">{option.name || option.value}</span>
						{#if option.note}
							<span class="text-fade text-sm">{option.note}</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

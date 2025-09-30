<script>
	import { ChevronDown, ChevronRight } from "lucide-svelte";
	import { slide } from "svelte/transition";

	let { title = "", children } = $props();
	let isOpen = $state(false);
	function toggleAccordion() {
		isOpen = !isOpen;
	}
</script>

<div class="card card-ring mb-2 flex flex-col">
	<!-- Trigger section -->
	<button
		class="flex w-full cursor-pointer items-center justify-between p-4 text-left focus:outline-none"
		onclick={toggleAccordion}
		aria-expanded={isOpen}
	>
		<span class="font-bold">{title}</span>
		<ChevronDown
			size={16}
			class={isOpen
				? "rotate-180 transition-transform duration-300"
				: "transition-transform duration-300"}
		/>
	</button>
	<!-- Content section -->
	{#if isOpen}
		<div class="p-4" transition:slide={{ duration: 300 }}>
			{@render children?.()}
		</div>
	{/if}
</div>

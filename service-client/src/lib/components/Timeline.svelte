<script>
	import { Check, Plus } from "lucide-svelte";

	let { data = [] } = $props();
</script>

<!-- Timeline Points -->
<div
	class="border-secondary-3 mx-auto flex w-full flex-col gap-4 border-l-2 md:flex-row md:border-t-2 md:border-l-0"
>
	{#each data as item, idx}
		<div class="relative pb-8 md:w-1/4 md:pb-0 md:pt-5">
			<div
				class="absolute -left-3 top-0 h-6 w-6 rounded-full bg-white ring-8 ring-white md:-top-3 md:left-auto md:right-0"
			>
				{#if item.status === "completed"}
					<Check class="h-6 w-6 text-green-500" />
				{:else if item.status === "current"}
					<Plus class="h-6 w-6 text-blue-500" />
				{:else}
					<div class="h-6 w-6 rounded-full bg-gray-300"></div>
				{/if}
			</div>

			<div class="pl-8 md:pl-0 md:pr-8">
				<h3 class="text-lg font-semibold">{item.title}</h3>
				<p class="text-sm text-gray-600">{item.description}</p>
				{#if item.date}
					<time class="text-xs text-gray-500">{item.date}</time>
				{/if}
			</div>
		</div>
	{/each}
</div>

<script>
	import { page } from "$app/state";
	import Button from "$lib/ui/button.svelte";

	const type = page.url.searchParams.get("type");
</script>

<section class="mx-auto flex max-w-lg flex-col justify-center gap-6">
	<h1 class="text-center text-2xl font-semibold">Mock implementation for subscription</h1>
	<h2 class="text-center text-xl font-medium">{type?.toUpperCase()}</h2>
	{#if type === "checkout"}
		<form action="?/webhook" class="flow-root" method="post">
			<Button class="w-full">Trigger test webhook call</Button>
		</form>
	{:else if type === "portal"}
		<ul class="list-inside list-disc">
			<li>Invoice 1</li>
			<li>Invoice 2</li>
			<li>Invoice 3</li>
		</ul>
	{/if}
</section>

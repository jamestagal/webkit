<script lang="ts">
	import AvatarIcon from "$lib/assets/icons/AvatarIcon.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<section class="max-w-lg">
	<h1 class="mb-10 text-4xl font-bold">Dashboard</h1>
	<p class="mt-6 max-w-xl text-xl tracking-wider">
		GoFast - The Ultimate Go Foundation for Modern Web Applications
	</p>
	<p class="mt-8">Logged in as:</p>
	{#if data.avatar}
		<img class="mt-4 h-8 w-8 rounded-full" src={data.avatar} alt="Profile" />
	{:else}
		<AvatarIcon class="mt-4 h-8 w-8" />
	{/if}
	<p class="mt-4">
		Email: {data.email}
	</p>
	<p class="mt-4">
		Access: {data.access}
	</p>
	<p class="mt-4">
		Subscription: {data.subscription_active ? "Active" : "Inactive"}
	</p>
</section>

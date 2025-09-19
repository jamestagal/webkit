<script lang="ts">
	import { page } from "$app/state";
	import { env } from "$env/dynamic/public";
	import { getToast } from "$lib/ui/toast_store.svelte.js";

	let { data, form } = $props();
	const toast = getToast();

	$effect(() => {
		if (form) {
			if (!form.success) {
				toast.error("Error", form.message);
			} else {
				toast.success("Success", form.message);
			}
		}
		if (page.url.searchParams.get("success") === "true") {
			toast.success("Success", "Your subscription has been activated.");
		} else if (page.url.searchParams.get("cancel") === "true") {
			toast.info("Cancelled", "Your subscription has been cancelled.");
		} else if (page.url.searchParams.get("update") === "true") {
			toast.success("Success", "Your subscription has been updated.");
		}
	});

	const BasicPlan = 0x0000000000004000;
	const PremiumPlan = 0x0000000000008000;
	let plan = $state("");
	if (data.access & BasicPlan) {
		plan = "Basic";
	} else if (data.access & PremiumPlan) {
		plan = "Premium";
	} else {
		plan = "Free";
	}
</script>

<section class="flex max-w-lg flex-col gap-6">
	<h1 class="mb-10 text-4xl font-bold">Payments</h1>
	<h2>
		You are currently on the <span class="font-bold">{plan}</span>
		plan.
	</h2>
	<div class="flex flex-col gap-2">
		{#if data.subscription_active}
			<a href={env.PUBLIC_CORE_URL + "/payments-portal"} class="btn btn-primary btn-soft w-full">
				Manage subscription
			</a>
			{#if plan === "Basic"}
				<a
					href={env.PUBLIC_CORE_URL + "/payments-update?plan=premium"}
					class="btn btn-primary btn-soft w-full"
				>
					Upgrade to Premium Plan
				</a>
			{:else if plan === "Premium"}
				<a
					href={env.PUBLIC_CORE_URL + "/payments-update?plan=basic"}
					class="btn btn-primary btn-soft w-full"
				>
					Downgrade to Basic Plan
				</a>
			{/if}
		{:else}
			<a href={env.PUBLIC_CORE_URL + "/payments-checkout"} class="btn btn-primary btn-soft w-full">
				Subscribe Basic Plan
			</a>
			<a
				href={env.PUBLIC_CORE_URL + "/payments-checkout?plan=premium"}
				class="btn btn-primary btn-soft w-full"
			>
				Subscribe Premium Plan
			</a>
		{/if}
	</div>
</section>

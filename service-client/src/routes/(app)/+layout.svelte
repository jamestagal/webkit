<script lang="ts">
	import { page } from "$app/state";
	import type { Snippet } from "svelte";
	import { House, BookOpen, DollarSign, Mail, File, LogOut, MessageCircle } from "lucide-svelte";
	import { env } from "$env/dynamic/public";

	let { children }: { children: Snippet } = $props();

	let current = $derived(page.url.pathname);

	const nav = [
		{ label: "Dashboard", url: "/", icon: House },
		{ label: "Consultation", url: "/consultation", icon: MessageCircle },
		{ label: "Notes", url: "/notes", icon: BookOpen },
		{ label: "Payments", url: "/payments", icon: DollarSign },
		{ label: "Files", url: "/files", icon: File },
		{ label: "Emails", url: "/emails", icon: Mail },
	];

	function showModal(): undefined {
		const modal = document.getElementById("sidebar") as HTMLDialogElement;
		if (modal) {
			modal.showModal();
		}
		return undefined;
	}
</script>

<div id="content" class="h-full">
	<!-- Desktop menu -->
	<div
		class="lg:bg-base-300 hidden !overflow-visible lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-20 lg:flex-col lg:overflow-y-auto lg:pb-4"
	>
		<div class="flex grow flex-col">
			<a href="/" class="mt-4 flex h-8 shrink-0 items-center justify-center">
				<img class="h-full" src="/favicon.svg" alt="GoFast" />
			</a>
			<nav class="mt-8 flex flex-1 flex-col">
				<ul role="list" class="flex flex-1 flex-col items-center space-y-1">
					{#each nav as item (item.url)}
						<li>
							<div class="tooltip tooltip-right" data-tip={item.label}>
								<a
									href={item.url}
									class="group hover:bg-base-100 flex cursor-pointer gap-x-3 rounded-md p-3 text-sm/6 font-semibold hover:opacity-80
                                            {current == item.url ? 'bg-base-100' : ''}"
								>
									<item.icon class="h-6 w-6" />
									<span class="sr-only">{item.label}</span>
								</a>
							</div>
						</li>
					{/each}
					<li class="!mt-auto">
						<div class="tooltip tooltip-right" data-tip="Logout">
							<form
								action={env.PUBLIC_CORE_URL + "/logout"}
								method="post"
								class="group hover:bg-base-100 flex cursor-pointer gap-x-3 rounded-md text-sm/6 font-semibold hover:opacity-80"
							>
								<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
								<button class="cursor-pointer p-3">
									<LogOut class="h-6 w-6" />
									<span class="sr-only">Logout</span>
								</button>
							</form>
						</div>
					</li>
				</ul>
			</nav>
		</div>
	</div>
	<!-- Mobile menu -->
	<div
		class="bg-base-300 sticky top-0 z-30 flex items-center gap-x-6 px-4 py-4 shadow-sm sm:px-6 lg:hidden"
	>
		<button
			type="button"
			class="-m-2.5 cursor-pointer p-2.5 hover:opacity-60 lg:hidden"
			onclick={() => showModal()}
		>
			<span class="sr-only">Open sidebar</span>
			<svg
				class="size-6"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				aria-hidden="true"
				data-slot="icon"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
				></path>
			</svg>
		</button>
		<div class="ml-auto flex gap-x-4">
			<div class="flex flex-1 items-center gap-x-4">
				<img class="h-8 w-auto" src="/favicon.svg" alt="GoFast" />
			</div>
		</div>
	</div>
	<!-- Sidebar -->
	<dialog id="sidebar" class="modal modal-start">
		<div class="modal-box w-full max-w-sm">
			<div class="relative flex-1 px-4 sm:px-6">
				<nav class="flex flex-1 flex-col">
					<ul role="list" class="-mx-2 flex-1 space-y-1">
						{#each nav as item (item.url)}
							<li>
								<a
									href={item.url}
									class="group hover:bg-base-200 flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold hover:opacity-80
                                                {current == item.url ? 'bg-base-200' : ''}"
								>
									<item.icon class="h-6 w-6" />
									{item.label}
								</a>
							</li>
						{/each}
						<li>
							<form
								action={env.PUBLIC_CORE_URL + "/logout"}
								method="post"
								class="group hover:bg-base-200 flex gap-x-3 rounded-md text-sm/6 font-semibold hover:opacity-80"
							>
								<input type="hidden" name="return_url" value={env.PUBLIC_CLIENT_URL} />
								<button class="flex cursor-pointer gap-x-3 p-2">
									<LogOut class="h-6 w-6" />
									Logout
								</button>
							</form>
						</li>
					</ul>
				</nav>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
	<main class="min-h-full lg:pl-20">
		<div class="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
			{@render children()}
		</div>
	</main>
</div>

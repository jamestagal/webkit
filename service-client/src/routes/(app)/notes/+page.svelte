<script lang="ts">
	import Pagination from "$lib/ui/pagination.svelte";
	import NoteForm from "./note_form.svelte";
	import { usePagination } from "$lib/ui/pagination";
	import { getToast } from "$lib/ui/toast_store.svelte.js";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";

	let { data, form } = $props();
	const toast = getToast();

	$effect(() => {
		if (form) {
			if (!form.success) {
				toast.error("Error", form?.message);
			} else {
				toast.success("Success", form?.message);
			}
		}
	});

	$effect(() => {
		if (page.url.searchParams.has("deleted")) {
			toast.warning("Success", "Note deleted");
			goto("/notes");
		}
	});

	let note = $state({
		id: "",
		title: "Note Title",
		category: "work",
		content: "Note Content",
	});
	const pagination = $derived(usePagination(data.total, data.page, data.limit));
</script>

<section class="flex max-w-xl flex-col gap-6">
	<h1 class="mb-10 text-4xl font-bold">Notes</h1>
	<NoteForm {note} action="?/insert_note" />
</section>
<section class="mt-10 max-w-xl">
	{#each data.notes as n (n.note.id)}
		<div class="mb-4 flex flex-col gap-2 rounded-lg border border-gray-700 p-4">
			<p>Title: {n.note.title}</p>
			<p>Category: {n.note.category}</p>
			<p>Content: {n.note.content}</p>
			<p class="text-xs">author: {n.user?.email}</p>
			<a class="btn btn-soft mt-2" href="/notes/{n.note.id}">Details</a>
		</div>
	{/each}
	<Pagination {pagination} />
</section>

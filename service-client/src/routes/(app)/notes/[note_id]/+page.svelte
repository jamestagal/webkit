<script lang="ts">
	import { page } from "$app/state";
	import { enhance } from "$app/forms";
	import { getToast } from "$lib/ui/toast_store.svelte.js";
	import NoteForm from "../note_form.svelte";
	import { trapFocus } from "$lib/ui/trap_focus";

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
	});

	const id = page.params["note_id"] ?? "";
	let note = $state({
		id: id,
		title: data.note.note?.title ?? "",
		category: data.note.note?.category ?? "",
		content: data.note.note?.content ?? "",
	});
</script>

<section class="flex max-w-xl flex-col gap-6">
	<h1 class="text-4xl font-bold">Note</h1>
	<p>{id}</p>
	<NoteForm {note} action="?/update_note" />
	<button
		type="button"
		class="btn btn-soft btn-error"
		onclick={() => {
			const dialog = document.getElementById("delete_" + id) as HTMLDialogElement;
			if (dialog) {
				dialog.showModal();
			}
		}}
	>
		Delete
	</button>
	<dialog id={"delete_" + id} class="modal">
		<div class="modal-box" use:trapFocus>
			<h3 class="text-lg font-bold">Delete Note</h3>
			<p class="py-4">Are you sure you want to delete this note?</p>
			<div class="modal-action">
				<form method="dialog">
					<button class="btn">Cancel</button>
				</form>
				<form method="post" action="?/delete_note" use:enhance>
					<input type="hidden" name="id" value={id} />
					<button type="submit" class="btn btn-error">Delete</button>
				</form>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button>close</button>
		</form>
	</dialog>
</section>

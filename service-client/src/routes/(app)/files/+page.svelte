<script lang="ts">
	import { enhance } from "$app/forms";
	import { submit } from "$lib/portal.js";
	import { getToast } from "$lib/ui/toast_store.svelte.js";
	import { env } from "$env/dynamic/public";

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
</script>

<section class="flex max-w-xl flex-col gap-6">
	<h1 class="mb-10 text-4xl font-bold">Files</h1>
	<form
		action="?/upload_files"
		method="post"
		class="flex flex-col gap-4"
		enctype="multipart/form-data"
		use:enhance={submit}
	>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Pick a file</legend>
			<input type="file" name="files" required class="file-input w-full" />
			<p class="label">Max size 10MB</p>
		</fieldset>
		<button class="btn btn-primary btn-soft w-full" type="submit">Upload Files</button>
	</form>
</section>

<section class="mt-10 flex max-w-xl flex-col gap-6">
	{#each data.files as f (f.id)}
		{#if f}
			<div class="mb-4 flex rounded-lg border border-gray-700 p-4">
				<div class="flex-1">
					<p>{f.file_name}</p>
					<p class="text-xs">{f.file_size} bytes</p>
				</div>
				<div class="flex gap-4">
					<form action={env.PUBLIC_CORE_URL + "/files/" + f.id} method="get">
						<button type="submit" class="btn btn-primary btn-soft">Download</button>
					</form>
					<form action="?/delete_file" method="post" use:enhance={submit}>
						<input type="hidden" name="file_id" value={f.id} />
						<button type="submit" class="btn btn-soft">Delete</button>
					</form>
				</div>
			</div>
		{/if}
	{/each}
</section>

<script lang="ts">
	import { enhance } from "$app/forms";

	type Props = {
		action: string;
		note: {
			id: string;
			title: string;
			category: string;
			content: string;
		};
	};
	let { action, note }: Props = $props();
</script>

<form
	class="flex flex-col gap-6"
	{action}
	method="post"
	use:enhance={() => {
		return async ({ update }) => {
			if (!note.id) {
				update({ reset: true });
			} else {
				update({ reset: false });
			}
		};
	}}
>
	<input type="hidden" name="id" value={note.id} />
	<div class="flex gap-4">
		<div class="flex-1">
			<label class="floating-label col-span-2">
				<span>Title</span>
				<input
					autocomplete="off"
					type="text"
					name="title"
					maxlength={100}
					required
					placeholder="Note Title"
					class="input validator w-full"
					value={note.title}
				/>
				<div class="validator-hint">Enter valid title</div>
			</label>
		</div>
		<div class="flex-1">
			<label class="floating-label col-span-2">
				<span>Category</span>
				<select name="category" required class="input validator w-full" value={note.category}>
					<option value="" class="text-gray-400">Select a category</option>
					<option value="work">Work</option>
					<option value="personal">Personal</option>
					<option value="other">Other</option>
				</select>
				<div class="validator-hint">Select a category</div>
			</label>
		</div>
	</div>
	<label class="floating-label col-span-2">
		<span>Content</span>
		<textarea
			autocomplete="off"
			name="content"
			rows={5}
			required
			maxlength={1000}
			placeholder="Note Content"
			class="textarea validator w-full"
			value={note.content}
		></textarea>
		<div class="validator-hint">Enter valid content</div>
	</label>
	<button class="btn btn-primary btn-soft" type="submit">
		{note.id ? "Edit" : "Create"}
	</button>
</form>

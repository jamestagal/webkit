<script lang="ts">
	import { enhance } from "$app/forms";
	import { submit } from "$lib/portal.js";
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
	});

	const email = $state({
		email_to: "support@gofast.live",
		email_subject: "Hello",
		email_body: "<h1>Hi there!</h1>",
	});
</script>

<section class="flex max-w-xl flex-col gap-6">
	<h1 class="mb-10 text-4xl font-bold">Emails</h1>
	<form action="?/send_email" method="post" class="flex flex-col gap-4" use:enhance={submit}>
		<label class="floating-label col-span-2">
			<span>To</span>
			<input
				autocomplete="email"
				name="email_to"
				bind:value={email.email_to}
				type="email"
				required
				maxlength={100}
				placeholder="Email To"
				class="input validator w-full"
			/>
			<div class="validator-hint">Enter valid email</div>
		</label>
		<label class="floating-label col-span-2">
			<span>Subject</span>
			<input
				name="email_subject"
				type="text"
				bind:value={email.email_subject}
				required
				maxlength={100}
				class="input validator w-full"
				placeholder="Email Subject"
			/>
			<div class="validator-hint">Enter valid subject</div>
		</label>
		<label class="floating-label col-span-2">
			<span>Body</span>
			<textarea
				name="email_body"
				bind:value={email.email_body}
				required
				rows={4}
				maxlength={1000}
				class="textarea validator w-full"
				placeholder="Email Body"
			></textarea>
			<div class="validator-hint">Enter valid body</div>
		</label>
		<button type="submit" class="btn btn-primary btn-soft w-full">Send email</button>
		<div class="divider">Add Attachments</div>
		{#each data.files as f (f.id)}
			<div class="mb-4 flex items-center gap-3 rounded-lg border border-gray-700 p-4">
				<input
					type="checkbox"
					name="attachment_ids"
					value={f.id}
					id={`file-checkbox-${f.id}`}
					class="checkbox checkbox-primary"
				/>
				<label for={`file-checkbox-${f.id}`} class="flex-grow cursor-pointer">
					<div class="flex flex-col text-ellipsis">
						<h3>{f.file_name}</h3>
						<p class="text-sm text-gray-500">{f.file_size} bytes</p>
					</div>
				</label>
			</div>
		{/each}
	</form>
</section>

<section class="mt-10 max-w-xl">
	<h2 class="mb-4 text-2xl font-semibold">Sent Emails</h2>
	{#if data.emails.length === 0}
		<p class="text-gray-500">No emails sent yet.</p>
	{/if}
	{#each data.emails as e (e.email.id)}
		<div class="bg-base-300 mb-6 rounded-lg border border-gray-700 p-4 shadow">
			<h3 class="text-base-content mb-1 text-xl font-semibold">{e.email.email_subject}</h3>
			<p class="mb-1 text-sm text-gray-500">To: {e.email.email_to}</p>
			<div
				class="prose prose-sm prose-invert bg-base-100 mb-3 max-h-40 overflow-y-auto rounded p-2"
			>
				{e.email.email_body}
			</div>

			{#if e.attachments && e.attachments.length > 0}
				<div>
					<h4 class="mb-1 text-sm font-medium text-gray-300">Attachments:</h4>
					<ul class="list-inside list-disc pl-1 text-sm text-gray-400">
						{#each e.attachments as attachment (attachment.id)}
							<li>{attachment.file_name} ({attachment.content_type})</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/each}
</section>

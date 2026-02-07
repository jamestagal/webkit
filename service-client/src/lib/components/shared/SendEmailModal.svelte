<script lang="ts">
	import { Mail, Send, Loader2, X } from "lucide-svelte";

	interface Props {
		open: boolean;
		title: string;
		documentType: string;
		recipientEmail: string;
		recipientName?: string | undefined;
		loading?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open,
		title,
		documentType,
		recipientEmail,
		recipientName,
		loading = false,
		onConfirm,
		onCancel,
	}: Props = $props();
</script>

{#if open}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<button
				type="button"
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				onclick={onCancel}
				disabled={loading}
			>
				<X class="h-4 w-4" />
			</button>

			<div class="flex items-center gap-3 mb-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
					<Mail class="h-5 w-5 text-primary" />
				</div>
				<h3 class="font-bold text-lg">{title}</h3>
			</div>

			<p class="text-base-content/70">
				Send this {documentType} to <span class="font-medium text-base-content"
					>{recipientName || recipientEmail}</span
				>?
			</p>

			{#if recipientName}
				<p class="text-sm text-base-content/60 mt-1">{recipientEmail}</p>
			{/if}

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={onCancel} disabled={loading}>
					Cancel
				</button>
				<button type="button" class="btn btn-primary" onclick={onConfirm} disabled={loading}>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
						Sending...
					{:else}
						<Send class="h-4 w-4" />
						Send Email
					{/if}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={onCancel} disabled={loading}>close</button>
		</form>
	</dialog>
{/if}

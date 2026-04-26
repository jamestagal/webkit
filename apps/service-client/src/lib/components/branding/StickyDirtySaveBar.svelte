<script lang="ts">
	type Props = {
		visible: boolean;
		saving?: boolean;
		saveLabel?: string;
		onSave: () => void;
		onDiscard: () => void;
	};

	let { visible, saving = false, saveLabel = 'Save Changes', onSave, onDiscard }: Props = $props();
</script>

{#if visible}
	<div
		class="fixed bottom-0 left-0 right-0 z-30 border-t border-base-300 bg-base-100/95 px-6 py-3 shadow-sm backdrop-blur"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-end gap-2">
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={onDiscard}
				disabled={saving}
			>
				Discard changes
			</button>
			<button
				type="button"
				class="btn btn-primary btn-sm"
				onclick={onSave}
				disabled={saving}
			>
				{#if saving}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				{saveLabel}
			</button>
		</div>
	</div>
{/if}

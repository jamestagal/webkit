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
		class="sticky bottom-0 left-0 right-0 z-10 -mx-4 mt-4 flex items-center justify-end gap-2 border-t border-base-300 bg-base-100/95 px-4 py-3 backdrop-blur"
	>
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
{/if}

<script lang="ts">
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { Upload, X, Info } from 'lucide-svelte';

	type Props = {
		label: string;
		value: string;
		onChange: (next: string) => void;
		description?: string;
		disabled?: boolean;
		maxBytes?: number;
		tooltip?: string;
	};

	let {
		label,
		value,
		onChange,
		description,
		disabled = false,
		maxBytes = 2 * 1024 * 1024,
		tooltip
	}: Props = $props();

	function handleUrlInput(event: Event) {
		onChange((event.currentTarget as HTMLInputElement).value);
	}

	const toast = getToast();
	let fileInput: HTMLInputElement | undefined = $state();
	let isDragging = $state(false);

	function processFile(file: File) {
		if (file.size > maxBytes) {
			const mb = (maxBytes / 1024 / 1024).toFixed(0);
			toast.error('File too large', `Image must be under ${mb}MB`);
			return;
		}
		if (!file.type.startsWith('image/')) {
			toast.error('Invalid file', 'Please upload an image file');
			return;
		}
		const reader = new FileReader();
		reader.onload = (e) => onChange((e.target?.result as string) ?? '');
		reader.readAsDataURL(file);
	}

	function handleSelect(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) processFile(file);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (disabled) return;
		const file = event.dataTransfer?.files[0];
		if (file?.type.startsWith('image/')) processFile(file);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!disabled) isDragging = true;
	}

	function clear() {
		onChange('');
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<span class="flex items-center gap-1">
			<span class="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
				{label}
			</span>
			{#if tooltip}
				<span class="tooltip tooltip-top" data-tip={tooltip}>
					<Info class="h-3 w-3 text-base-content/40" />
				</span>
			{/if}
		</span>
		{#if value && !disabled}
			<button
				type="button"
				onclick={clear}
				class="btn btn-ghost btn-xs gap-1 text-base-content/60 hover:text-error"
				aria-label="Remove logo"
			>
				<X class="h-3 w-3" />
				Clear
			</button>
		{/if}
	</div>

	<button
		type="button"
		onclick={() => fileInput?.click()}
		ondragover={handleDragOver}
		ondragleave={() => (isDragging = false)}
		ondrop={handleDrop}
		{disabled}
		class="flex min-h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-base-300 bg-base-100 p-3 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
		class:border-primary={isDragging}
		class:bg-base-200={isDragging}
	>
		{#if value}
			<img src={value} alt="Logo preview" class="max-h-20 max-w-full object-contain" />
		{:else}
			<span class="flex flex-col items-center gap-1 text-center text-base-content/60">
				<Upload class="h-5 w-5" />
				<span class="text-xs">Drop image or click to upload</span>
			</span>
		{/if}
	</button>

	<div class="flex flex-col gap-1">
		<span class="text-[10px] font-medium uppercase tracking-wider text-base-content/50">
			Or enter URL
		</span>
		<input
			type="url"
			class="input input-bordered input-xs w-full font-mono text-xs"
			placeholder="https://example.com/logo.png"
			{value}
			oninput={handleUrlInput}
			{disabled}
		/>
	</div>

	{#if description}
		<span class="text-[11px] text-base-content/50">{description}</span>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		onchange={handleSelect}
		class="hidden"
		{disabled}
	/>
</div>

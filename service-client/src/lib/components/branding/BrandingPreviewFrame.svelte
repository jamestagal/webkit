<script lang="ts">
	import type { DocumentType } from '$lib/server/schema';

	type Props = {
		agencySlug: string;
		docType: DocumentType;
		frame?: HTMLIFrameElement | undefined;
		title?: string;
		class?: string;
	};

	let {
		agencySlug,
		docType,
		frame = $bindable(),
		title = 'Branding preview',
		class: className = ''
	}: Props = $props();
</script>

<div class="relative overflow-hidden rounded-xl border border-base-300 bg-base-100 {className}">
	<iframe
		bind:this={frame}
		src="/{agencySlug}/preview/{docType}"
		{title}
		class="block h-full min-h-96 w-full border-0"
		loading="lazy"
	></iframe>
</div>

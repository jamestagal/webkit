<script lang="ts">
	import type { DocumentType } from '$lib/server/schema';
	import type {
		EffectiveBranding,
		ProposalEffectiveBranding
	} from '$lib/server/document-branding';
	import { advancedDebounce } from '$lib/utils/debounce';

	type Props = {
		agencySlug: string;
		docType: DocumentType;
		branding: EffectiveBranding | ProposalEffectiveBranding;
		title?: string;
		class?: string;
	};

	let { agencySlug, docType, branding, title = 'Branding preview', class: className = '' }: Props =
		$props();

	let frame: HTMLIFrameElement | undefined = $state();

	function postNow(payload: object) {
		if (!frame?.contentWindow) return;
		frame.contentWindow.postMessage(
			{ type: 'branding-update', payload },
			window.location.origin
		);
	}

	const postBranding = advancedDebounce(postNow, 150);

	$effect(() => {
		void JSON.stringify(branding);
		postBranding(branding);
	});
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

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
		controls?: boolean;
	};

	let {
		agencySlug,
		docType,
		branding,
		title = 'Branding preview',
		controls = true
	}: Props = $props();

	let frame: HTMLIFrameElement | undefined = $state();
	let expanded = $state(false);

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

	// Initial $effect post races the iframe's listener registration — by the
	// time postMessage fires (~150ms after mount), the iframe page may still
	// be hydrating. Cancel any pending debounce and re-fire synchronously
	// once the iframe load event confirms the listener is ready. This is the
	// pattern from the existing /settings/branding/ page (line 1210) — its
	// reliability is already proven against this race.
	function handleLoad() {
		postBranding.cancel();
		postNow(branding);
	}
</script>

<div class="overflow-hidden rounded-xl border border-base-300 bg-base-100">
	{#if controls}
		<div class="flex items-center justify-between gap-2 bg-base-200 px-4 py-2">
			<span class="text-sm font-medium">Live Preview</span>
			<div class="flex items-center gap-2">
				<a
					href="/{agencySlug}/preview/{docType}"
					target="_blank"
					rel="noopener noreferrer"
					class="btn btn-xs btn-ghost"
				>
					Open full preview ↗
				</a>
				<button
					type="button"
					class="btn btn-xs btn-ghost"
					onclick={() => (expanded = !expanded)}
				>
					{expanded ? 'Collapse' : 'Expand'}
				</button>
			</div>
		</div>
	{/if}
	<iframe
		bind:this={frame}
		src="/{agencySlug}/preview/{docType}"
		{title}
		class="block w-full border-0"
		style:height="{expanded ? 600 : 400}px"
		onload={handleLoad}
		sandbox="allow-same-origin allow-scripts"
	></iframe>
</div>

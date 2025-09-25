<!-- @component YoutubeEmbed 
### Usage

```html
<YoutubeEmbed src="https://link.to.youtube.com/video" title="Video Title" />
```
-->
<script>
	let { src, title = "video" } = $props();
	let interacted = $state(false);

	function extractVideoId(url) {
		if (!url) return "";
		// Regex to extract video ID from various YouTube URL formats
		// Supports:
		// - youtube.com/watch?v=VIDEO_ID
		// - youtube.com/embed/VIDEO_ID
		// - youtu.be/VIDEO_ID
		// - youtube.com/v/VIDEO_ID
		// - youtube.com/shorts/VIDEO_ID
		const patterns = [
			/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\\/\s]{11})/,
		];
		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match && match[1]) {
				return match[1];
			}
		}
		return "";
	}

	let videoId = $derived(extractVideoId(src));
	let thumbnailSrc = $derived(videoId ? `https://img.youtube.com/vi/${videoId}/sddefault.jpg` : "");

	function handleFacadeClick() {
		interacted = true;
	}
</script>

{#if src}
	{#if videoId}
		<div
			class="relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black shadow-xl"
		>
			{#if !interacted}
				<button
					type="button"
					onclick={handleFacadeClick}
					aria-label={`Play video: ${title}`}
					class="group absolute inset-0 h-full w-full cursor-pointer border-0 p-0"
				>
					<img
						src={thumbnailSrc}
						alt={`Thumbnail for ${title}`}
						loading="lazy"
						class="h-full w-full object-cover transition-opacity duration-300 group-focus:opacity-100"
					/>
					<div
						class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform"
					>
						<svg
							width="68"
							height="48"
							viewBox="0 0 68 48"
							aria-hidden="true"
							class="opacity-80 transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100"
						>
							<path
								d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"
								fill="#212121"
								fill-opacity="0.8"
							></path>
							<path d="M 45,24 27,14 27,34" fill="#fff"></path>
						</svg>
					</div>
				</button>
			{:else}
				<iframe
					src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
					{title}
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					allowfullscreen
					class="absolute top-0 left-0 h-full w-full border-0"
				></iframe>
			{/if}
		</div>
	{:else}
		<div
			class="bg-neutral-1 text-neutral-content relative mx-auto flex aspect-video w-full max-w-3xl items-center justify-center overflow-hidden rounded-xl p-4 shadow-xl"
		>
			<p class="text-center">Invalid video URL. Please provide a valid YouTube video link.</p>
		</div>
	{/if}
{:else}
	<div
		class="bg-neutral-1 text-neutral-content relative mx-auto flex aspect-video w-full max-w-3xl items-center justify-center overflow-hidden rounded-xl p-4 shadow-xl"
	>
		<p class="text-center">No video source provided.</p>
	</div>
{/if}

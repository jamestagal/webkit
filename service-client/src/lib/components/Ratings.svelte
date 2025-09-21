<!-- @component
- Displays a rating with a count of users who have rated the product.
- All props are optional.
### Usage:
```html
<Ratings rating={4.5} maxRating={5} count={1000} maxAvatarsToShow={4} starSize={22} />
```
-->

<script>
  import UserRound from '@icons/user-round.svelte';
  import { fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { PUBLIC_APP_NAME } from '$env/static/public';

  let {
    rating = 5,
    maxRating = 5,
    count = 1000,
    maxAvatarsToShow = 4,
    starSize = 22,
    avatars = []
  } = $props();

  const starPath = 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

  let clipIdBase = `star-clip-${Math.random().toString(36).slice(2)}-`;

  let remainingCount = tweened(1, { duration: 4000, easing: quintOut });

  onMount(() => {
    if (count > maxAvatarsToShow) {
      setTimeout(() => remainingCount.set(count - maxAvatarsToShow), maxAvatarsToShow * 50);
    }
  });
</script>

<div class="flex flex-row flex-wrap items-center justify-center gap-4">
  <!-- Avatars -->
  {#if count > 0}
    <div class="flex -space-x-2">
      {#each Array(Math.min(maxAvatarsToShow + 1, 5)) as _, i}
        <div class="flex h-12 w-12 items-center justify-center card card-ring !rounded-full text-secondary-3">
          {#if i < maxAvatarsToShow}
            {#if avatars[i]}
              <img src={avatars[i]} alt="Avatar" class="h-5 w-5 rounded-full" />
            {:else}
              <UserRound class="h-5 w-5" />
            {/if}
          {:else}
            <p class="text-xs font-semibold">+{Math.round($remainingCount)}</p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Stars & shimmer container -->
  <div class="flex flex-col gap-1 relative overflow-hidden shimmer-container" in:fade={{ duration: 1500, delay: 500 }}>
    <div class="flex items-center gap-0.5">
      {#each Array(maxRating) as _, i}
        {@const fill = Math.max(0, Math.min(1, rating - i))}
        {@const clipId = `${clipIdBase}${i}`}
        <svg
          width={starSize} height={starSize} viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <clipPath id={clipId}>
              <rect width={fill * 24} height="24" />
            </clipPath>
          </defs>
          <path d={starPath} fill="none" stroke="currentColor" class="text-amber-300" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d={starPath} fill="currentColor" class="text-amber-400" clip-path={`url(#${clipId})`} />
        </svg>
      {/each}

      <span class="ml-1.5 text-sm text-secondary-3 font-bold" in:fade={{ duration: 2000, delay: 500 }}>
        {rating.toFixed(1)} / {maxRating}
      </span>
    </div>

    <p class="text-xs font-bold">{count} Developers already ship with {PUBLIC_APP_NAME}</p>
  </div>
</div>

<style>
  .shimmer-container::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.7;
    background: linear-gradient(120deg, transparent 30%, var(--primary) 50%, transparent 70%);
    width: 200%;
    height: 100%;
    transform: translateX(-100%) skewX(-20deg);
    animation: shimmer 4s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes shimmer {
    to { transform: translateX(100%) skewX(-20deg); }
  }
</style>

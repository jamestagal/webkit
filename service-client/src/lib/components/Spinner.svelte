<script>
    import CircleLoader from '@icons/loader-circle.svelte';
    let { size = 20 } = $props();
</script>

<div class="flex items-center justify-center">
    <CircleLoader size={size} class="flex-shrink-0 animate-spin" />
</div>
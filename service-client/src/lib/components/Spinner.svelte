<script>
	import { Loader2 } from "lucide-svelte";
	let { size = 20 } = $props();
</script>

<div class="flex items-center justify-center">
	<Loader2 {size} class="flex-shrink-0 animate-spin" />
</div>

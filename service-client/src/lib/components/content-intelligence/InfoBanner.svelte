<script lang="ts">
	import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-svelte';

	type Variant = 'purple' | 'emerald' | 'amber';

	let { variant, label }: { variant: Variant; label: string } = $props();

	const styles: Record<Variant, { bg: string; border: string; text: string }> = {
		purple: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-600' },
		emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600' },
		amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600' }
	};

	let s = $derived(styles[variant]);
</script>

<div class="rounded-lg px-3 py-2 mb-4 border {s.bg} {s.border}">
	<div class="text-xs font-medium flex items-center gap-1.5 {s.text}">
		{#if variant === 'purple'}
			<Sparkles size={12} />
		{:else if variant === 'emerald'}
			<CheckCircle2 size={12} />
		{:else}
			<AlertCircle size={12} />
		{/if}
		{label}
	</div>
</div>

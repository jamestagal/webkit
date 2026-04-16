<script lang="ts">
	import type { ModuleStatus } from '$lib/types/content-intelligence';

	let { status }: { status: ModuleStatus } = $props();

	const config: Record<ModuleStatus, { label: string; bg: string; text: string; border: string }> = {
		complete: { label: 'Complete', bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
		running: { label: 'Running...', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
		ready: { label: 'Ready', bg: 'bg-info/10', text: 'text-info', border: 'border-info/30' },
		not_started: { label: 'Not started', bg: 'bg-base-200', text: 'text-base-content/50', border: 'border-base-300' },
		partial: { label: 'Partial', bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' }
	};

	let c = $derived(config[status] ?? config.not_started);
</script>

<span class="text-xs font-medium px-2 py-0.5 rounded-full border {c.bg} {c.text} {c.border}">
	{c.label}
</span>

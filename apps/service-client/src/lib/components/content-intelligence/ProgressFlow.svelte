<script lang="ts">
	import { CheckCircle2, Clock } from 'lucide-svelte';
	import type { ProgressStep } from '$lib/types/content-intelligence';

	let { steps }: { steps: ProgressStep[] } = $props();
</script>

<div class="flex items-center gap-1 flex-wrap">
	{#each steps as step, i}
		<div class="flex items-center gap-1">
			<div class="flex items-center gap-1.5">
				{#if step.done}
					<CheckCircle2 size={14} class="text-success" />
				{:else if step.active}
					<Clock size={14} class="text-warning" />
				{:else}
					<div class="w-3.5 h-3.5 rounded-full border-2 border-base-300"></div>
				{/if}
				<span
					class="text-xs {step.done
						? 'text-success font-medium'
						: step.active
							? 'text-warning font-medium'
							: 'text-base-content/40'}"
				>
					{step.label}
				</span>
			</div>
			{#if i < steps.length - 1}
				<div class="w-6 h-px {step.done ? 'bg-success/40' : 'bg-base-200'}"></div>
			{/if}
		</div>
	{/each}
</div>

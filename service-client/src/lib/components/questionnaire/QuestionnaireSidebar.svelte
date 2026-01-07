<script lang="ts">
	import { Check, Circle } from 'lucide-svelte';

	interface Section {
		id: number;
		title: string;
		shortTitle: string;
	}

	interface Props {
		sections: Section[];
		currentSection: number;
		sectionCompletion: boolean[];
		completionPercentage: number;
		onSectionClick: (sectionId: number) => void;
	}

	let { sections, currentSection, sectionCompletion, completionPercentage, onSectionClick }: Props = $props();

	let completedCount = $derived(sectionCompletion.filter(Boolean).length);
</script>

<div class="card bg-base-200 sticky top-4">
	<div class="card-body p-4">
		<!-- Progress -->
		<div class="mb-4">
			<div class="flex justify-between text-sm mb-2">
				<span class="text-base-content/70">Progress</span>
				<span class="font-medium">{completionPercentage}%</span>
			</div>
			<progress class="progress progress-primary w-full" value={completionPercentage} max="100"></progress>
		</div>

		<!-- Section List -->
		<nav class="space-y-1">
			{#each sections as section (section.id)}
				{@const isActive = currentSection === section.id}
				{@const isComplete = sectionCompletion[section.id]}
				<button
					type="button"
					class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
						{isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}"
					onclick={() => onSectionClick(section.id)}
				>
					<!-- Status Icon -->
					<span class="flex-shrink-0 w-5 h-5 flex items-center justify-center">
						{#if isComplete}
							<span class="text-success {isActive ? 'text-primary-content' : ''}">
								<Check class="h-4 w-4" />
							</span>
						{:else if isActive}
							<Circle class="h-4 w-4 fill-current" />
						{:else}
							<Circle class="h-4 w-4 text-base-content/30" />
						{/if}
					</span>

					<!-- Section Info -->
					<span class="flex-1 min-w-0">
						<span class="block text-sm font-medium truncate {isActive ? '' : 'text-base-content'}">
							{section.shortTitle}
						</span>
					</span>

					<!-- Section Number -->
					<span class="flex-shrink-0 text-xs {isActive ? 'text-primary-content/70' : 'text-base-content/50'}">
						{section.id + 1}
					</span>
				</button>
			{/each}
		</nav>

		<!-- Completion Status -->
		<div class="mt-4 pt-4 border-t border-base-300">
			<div class="text-sm text-base-content/70 text-center">
				{completedCount} of {sections.length} sections complete
			</div>
		</div>
	</div>
</div>

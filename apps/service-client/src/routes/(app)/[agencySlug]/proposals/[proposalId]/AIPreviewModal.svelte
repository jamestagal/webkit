<script lang="ts">
	import { diffWords } from 'diff';
	import type { AIProposalOutput } from '$lib/types/ai-proposal';
	import { SECTION_DISPLAY_NAMES } from '$lib/constants/proposal-sections';

	// Current content uses schema types which differ slightly from AI types
	// We use a flexible type since it's only used for diff comparison
	type CurrentContent = Record<string, string | unknown[] | object | undefined>;

	interface Props {
		isOpen: boolean;
		generatedContent: AIProposalOutput | null;
		currentContent: CurrentContent;
		selectedSections: string[];
		onapply?: (detail: { sections: string[] }) => void;
		ondiscard?: () => void;
		onclose?: () => void; // Called when modal closed (keeps content for re-open)
	}

	let {
		isOpen,
		generatedContent,
		currentContent,
		selectedSections,
		onapply,
		ondiscard,
		onclose
	}: Props = $props();

	let sectionsToApply = $state(new Set(selectedSections));

	// Reset sections to apply when selectedSections changes
	$effect(() => {
		sectionsToApply = new Set(selectedSections);
	});

	// Format section name for display
	function formatSectionName(key: string): string {
		return (
			SECTION_DISPLAY_NAMES[key] ||
			key
				.replace(/([A-Z])/g, ' $1')
				.replace(/^./, (str) => str.toUpperCase())
				.trim()
		);
	}

	// Check if content actually changed
	function hasChanges(section: string): boolean {
		const current = currentContent[section];
		const generated = generatedContent?.[section as keyof AIProposalOutput];
		return JSON.stringify(current) !== JSON.stringify(generated);
	}

	// Generate diff for text content
	function getDiff(
		current: string | undefined,
		generated: string | undefined
	): Array<{ value: string; added?: boolean; removed?: boolean }> {
		if (!current && generated) {
			return [{ value: generated, added: true }];
		}
		if (current && !generated) {
			return [{ value: current, removed: true }];
		}
		if (!current && !generated) {
			return [];
		}
		return diffWords(current || '', generated || '');
	}

	function toggleSection(section: string) {
		if (sectionsToApply.has(section)) {
			sectionsToApply.delete(section);
		} else {
			sectionsToApply.add(section);
		}
		sectionsToApply = new Set(sectionsToApply); // Trigger reactivity
	}

	function applySelected() {
		onapply?.({ sections: Array.from(sectionsToApply) });
	}

	function selectAll() {
		sectionsToApply = new Set(selectedSections);
	}
</script>

{#if isOpen && generatedContent}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-5xl max-h-[90vh] flex flex-col">
			<h3 class="font-bold text-lg flex items-center gap-2">
				<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
					/>
				</svg>
				Review AI Generated Content
			</h3>

			<p class="text-sm text-base-content/70 mt-2">
				Select which sections to apply. Unchecked sections will keep their current content.
			</p>

			<div class="divider my-2"></div>

			<div class="overflow-y-auto flex-1 space-y-4">
				{#each selectedSections as section}
					{@const sectionKey = section as keyof AIProposalOutput}
					{#if generatedContent[sectionKey] !== undefined}
						<div class="border rounded-lg overflow-hidden">
							<!-- Section header -->
							<div class="bg-base-200 px-4 py-2 flex items-center justify-between">
								<label class="flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										class="checkbox checkbox-primary checkbox-sm"
										checked={sectionsToApply.has(section)}
										onchange={() => toggleSection(section)}
									/>
									<span class="font-medium">{formatSectionName(section)}</span>
								</label>

								{#if !hasChanges(section)}
									<span class="badge badge-ghost badge-sm">No changes</span>
								{:else if !currentContent[sectionKey]}
									<span class="badge badge-success badge-sm">New content</span>
								{:else}
									<span class="badge badge-warning badge-sm">Modified</span>
								{/if}
							</div>

							<!-- Content preview -->
							<div class="p-4">
								{#if typeof generatedContent[sectionKey] === 'string'}
									{@const currentStr = currentContent[sectionKey] as string | undefined}
									{@const generatedStr = generatedContent[sectionKey] as string}
									<!-- Text diff view -->
									<div class="prose prose-sm max-w-none">
										{#each getDiff(currentStr, generatedStr) as part}
											<span
												class:bg-red-100={part.removed}
												class:text-red-800={part.removed}
												class:line-through={part.removed}
												class:bg-green-100={part.added}
												class:text-green-800={part.added}>{part.value}</span
											>
										{/each}
									</div>
								{:else if Array.isArray(generatedContent[sectionKey])}
									<!-- Array content (issues, pages, timeline, etc.) -->
									<div class="space-y-2">
										{#each generatedContent[sectionKey] as item}
											<div class="bg-base-200/50 rounded p-2 text-sm">
												{#if 'title' in item && item.title}
													<strong>{item.title}</strong>
													{#if 'description' in item && item.description}
														<p class="text-base-content/70 mt-1">{item.description}</p>
													{/if}
												{:else if 'metric' in item && item.metric}
													<strong>{item.metric}</strong>
													{#if 'current' in item && 'target' in item}
														<span class="text-base-content/70">
															: {item.current} → {item.target}
														</span>
													{/if}
													{#if 'improvement' in item && item.improvement}
														<p class="text-base-content/70 text-xs mt-1">{item.improvement}</p>
													{/if}
												{:else if 'name' in item && item.name}
													<strong>{item.name}</strong>
													{#if 'purpose' in item && item.purpose}
														<span class="text-base-content/70"> — {item.purpose}</span>
													{/if}
												{:else if 'phase' in item && item.phase}
													<strong>{item.phase}</strong>
													{#if 'duration' in item}
														<span class="text-base-content/70"> ({item.duration})</span>
													{/if}
												{:else if 'action' in item && item.action}
													<strong>{'order' in item ? item.order + '. ' : ''}{item.action}</strong>
												{:else}
													<pre class="text-xs">{JSON.stringify(item, null, 2)}</pre>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<!-- Object content (ROI, etc.) -->
									<pre class="text-xs bg-base-200 rounded p-2 overflow-x-auto">{JSON.stringify(generatedContent[sectionKey], null, 2)}</pre>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>

			<div class="divider my-2"></div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => ondiscard?.()}> Discard All </button>
				<button class="btn btn-outline" onclick={selectAll}> Select All </button>
				<button class="btn btn-primary" onclick={applySelected} disabled={sectionsToApply.size === 0}>
					Apply {sectionsToApply.size} Section{sectionsToApply.size !== 1 ? 's' : ''}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => onclose?.()}>close</button>
		</form>
	</dialog>
{/if}

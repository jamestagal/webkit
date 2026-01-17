<script lang="ts">
	/**
	 * AI Streaming Generation Modal
	 *
	 * Shows real-time streaming output from Claude as content is generated.
	 * Displays raw JSON text as it streams, then hands off to preview modal when done.
	 */

	import { browser } from '$app/environment';
	import { Sparkles, AlertTriangle, RefreshCw } from 'lucide-svelte';
	import type { AIProposalOutput } from '$lib/types/ai-proposal';
	import type { AIErrorCode } from '$lib/constants/ai-errors';

	interface Props {
		proposalId: string;
		sections: string[];
		onComplete: (
			content: AIProposalOutput,
			transformed: Record<string, unknown>,
			generatedSections: string[],
			failedSections: string[],
			performanceData: Record<string, unknown> | null
		) => void;
		onError: (code: AIErrorCode, message: string) => void;
		onCancel: () => void;
	}

	let { proposalId, sections, onComplete, onError, onCancel }: Props = $props();

	let streamingText = $state('');
	let isStreaming = $state(true);
	let error = $state<{ code: string; message: string } | null>(null);
	let abortController: AbortController | null = null;

	// Start streaming immediately when component mounts (browser only)
	$effect(() => {
		if (!browser) return;

		startStreaming();

		return () => {
			// Cleanup on unmount
			if (abortController) {
				abortController.abort();
			}
		};
	});

	async function startStreaming() {
		isStreaming = true;
		streamingText = '';
		error = null;

		abortController = new AbortController();

		try {
			const response = await fetch(`/api/proposals/${proposalId}/generate-stream`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ sections }),
				signal: abortController.signal
			});

			if (!response.ok) {
				const errorData = await response.json();
				const errorCode = errorData.code || 'UNKNOWN';
				const errorMessage = errorData.error || 'Generation failed';
				error = { code: errorCode, message: errorMessage };
				isStreaming = false;
				onError(errorCode, errorMessage);
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('No response body');
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Parse SSE events from buffer
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep incomplete line in buffer

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const event = JSON.parse(line.slice(6));

							if (event.type === 'chunk') {
								streamingText += event.text;
							} else if (event.type === 'done') {
								isStreaming = false;
								onComplete(
									event.content,
									event.transformed || {},
									event.generatedSections,
									event.failedSections,
									event.performanceData || null
								);
								return;
							} else if (event.type === 'error') {
								error = { code: event.code, message: event.message };
								isStreaming = false;
								onError(event.code, event.message);
								return;
							}
						} catch {
							// Ignore parse errors for incomplete JSON
						}
					}
				}
			}
		} catch (err) {
			if ((err as Error).name !== 'AbortError') {
				const errorMessage = err instanceof Error ? err.message : 'Network error';
				error = { code: 'NETWORK', message: errorMessage };
				onError('UNKNOWN' as AIErrorCode, errorMessage);
			}
			isStreaming = false;
		}
	}

	function handleCancel() {
		if (abortController) {
			abortController.abort();
		}
		onCancel();
	}

	function handleRetry() {
		startStreaming();
	}
</script>

<dialog class="modal modal-open">
	<div class="modal-box max-w-2xl">
		<h3 class="font-bold text-lg flex items-center gap-2">
			<Sparkles class="h-5 w-5 text-secondary" />
			{isStreaming ? 'Generating Content...' : error ? 'Generation Failed' : 'Complete'}
		</h3>

		{#if error}
			<!-- Error state -->
			<div class="mt-4">
				<div class="alert alert-error">
					<AlertTriangle class="h-5 w-5" />
					<div>
						<div class="font-medium">Error: {error.code}</div>
						<div class="text-sm">{error.message}</div>
					</div>
				</div>

				<div class="mt-4 flex justify-end gap-2">
					<button type="button" class="btn btn-ghost" onclick={handleCancel}>
						Cancel
					</button>
					<button type="button" class="btn btn-primary" onclick={handleRetry}>
						<RefreshCw class="h-4 w-4" />
						Retry
					</button>
				</div>
			</div>
		{:else}
			<!-- Streaming state -->
			<div class="mt-4">
				<div class="flex items-center gap-2 text-sm text-base-content/70 mb-2">
					{#if isStreaming}
						<span class="loading loading-dots loading-sm"></span>
						<span>AI is generating your proposal content...</span>
					{:else}
						<span>Processing complete</span>
					{/if}
				</div>

				<!-- Streaming text output -->
				<div
					class="bg-base-200 rounded-lg p-4 font-mono text-xs max-h-80 overflow-y-auto"
					style="white-space: pre-wrap; word-break: break-word;"
				>
					{#if streamingText}
						{streamingText}
						{#if isStreaming}
							<span class="animate-pulse">▊</span>
						{/if}
					{:else if isStreaming}
						<span class="text-base-content/50">Waiting for response...</span>
					{/if}
				</div>

				{#if isStreaming}
					<div class="mt-4 flex justify-end">
						<button type="button" class="btn btn-ghost btn-sm" onclick={handleCancel}>
							Cancel
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="button" onclick={handleCancel}>close</button>
	</form>
</dialog>

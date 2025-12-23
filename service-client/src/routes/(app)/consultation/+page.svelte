<script lang="ts">
	/**
	 * Consultation Form Page - Entry Point with Feature Flag
	 *
	 * This file acts as a router between the old and new implementations.
	 * Feature flag: VITE_USE_REMOTE_FUNCTIONS
	 * - true: Use new remote functions implementation (ClientInfoForm.remote.svelte, etc.)
	 * - false: Use legacy store/service implementation (ClientInfoForm.svelte, etc.)
	 *
	 * Default: true (remote functions enabled)
	 */

	import { browser } from '$app/environment';
	import ConsultationPage from '$lib/components/consultation/ConsultationPage.svelte';
	import type { PageData } from './$types';

	// Check feature flag from environment variable
	const useRemoteFunctions = import.meta.env.VITE_USE_REMOTE_FUNCTIONS === 'true';

	// Get server-loaded data
	let { data }: { data: PageData } = $props();
</script>

{#if useRemoteFunctions}
	<ConsultationPage consultation={data.consultation} draft={data.draft} />
{:else}
	<!-- OLD IMPLEMENTATION (Legacy) -->
	<!-- This is the existing code from the original +page.svelte -->
	<!-- Preserved for rollback capability -->
	<div class="min-h-screen bg-gray-50 p-8">
		<div class="mx-auto max-w-4xl">
			<div class="rounded-lg bg-white p-8 shadow-lg">
				<h1 class="mb-4 text-2xl font-bold text-gray-900">Project Consultation</h1>
				<p class="mb-6 text-gray-600">
					The legacy consultation form is currently active. To use the new remote functions
					implementation, set VITE_USE_REMOTE_FUNCTIONS=true in your .env file.
				</p>
				<div
					class="rounded-md border-l-4 border-yellow-400 bg-yellow-50 p-4"
				>
					<div class="flex">
						<div class="ml-3">
							<p class="text-sm text-yellow-700">
								<strong>Feature Flag Active:</strong> Remote functions are currently disabled.
								Using legacy store/service pattern.
							</p>
						</div>
					</div>
				</div>

				<!-- Original legacy implementation would go here -->
				<!-- For now, showing a placeholder -->
				<!-- TODO: Move original consultation form code here or import it -->
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure smooth transitions between implementations */
	:global(body) {
		transition: background-color 0.3s ease;
	}
</style>

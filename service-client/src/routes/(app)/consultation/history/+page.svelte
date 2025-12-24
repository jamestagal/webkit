<script lang="ts">
	import { goto } from '$app/navigation';
	import { getUserConsultations } from '$lib/api/consultation.remote';
	import Button from '$lib/components/Button.svelte';

	// Load consultations using remote function
	const consultations = await getUserConsultations();

	function formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		const d = new Date(date);
		const datePart = d.toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
		const timePart = d.toLocaleTimeString('en-AU', {
			hour: '2-digit',
			minute: '2-digit'
		});
		return `${datePart}, ${timePart}`;
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'bg-green-100 text-green-800';
			case 'draft':
				return 'bg-yellow-100 text-yellow-800';
			case 'in_review':
				return 'bg-blue-100 text-blue-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function viewConsultation(id: string) {
		goto(`/consultation/view/${id}`);
	}

	function editConsultation(id: string) {
		goto(`/consultation/edit/${id}`);
	}

	function startNewConsultation() {
		goto('/consultation');
	}
</script>

<svelte:head>
	<title>My Consultations | PropGen</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">My Consultations</h1>
				<p class="mt-2 text-gray-600">View and manage your consultation submissions</p>
			</div>
			<Button variant="primary" onclick={startNewConsultation}>
				<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New Consultation
			</Button>
		</div>

		<!-- Consultations List -->
		{#if consultations.length === 0}
			<div class="rounded-lg bg-white p-12 text-center shadow">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900">No consultations yet</h3>
				<p class="mt-2 text-gray-500">Get started by creating your first consultation.</p>
				<div class="mt-6">
					<Button variant="primary" onclick={startNewConsultation}>Start New Consultation</Button>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				{#each consultations as consultation}
					<div class="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3">
									<h3 class="text-lg font-semibold text-gray-900">
										{consultation.contactInfo?.business_name || 'Untitled Consultation'}
									</h3>
									<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getStatusBadgeClass(consultation.status)}">
										{consultation.status === 'completed' ? 'Completed' : consultation.status === 'draft' ? 'Draft' : consultation.status}
									</span>
								</div>

								<div class="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
									<div>
										<span class="font-medium">Contact:</span>
										{consultation.contactInfo?.contact_person || 'N/A'}
									</div>
									<div>
										<span class="font-medium">Industry:</span>
										{consultation.businessContext?.industry || 'N/A'}
									</div>
									<div>
										<span class="font-medium">Created:</span>
										{formatDate(consultation.createdAt)}
									</div>
									<div>
										<span class="font-medium">Last Updated:</span>
										{formatDate(consultation.updatedAt)}
									</div>
								</div>

								<!-- Progress Bar -->
								<div class="mt-4">
									<div class="flex items-center justify-between text-xs text-gray-500">
										<span>Completion</span>
										<span>{consultation.completionPercentage}%</span>
									</div>
									<div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
										<div
											class="h-full rounded-full transition-all duration-300 {consultation.status === 'completed' ? 'bg-green-500' : 'bg-indigo-600'}"
											style="width: {consultation.completionPercentage}%"
										></div>
									</div>
								</div>
							</div>

							<!-- Actions -->
							<div class="ml-6 flex flex-col gap-2">
								<Button variant="outline" size="xs" onclick={() => viewConsultation(consultation.id)}>
									<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
									</svg>
									View
								</Button>
								<Button variant="primary" size="xs" onclick={() => editConsultation(consultation.id)}>
									<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
									{consultation.status === 'draft' ? 'Continue' : 'Edit'}
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Back Link -->
		<div class="mt-8 text-center">
			<a href="/" class="text-sm text-indigo-600 hover:text-indigo-800">
				Back to Dashboard
			</a>
		</div>
	</div>
</div>

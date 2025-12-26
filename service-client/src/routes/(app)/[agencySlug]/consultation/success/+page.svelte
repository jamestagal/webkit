<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';

	let agencySlug = $derived(page.params.agencySlug);

	function goToDashboard() {
		goto(`/${agencySlug}`);
	}

	function viewConsultations() {
		goto(`/${agencySlug}/consultation/history`);
	}

	function startNewConsultation() {
		goto(`/${agencySlug}/consultation`);
	}
</script>

<svelte:head>
	<title>Consultation Complete</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="mx-4 w-full max-w-md">
		<!-- Success Animation -->
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-content"
			>
				<svg class="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
		</div>

		<!-- Success Content -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body text-center">
				<h1 class="card-title justify-center text-2xl">Consultation Complete!</h1>

				<p class="text-base-content/70">
					Thank you for taking the time to share your project details with us. We've received your
					consultation and our team will review it carefully.
				</p>

				<div class="alert alert-info mt-4">
					<div>
						<h3 class="font-medium">What happens next?</h3>
						<ul class="mt-2 space-y-1 text-left text-sm">
							<li>Our team reviews your consultation within 24 hours</li>
							<li>We'll prepare a customized proposal based on your needs</li>
							<li>You'll receive an email with next steps and timeline</li>
						</ul>
					</div>
				</div>

				<div class="card-actions mt-6 flex-col gap-2">
					<Button variant="primary" onclick={goToDashboard} full>Go to Dashboard</Button>
					<Button variant="outline" onclick={viewConsultations} full>View My Consultations</Button>
				</div>
			</div>
		</div>

		<!-- Additional Actions -->
		<div class="mt-6 text-center">
			<p class="mb-3 text-sm text-base-content/60">Need to make changes?</p>
			<button onclick={startNewConsultation} class="link link-primary text-sm">
				Start New Consultation
			</button>
		</div>
	</div>
</div>

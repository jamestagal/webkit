<script lang="ts">
	import { goto } from "$app/navigation";
	import Button from "$lib/components/Button.svelte";

	function goToDashboard() {
		goto("/");
	}

	function viewConsultations() {
		goto("/consultation/history");
	}
</script>

<svelte:head>
	<title>Consultation Complete | PropGen</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50"
>
	<div class="mx-4 w-full max-w-md">
		<!-- Success Animation -->
		<div class="mb-8 text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-green-500"
			>
				<svg class="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
		</div>

		<!-- Success Content -->
		<div class="rounded-lg bg-white p-8 text-center shadow-lg">
			<h1 class="mb-4 text-2xl font-bold text-gray-900">Consultation Complete!</h1>

			<p class="mb-6 text-gray-600">
				Thank you for taking the time to share your project details with us. We've received your
				consultation and our team will review it carefully.
			</p>

			<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
				<h3 class="mb-2 font-medium text-blue-900">What happens next?</h3>
				<ul class="space-y-1 text-left text-sm text-blue-800">
					<li>✓ Our team reviews your consultation within 24 hours</li>
					<li>✓ We'll prepare a customized proposal based on your needs</li>
					<li>✓ You'll receive an email with next steps and timeline</li>
					<li>✓ We'll schedule a follow-up call to discuss details</li>
				</ul>
			</div>

			<div class="space-y-3">
				<Button variant="primary" onclick={goToDashboard} full>Go to Dashboard</Button>
				<Button variant="outline" onclick={viewConsultations} full>View My Consultations</Button>
			</div>
		</div>

		<!-- Additional Actions -->
		<div class="mt-6 text-center">
			<p class="mb-3 text-sm text-gray-600">Need to make changes or have questions?</p>
			<div class="flex justify-center space-x-4 text-sm">
				<a href="/consultation" class="text-indigo-600 hover:text-indigo-800">
					Start New Consultation
				</a>
				<span class="text-gray-300">|</span>
				<a href="/contact" class="text-indigo-600 hover:text-indigo-800">Contact Support</a>
			</div>
		</div>
	</div>
</div>

<style>
	/* Success animation */
	@keyframes bounce-in {
		0% {
			transform: scale(0.3);
			opacity: 0;
		}
		50% {
			transform: scale(1.05);
		}
		70% {
			transform: scale(0.9);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.animate-bounce-in {
		animation: bounce-in 0.6s ease-out;
	}
</style>

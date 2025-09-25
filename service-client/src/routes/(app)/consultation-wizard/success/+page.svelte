<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';

  let countdown = 10;

  onMount(() => {
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        goto('/dashboard');
      }
    }, 1000);

    return () => clearInterval(timer);
  });

  function goToDashboard() {
    goto('/dashboard');
  }
</script>

<svelte:head>
  <title>Consultation Complete | PropGen</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
  <div class="max-w-md w-full mx-4">
    <!-- Success Animation -->
    <div class="text-center mb-8">
      <div class="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>

    <!-- Success Content -->
    <div class="bg-white rounded-lg shadow-lg p-8 text-center">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">
        Consultation Complete!
      </h1>

      <p class="text-gray-600 mb-6">
        Thank you for taking the time to share your project details with us.
        We've received your consultation and our team will review it carefully.
      </p>

      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 class="font-medium text-blue-900 mb-2">What happens next?</h3>
        <ul class="text-sm text-blue-800 text-left space-y-1">
          <li>✓ Our team reviews your consultation within 24 hours</li>
          <li>✓ We'll prepare a customized proposal based on your needs</li>
          <li>✓ You'll receive an email with next steps and timeline</li>
          <li>✓ We'll schedule a follow-up call to discuss details</li>
        </ul>
      </div>

      <div class="space-y-4">
        <Button variant="primary" onclick={goToDashboard} class="w-full">
          Go to Dashboard
        </Button>

        <p class="text-sm text-gray-500">
          Redirecting automatically in {countdown} seconds...
        </p>
      </div>
    </div>

    <!-- Additional Actions -->
    <div class="mt-6 text-center">
      <p class="text-sm text-gray-600 mb-3">
        Need to make changes or have questions?
      </p>
      <div class="flex justify-center space-x-4 text-sm">
        <a href="/consultation" class="text-indigo-600 hover:text-indigo-800">
          Start New Consultation
        </a>
        <span class="text-gray-300">|</span>
        <a href="/contact" class="text-indigo-600 hover:text-indigo-800">
          Contact Support
        </a>
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
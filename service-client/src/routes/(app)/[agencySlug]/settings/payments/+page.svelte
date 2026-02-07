<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import {
		CreditCard,
		CheckCircle,
		AlertTriangle,
		ExternalLink,
		Unlink,
		RefreshCw
	} from 'lucide-svelte';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const toast = getToast();
	let agencySlug = $derived(data.agency.slug);
	let stripeStatus = $derived(data.stripeStatus);

	// Detect test vs live mode from publishable key
	let isTestMode = $derived(
		env['PUBLIC_STRIPE_PUBLISHABLE_KEY']?.startsWith('pk_test_') ?? true
	);

	// Deep link to connected account dashboard
	let dashboardUrl = $derived(
		stripeStatus.accountId
			? `https://dashboard.stripe.com/${isTestMode ? 'test/' : ''}connect/accounts/${stripeStatus.accountId}`
			: 'https://dashboard.stripe.com'
	);

	// Check URL params for success/error messages
	let connected = $derived(page.url.searchParams.get('connected') === 'true');
	let error = $derived(page.url.searchParams.get('error'));
	let needsRefresh = $derived(data.needsRefresh);

	let isDisconnecting = $state(false);
	let isConnecting = $state(false);
	let showDisconnectConfirm = $state(false);

	// Show toast for connection success
	$effect(() => {
		if (connected) {
			toast.success('Stripe account connected successfully!');
			// Clear the URL param
			history.replaceState(null, '', `/${agencySlug}/settings/payments`);
		}
		if (error) {
			const errorMessages: Record<string, string> = {
				access_denied: 'Stripe connection was cancelled',
				permission_denied: 'Only agency owners can connect Stripe',
				session_expired: 'Session expired. Please try again.',
				invalid_state: 'Invalid session. Please try again.',
				connection_failed: 'Failed to connect Stripe account. Please try again.'
			};
			toast.error(errorMessages[error] || `Error: ${error}`);
			// Clear the URL param
			history.replaceState(null, '', `/${agencySlug}/settings/payments`);
		}
	});

	// Auto-resume onboarding if coming back with refresh param
	$effect(() => {
		if (needsRefresh && !isConnecting) {
			// Clear URL and trigger connect
			history.replaceState(null, '', `/${agencySlug}/settings/payments`);
			toast.info('Resuming Stripe setup...');
			// Submit the connect form programmatically
			const form = document.querySelector('form[action="?/connect"]') as HTMLFormElement;
			if (form) {
				form.requestSubmit();
			}
		}
	});
</script>

<svelte:head>
	<title>Payment Settings | {data.agency.name}</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Payment Settings</h1>
		<p class="text-base-content/70 mt-1">
			Connect your Stripe account to accept online payments for invoices
		</p>
	</div>

	<!-- Test Mode Banner -->
	{#if isTestMode}
		<div class="alert alert-warning">
			<AlertTriangle class="h-5 w-5" />
			<div>
				<h3 class="font-bold">Test Mode</h3>
				<p class="text-sm">
					Payments will not be processed for real. Use test cards like 4242 4242 4242 4242.
				</p>
			</div>
		</div>
	{/if}

	<!-- Stripe Connection Status -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">
				<CreditCard class="h-5 w-5" />
				Stripe Connect
			</h2>

			{#if stripeStatus.status === 'not_configured'}
				<!-- Stripe Not Configured -->
				<div class="mt-4">
					<div class="alert alert-warning">
						<AlertTriangle class="h-5 w-5" />
						<div>
							<h3 class="font-bold">Stripe Not Configured</h3>
							<p class="text-sm">
								The Stripe API keys are not configured for this environment.
								Please contact your administrator to set up Stripe integration.
							</p>
						</div>
					</div>
					<div class="mt-4 text-sm text-base-content/60">
						<p>Required environment variables: <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>, <code>PUBLIC_STRIPE_PUBLISHABLE_KEY</code></p>
					</div>
				</div>
			{:else if !stripeStatus.connected}
				<!-- Not Connected -->
				<div class="mt-4">
					<p class="text-base-content/70">
						Connect your Stripe account to start accepting card payments for your invoices.
						Your clients will be able to pay directly from the invoice page.
					</p>

					<div class="mt-6">
						<form
							method="POST"
							action="?/connect"
							use:enhance={() => {
								isConnecting = true;
								return async ({ result }) => {
									isConnecting = false;
									if (result.type === 'success' && result.data?.['redirectUrl']) {
										// Redirect to Stripe onboarding
										window.location.href = result.data['redirectUrl'] as string;
									} else if (result.type === 'failure') {
										toast.error(result.data?.['error'] as string || 'Failed to connect Stripe');
									}
								};
							}}
						>
							<button type="submit" class="btn btn-primary" disabled={isConnecting}>
								{#if isConnecting}
									<span class="loading loading-spinner loading-sm"></span>
								{:else}
									<CreditCard class="h-4 w-4" />
								{/if}
								Connect Stripe Account
							</button>
						</form>
					</div>

					<div class="mt-4 text-sm text-base-content/60">
						<p>You'll be redirected to Stripe to complete the setup. This typically takes 2-3 minutes.</p>
					</div>
				</div>
			{:else}
				<!-- Connected -->
				<div class="mt-4 space-y-4">
					<!-- Connection Status -->
					<div class="flex items-center gap-2">
						{#if stripeStatus.status === 'active'}
							<div class="badge badge-success gap-1">
								<CheckCircle class="h-3 w-3" />
								Connected
							</div>
						{:else if stripeStatus.status === 'restricted'}
							<div class="badge badge-warning gap-1">
								<AlertTriangle class="h-3 w-3" />
								Action Required
							</div>
						{:else if stripeStatus.status === 'disabled'}
							<div class="badge badge-error gap-1">
								<AlertTriangle class="h-3 w-3" />
								Disabled
							</div>
						{/if}
					</div>

					<!-- Account Details -->
					<div class="bg-base-200/50 p-4 rounded-lg space-y-2">
						<div class="flex items-center justify-between text-sm">
							<span class="text-base-content/70">Account ID</span>
							<code class="bg-base-300 px-2 py-0.5 rounded text-xs">
								{stripeStatus.accountId}
							</code>
						</div>

						{#if stripeStatus.connectedAt}
							<div class="flex items-center justify-between text-sm">
								<span class="text-base-content/70">Connected</span>
								<span>
									{new Date(stripeStatus.connectedAt).toLocaleDateString('en-AU', {
										day: 'numeric',
										month: 'short',
										year: 'numeric'
									})}
								</span>
							</div>
						{/if}

						<div class="flex items-center justify-between text-sm">
							<span class="text-base-content/70">Charges</span>
							{#if stripeStatus.chargesEnabled}
								<span class="text-success">Enabled</span>
							{:else}
								<span class="text-warning">Not enabled</span>
							{/if}
						</div>

						<div class="flex items-center justify-between text-sm">
							<span class="text-base-content/70">Payouts</span>
							{#if stripeStatus.payoutsEnabled}
								<span class="text-success">Enabled</span>
							{:else}
								<span class="text-warning">Not enabled</span>
							{/if}
						</div>
					</div>

					<!-- Charges Not Enabled Warning -->
					{#if !stripeStatus.chargesEnabled}
						<div class="alert alert-warning">
							<AlertTriangle class="h-5 w-5" />
							<div>
								<h3 class="font-bold">Complete Stripe Onboarding</h3>
								<p class="text-sm">
									Your Stripe account needs additional verification before you can accept payments.
									<a href={dashboardUrl} target="_blank" class="link">
										Complete setup in Stripe Dashboard
									</a>
								</p>
							</div>
						</div>
					{/if}

					<!-- Processing Fees Notice -->
					<div class="p-4 bg-base-200/50 rounded-lg">
						<h3 class="font-medium text-sm">Processing Fees</h3>
						<p class="text-sm text-base-content/60 mt-1">
							Stripe charges 1.75% + $0.30 per successful card payment (Australian cards).
							International cards may incur additional fees.
							<a
								href="https://stripe.com/au/pricing"
								target="_blank"
								class="link"
							>
								View full pricing
							</a>
						</p>
					</div>

					<!-- Actions -->
					<div class="flex flex-wrap gap-2 pt-2">
						<a
							href={dashboardUrl}
							target="_blank"
							class="btn btn-outline btn-sm"
						>
							<ExternalLink class="h-4 w-4" />
							Open Stripe Dashboard
						</a>

						<form
							method="POST"
							action="?/refresh"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'success') {
										toast.success('Status refreshed');
									} else if (result.type === 'failure') {
										toast.error(result.data?.['error'] as string || 'Failed to refresh');
									}
									await update();
								};
							}}
							class="inline"
						>
							<button type="submit" class="btn btn-ghost btn-sm">
								<RefreshCw class="h-4 w-4" />
								Refresh Status
							</button>
						</form>

						<button
							type="button"
							class="btn btn-ghost btn-sm text-error"
							onclick={() => (showDisconnectConfirm = true)}
						>
							<Unlink class="h-4 w-4" />
							Disconnect
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- How It Works -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			<h2 class="card-title text-lg">How Online Payments Work</h2>

			<ol class="mt-4 space-y-3 text-sm">
				<li class="flex gap-3">
					<span class="flex-shrink-0 w-6 h-6 bg-primary text-primary-content rounded-full flex items-center justify-center text-xs font-bold">
						1
					</span>
					<span>Connect your Stripe account (one-time setup)</span>
				</li>
				<li class="flex gap-3">
					<span class="flex-shrink-0 w-6 h-6 bg-primary text-primary-content rounded-full flex items-center justify-center text-xs font-bold">
						2
					</span>
					<span>Create and send an invoice to your client</span>
				</li>
				<li class="flex gap-3">
					<span class="flex-shrink-0 w-6 h-6 bg-primary text-primary-content rounded-full flex items-center justify-center text-xs font-bold">
						3
					</span>
					<span>Generate a payment link for the invoice</span>
				</li>
				<li class="flex gap-3">
					<span class="flex-shrink-0 w-6 h-6 bg-primary text-primary-content rounded-full flex items-center justify-center text-xs font-bold">
						4
					</span>
					<span>Client clicks "Pay Now" and pays securely via Stripe</span>
				</li>
				<li class="flex gap-3">
					<span class="flex-shrink-0 w-6 h-6 bg-primary text-primary-content rounded-full flex items-center justify-center text-xs font-bold">
						5
					</span>
					<span>Invoice is automatically marked as paid</span>
				</li>
			</ol>
		</div>
	</div>
</div>

<!-- Disconnect Confirmation Modal -->
{#if showDisconnectConfirm}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">Disconnect Stripe?</h3>
			<p class="py-4 text-base-content/70">
				This will remove your Stripe connection. All existing payment links will be deactivated.
				Your clients will no longer be able to pay invoices online until you reconnect.
			</p>
			<p class="text-sm text-base-content/60">
				Your Stripe account and payment history remain intact - only the connection to this platform is removed.
			</p>
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => (showDisconnectConfirm = false)}
					disabled={isDisconnecting}
				>
					Cancel
				</button>
				<form
					method="POST"
					action="?/disconnect"
					use:enhance={() => {
						isDisconnecting = true;
						return async ({ result, update }) => {
							isDisconnecting = false;
							showDisconnectConfirm = false;
							if (result.type === 'success') {
								toast.success('Stripe account disconnected');
							} else {
								toast.error('Failed to disconnect Stripe');
							}
							await update();
						};
					}}
				>
					<button
						type="submit"
						class="btn btn-error"
						disabled={isDisconnecting}
					>
						{#if isDisconnecting}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Disconnect
					</button>
				</form>
			</div>
		</div>
		<button
			type="button"
			class="modal-backdrop bg-black/50"
			onclick={() => (showDisconnectConfirm = false)}
			aria-label="Close modal"
		></button>
	</div>
{/if}

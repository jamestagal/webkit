<script lang="ts">
	import { enhance } from '$app/forms';
	import { CheckCircle, AlertCircle, FileText, Building2, User, Mail, Phone } from 'lucide-svelte';
	import type { PageProps, ActionData } from './$types';

	let { data, form }: PageProps & { form: ActionData } = $props();

	let contract = $derived(data.contract);
	let agency = $derived(data.agency);
	let profile = $derived(data.profile);

	// Form state
	let signatoryName = $state('');
	let signatoryTitle = $state('');
	let agreedToTerms = $state(false);
	let isSubmitting = $state(false);
	let signatureSuccess = $state(false);

	// Check if already signed
	let isSigned = $derived(
		contract.status === 'signed' || contract.status === 'completed'
	);
	let isExpired = $derived(contract.status === 'expired');
	let canSign = $derived(
		!isSigned && !isExpired && ['sent', 'viewed'].includes(contract.status)
	);

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatCurrency(value: string | number) {
		const num = typeof value === 'string' ? parseFloat(value) : value;
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD'
		}).format(num);
	}

	// Handle form success
	$effect(() => {
		if (form?.success) {
			signatureSuccess = true;
		}
	});
</script>

<svelte:head>
	<title>Contract {contract.contractNumber} | {agency?.name || 'Contract'}</title>
</svelte:head>

<div class="min-h-screen bg-base-200">
	<!-- Header -->
	<header class="bg-base-100 border-b border-base-300">
		<div class="container mx-auto px-4 py-6">
			<div class="flex items-center gap-4">
				{#if agency?.logoUrl}
					<img
						src={agency.logoUrl}
						alt={agency.name}
						class="h-12 w-auto object-contain"
					/>
				{:else}
					<div class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
						<Building2 class="h-6 w-6 text-primary" />
					</div>
				{/if}
				<div>
					<h1 class="text-xl font-bold">{agency?.name || 'Contract'}</h1>
					<p class="text-sm text-base-content/60">Contract #{contract.contractNumber}</p>
				</div>
			</div>
		</div>
	</header>

	<main class="container mx-auto px-4 py-8">
		<!-- Signature Success Message -->
		{#if signatureSuccess}
			<div class="card bg-success/10 border border-success mb-8">
				<div class="card-body items-center text-center py-12">
					<CheckCircle class="h-16 w-16 text-success mb-4" />
					<h2 class="text-2xl font-bold text-success">Contract Signed!</h2>
					<p class="text-base-content/80 max-w-md mt-2">
						Thank you for signing the contract. A confirmation email will be sent to you shortly.
					</p>
				</div>
			</div>
		{/if}

		<!-- Expired Warning -->
		{#if isExpired}
			<div class="alert alert-error mb-8">
				<AlertCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Contract Expired</h3>
					<p class="text-sm">
						This contract expired on {formatDate(contract.validUntil)}. Please contact the agency for a new contract.
					</p>
				</div>
			</div>
		{/if}

		<!-- Already Signed -->
		{#if isSigned && !signatureSuccess}
			<div class="alert alert-success mb-8">
				<CheckCircle class="h-5 w-5" />
				<div>
					<h3 class="font-bold">Contract Signed</h3>
					<p class="text-sm">
						This contract was signed by {contract.clientSignatoryName} on {formatDate(contract.clientSignedAt)}.
					</p>
				</div>
			</div>
		{/if}

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Main Content -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Parties -->
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h2 class="card-title">Parties</h2>

						<div class="grid gap-6 sm:grid-cols-2 mt-4">
							<!-- Agency -->
							<div>
								<h3 class="text-sm font-medium text-base-content/60 mb-2">
									Service Provider
								</h3>
								<p class="font-semibold">{agency?.name}</p>
								{#if profile}
									<p class="text-sm text-base-content/70 mt-1">
										ABN: {profile.abn || 'N/A'}
									</p>
									<p class="text-sm text-base-content/70">
										{profile.addressLine1}
										{#if profile.city}, {profile.city}{/if}
										{#if profile.state} {profile.state}{/if}
										{#if profile.postcode} {profile.postcode}{/if}
									</p>
								{/if}
							</div>

							<!-- Client -->
							<div>
								<h3 class="text-sm font-medium text-base-content/60 mb-2">Client</h3>
								<p class="font-semibold">{contract.clientBusinessName || 'N/A'}</p>
								<p class="text-sm text-base-content/70 mt-1">
									{contract.clientContactName || ''}
								</p>
								{#if contract.clientAddress}
									<p class="text-sm text-base-content/70">
										{contract.clientAddress}
									</p>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Contract Details -->
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h2 class="card-title">Contract Details</h2>

						<div class="grid gap-4 sm:grid-cols-2 mt-4">
							<div>
								<span class="text-sm text-base-content/60">Contract Date</span>
								<p class="font-medium">{formatDate(contract.createdAt)}</p>
							</div>
							<div>
								<span class="text-sm text-base-content/60">Valid Until</span>
								<p class="font-medium">{formatDate(contract.validUntil)}</p>
							</div>
							{#if contract.commencementDate}
								<div>
									<span class="text-sm text-base-content/60">Commencement</span>
									<p class="font-medium">{formatDate(contract.commencementDate)}</p>
								</div>
							{/if}
							{#if contract.completionDate}
								<div>
									<span class="text-sm text-base-content/60">Completion</span>
									<p class="font-medium">{formatDate(contract.completionDate)}</p>
								</div>
							{/if}
						</div>

						{#if contract.servicesDescription}
							<div class="mt-6">
								<h3 class="text-sm font-medium text-base-content/60 mb-2">
									Services
								</h3>
								<p class="text-base-content/80">{contract.servicesDescription}</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Terms & Conditions -->
				{#if contract.generatedTermsHtml}
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h2 class="card-title">Terms & Conditions</h2>
							<div
								class="prose prose-sm max-w-none mt-4"
							>
								{@html contract.generatedTermsHtml}
							</div>
						</div>
					</div>
				{/if}

				<!-- Schedule -->
				{#if contract.generatedScheduleHtml}
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h2 class="card-title">Schedule A</h2>
							<div
								class="prose prose-sm max-w-none mt-4"
							>
								{@html contract.generatedScheduleHtml}
							</div>
						</div>
					</div>
				{/if}

				<!-- Special Conditions -->
				{#if contract.specialConditions}
					<div class="card bg-base-100 border border-base-300">
						<div class="card-body">
							<h2 class="card-title">Special Conditions</h2>
							<p class="mt-4 text-base-content/80 whitespace-pre-wrap">
								{contract.specialConditions}
							</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Pricing -->
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h2 class="card-title text-lg">Contract Value</h2>

						<div class="text-3xl font-bold text-primary mt-4">
							{formatCurrency(contract.totalPrice)}
						</div>
						<p class="text-sm text-base-content/60">
							{contract.priceIncludesGst ? 'Inc. GST' : 'Ex. GST'}
						</p>

						{#if contract.paymentTerms}
							<div class="mt-4 pt-4 border-t border-base-200">
								<h3 class="text-sm font-medium text-base-content/60 mb-2">
									Payment Terms
								</h3>
								<p class="text-sm text-base-content/80">{contract.paymentTerms}</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Signatures -->
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h2 class="card-title text-lg">Signatures</h2>

						<!-- Agency Signature -->
						<div class="mt-4 pb-4 border-b border-base-200">
							<h3 class="text-sm font-medium text-base-content/60 mb-2">
								For {agency?.name}
							</h3>
							{#if contract.agencySignatoryName}
								<div class="flex items-center gap-3">
									<CheckCircle class="h-5 w-5 text-success" />
									<div>
										<p class="font-medium">{contract.agencySignatoryName}</p>
										{#if contract.agencySignatoryTitle}
											<p class="text-sm text-base-content/60">
												{contract.agencySignatoryTitle}
											</p>
										{/if}
										<p class="text-xs text-base-content/50">
											{formatDate(contract.agencySignedAt || contract.sentAt)}
										</p>
									</div>
								</div>
							{:else}
								<p class="text-sm text-base-content/60 italic">Pending</p>
							{/if}
						</div>

						<!-- Client Signature -->
						<div class="mt-4">
							<h3 class="text-sm font-medium text-base-content/60 mb-2">
								For {contract.clientBusinessName || 'Client'}
							</h3>

							{#if isSigned}
								<div class="flex items-center gap-3">
									<CheckCircle class="h-5 w-5 text-success" />
									<div>
										<p class="font-medium">{contract.clientSignatoryName}</p>
										{#if contract.clientSignatoryTitle}
											<p class="text-sm text-base-content/60">
												{contract.clientSignatoryTitle}
											</p>
										{/if}
										<p class="text-xs text-base-content/50">
											{formatDate(contract.clientSignedAt)}
										</p>
									</div>
								</div>
							{:else if canSign && !signatureSuccess}
								<!-- Signature Form -->
								<form
									method="POST"
									action="?/sign"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ update }) => {
											isSubmitting = false;
											await update();
										};
									}}
									class="space-y-4"
								>
									{#if form?.error}
										<div class="alert alert-error alert-sm">
											<AlertCircle class="h-4 w-4" />
											<span>{form.error}</span>
										</div>
									{/if}

									<div class="form-control">
										<label class="label" for="signatoryName">
											<span class="label-text font-medium">Your Full Name *</span>
										</label>
										<input
											type="text"
											id="signatoryName"
											name="signatoryName"
											bind:value={signatoryName}
											class="input input-bordered"
											placeholder="Enter your full legal name"
											required
										/>
									</div>

									<div class="form-control">
										<label class="label" for="signatoryTitle">
											<span class="label-text font-medium">Position/Title</span>
										</label>
										<input
											type="text"
											id="signatoryTitle"
											name="signatoryTitle"
											bind:value={signatoryTitle}
											class="input input-bordered"
											placeholder="e.g., Director, Owner"
										/>
									</div>

									<div class="form-control">
										<label class="label cursor-pointer justify-start gap-3">
											<input
												type="checkbox"
												name="agreedToTerms"
												value="true"
												bind:checked={agreedToTerms}
												class="checkbox checkbox-primary"
												required
											/>
											<span class="label-text">
												I have read and agree to the terms and conditions of this contract
											</span>
										</label>
									</div>

									<button
										type="submit"
										class="btn btn-primary w-full"
										disabled={isSubmitting || !signatoryName || !agreedToTerms}
									>
										{#if isSubmitting}
											<span class="loading loading-spinner loading-sm"></span>
										{:else}
											<CheckCircle class="h-4 w-4" />
										{/if}
										Sign Contract
									</button>

									<p class="text-xs text-center text-base-content/50">
										By signing, you agree to be legally bound by this contract.
									</p>
								</form>
							{:else if isExpired}
								<p class="text-sm text-error italic">
									This contract has expired
								</p>
							{:else}
								<p class="text-sm text-base-content/60 italic">Pending</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Contact Info -->
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h2 class="card-title text-lg">Questions?</h2>
						<p class="text-sm text-base-content/60 mt-2">
							Contact us if you have any questions about this contract.
						</p>

						<div class="space-y-2 mt-4">
							{#if agency?.email}
								<a
									href="mailto:{agency.email}"
									class="flex items-center gap-2 text-sm hover:text-primary transition-colors"
								>
									<Mail class="h-4 w-4" />
									{agency.email}
								</a>
							{/if}
							{#if agency?.phone}
								<a
									href="tel:{agency.phone}"
									class="flex items-center gap-2 text-sm hover:text-primary transition-colors"
								>
									<Phone class="h-4 w-4" />
									{agency.phone}
								</a>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-base-300 mt-12 py-6 bg-base-100">
		<div class="container mx-auto px-4 text-center text-sm text-base-content/60">
			<p>&copy; {new Date().getFullYear()} {agency?.name}. All rights reserved.</p>
		</div>
	</footer>
</div>

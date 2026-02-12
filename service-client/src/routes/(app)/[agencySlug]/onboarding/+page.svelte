<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import { updateAgencyProfile, ensureAgencyProfile } from '$lib/api/agency-profile.remote';
	import {
		Building2, Palette, Package, CreditCard, Rocket,
		ChevronRight, ChevronLeft, Check, ExternalLink, ArrowRight,
		MessageCircle, FileText, FileSignature, Users
	} from 'lucide-svelte';

	let { data } = $props();

	const toast = getToast();
	let currentStep = $state(0);
	let isSaving = $state(false);

	const steps = [
		{ label: 'Business', icon: Building2 },
		{ label: 'Branding', icon: Palette },
		{ label: 'Packages', icon: Package },
		{ label: 'Payment', icon: CreditCard },
		{ label: 'Explore', icon: Rocket },
	];

	// Step 1: Business Profile fields
	let legalEntityName = $state(data.profile?.legalEntityName ?? '');
	let tradingName = $state(data.profile?.tradingName ?? '');
	let abn = $state(data.profile?.abn ?? '');
	let addressLine1 = $state(data.profile?.addressLine1 ?? '');
	let city = $state(data.profile?.city ?? '');
	let stateField = $state(data.profile?.state ?? '');
	let postcode = $state(data.profile?.postcode ?? '');

	// Step 2: Branding fields
	let tagline = $state(data.profile?.tagline ?? '');

	async function saveBusinessProfile() {
		isSaving = true;
		try {
			await ensureAgencyProfile({});
			await updateAgencyProfile({
				legalEntityName,
				tradingName,
				abn,
				addressLine1,
				city,
				state: stateField,
				postcode,
			});
			toast.success('Business profile saved');
			currentStep = 1;
		} catch (err) {
			toast.error('Failed to save profile');
			console.error(err);
		} finally {
			isSaving = false;
		}
	}

	async function saveBranding() {
		isSaving = true;
		try {
			await updateAgencyProfile({ tagline });
			toast.success('Branding saved');
			currentStep = 2;
		} catch (err) {
			toast.error('Failed to save branding');
			console.error(err);
		} finally {
			isSaving = false;
		}
	}

	async function completeOnboarding() {
		isSaving = true;
		try {
			const { markOnboardingComplete } = await import('$lib/api/agency-profile.remote');
			await markOnboardingComplete({});
			toast.success('Welcome aboard! Your agency is ready.');
			await invalidateAll();
			goto(`/${data.agency.slug}`);
		} catch (err) {
			toast.error('Failed to complete onboarding');
			console.error(err);
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Set Up Your Agency - {data.agency.name}</title>
</svelte:head>

<div class="max-w-2xl mx-auto py-8 space-y-8">
	<!-- Header -->
	<div class="text-center">
		<h1 class="text-2xl font-bold">Set Up Your Agency</h1>
		<p class="text-base-content/60 mt-1">Let's get everything configured so you can start winning clients.</p>
	</div>

	<!-- Step indicator -->
	<ul class="steps steps-horizontal w-full">
		{#each steps as step, i}
			<li class="step" class:step-primary={i <= currentStep}>
				<span class="text-xs">{step.label}</span>
			</li>
		{/each}
	</ul>

	<!-- Step Content -->
	<div class="card bg-base-100 border border-base-300">
		<div class="card-body">
			{#if currentStep === 0}
				<!-- Step 1: Business Profile -->
				<div class="flex items-center gap-2 mb-4">
					<Building2 class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">Business Profile</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">These details appear on your proposals, contracts, and invoices.</p>

				<div class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Legal Entity Name</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={legalEntityName} placeholder="Your Pty Ltd" />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Trading Name</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={tradingName} placeholder="Your Agency" />
						</label>
					</div>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">ABN</span></div>
						<input type="text" class="input input-bordered w-full" bind:value={abn} placeholder="12 345 678 901" />
					</label>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Street Address</span></div>
						<input type="text" class="input input-bordered w-full" bind:value={addressLine1} placeholder="123 Main Street" />
					</label>
					<div class="grid gap-4 sm:grid-cols-3">
						<label class="form-control w-full">
							<div class="label"><span class="label-text">City</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={city} placeholder="Sydney" />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">State</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={stateField} placeholder="NSW" />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Postcode</span></div>
							<input type="text" class="input input-bordered w-full" bind:value={postcode} placeholder="2000" />
						</label>
					</div>
				</div>

				<div class="card-actions justify-end mt-6">
					<button class="btn btn-primary gap-1" onclick={saveBusinessProfile} disabled={isSaving}>
						{#if isSaving}<span class="loading loading-spinner loading-xs"></span>{/if}
						Next <ChevronRight class="h-4 w-4" />
					</button>
				</div>

			{:else if currentStep === 1}
				<!-- Step 2: Branding -->
				<div class="flex items-center gap-2 mb-4">
					<Palette class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">Branding</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">Customize how your agency looks to clients.</p>

				<div class="space-y-4">
					<div class="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
						{#if data.agencyDetails?.logoUrl}
							<img src={data.agencyDetails.logoUrl} alt="Agency logo" class="h-12 w-12 rounded-lg object-cover" />
							<div>
								<p class="text-sm font-medium">Logo uploaded</p>
								<a href="/{data.agency.slug}/settings/branding" class="text-xs text-primary hover:underline">Change logo</a>
							</div>
						{:else}
							<div class="h-12 w-12 rounded-lg bg-base-300 flex items-center justify-center">
								<Palette class="h-6 w-6 text-base-content/30" />
							</div>
							<div>
								<p class="text-sm font-medium">No logo yet</p>
								<a href="/{data.agency.slug}/settings/branding" class="text-xs text-primary hover:underline flex items-center gap-1">
									Upload in settings <ExternalLink class="h-3 w-3" />
								</a>
							</div>
						{/if}
					</div>

					<label class="form-control w-full">
						<div class="label"><span class="label-text">Tagline</span></div>
						<input type="text" class="input input-bordered w-full" bind:value={tagline} placeholder="Your agency's tagline" />
					</label>

					<div class="flex items-center gap-2 p-3 bg-base-200/50 rounded-lg">
						<div class="h-6 w-6 rounded-full" style="background-color: {data.agency.primaryColor}"></div>
						<span class="text-sm">Brand color: {data.agency.primaryColor}</span>
						<a href="/{data.agency.slug}/settings/branding" class="text-xs text-primary hover:underline ml-auto">Customize</a>
					</div>
				</div>

				<div class="card-actions justify-between mt-6">
					<button class="btn btn-ghost gap-1" onclick={() => currentStep = 0}>
						<ChevronLeft class="h-4 w-4" /> Back
					</button>
					<button class="btn btn-primary gap-1" onclick={saveBranding} disabled={isSaving}>
						{#if isSaving}<span class="loading loading-spinner loading-xs"></span>{/if}
						Next <ChevronRight class="h-4 w-4" />
					</button>
				</div>

			{:else if currentStep === 2}
				<!-- Step 3: Packages -->
				<div class="flex items-center gap-2 mb-4">
					<Package class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">Service Packages</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">Create at least one service package for your proposals.</p>

				{#if data.packageCount > 0}
					<div class="alert alert-success">
						<Check class="h-5 w-5" />
						<span>You have {data.packageCount} package{data.packageCount > 1 ? 's' : ''} set up.</span>
					</div>
				{:else}
					<div class="alert alert-info">
						<Package class="h-5 w-5" />
						<span>No packages yet. Create your first service package to include in proposals.</span>
					</div>
				{/if}

				<a href="/{data.agency.slug}/settings/packages" class="btn btn-outline btn-sm gap-1 mt-4">
					{data.packageCount > 0 ? 'Manage Packages' : 'Create Package'} <ExternalLink class="h-3.5 w-3.5" />
				</a>

				<div class="card-actions justify-between mt-6">
					<button class="btn btn-ghost gap-1" onclick={() => currentStep = 1}>
						<ChevronLeft class="h-4 w-4" /> Back
					</button>
					<button class="btn btn-primary gap-1" onclick={() => currentStep = 3}>
						Next <ChevronRight class="h-4 w-4" />
					</button>
				</div>

			{:else if currentStep === 3}
				<!-- Step 4: Payment Setup -->
				<div class="flex items-center gap-2 mb-4">
					<CreditCard class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">Payment Setup</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">Connect Stripe to accept online payments from clients. You can skip this and set it up later.</p>

				{#if data.completionStatus.hasStripe}
					<div class="alert alert-success">
						<Check class="h-5 w-5" />
						<span>Stripe is connected and ready to accept payments.</span>
					</div>
				{:else}
					<div class="p-4 bg-base-200 rounded-lg space-y-3">
						<p class="text-sm">With Stripe Connect, you can:</p>
						<ul class="text-sm text-base-content/70 space-y-1 ml-4 list-disc">
							<li>Accept credit card payments on invoices</li>
							<li>Automatic payment tracking</li>
							<li>Secure, PCI-compliant processing</li>
						</ul>
						<a href="/{data.agency.slug}/settings/billing" class="btn btn-sm btn-outline gap-1">
							Connect Stripe <ExternalLink class="h-3.5 w-3.5" />
						</a>
					</div>
				{/if}

				<div class="card-actions justify-between mt-6">
					<button class="btn btn-ghost gap-1" onclick={() => currentStep = 2}>
						<ChevronLeft class="h-4 w-4" /> Back
					</button>
					<button class="btn btn-primary gap-1" onclick={() => currentStep = 4}>
						{data.completionStatus.hasStripe ? 'Next' : 'Skip for Now'} <ChevronRight class="h-4 w-4" />
					</button>
				</div>

			{:else if currentStep === 4}
				<!-- Step 5: Explore -->
				<div class="flex items-center gap-2 mb-4">
					<Rocket class="h-5 w-5 text-primary" />
					<h2 class="card-title text-lg">You're All Set!</h2>
				</div>
				<p class="text-sm text-base-content/60 mb-4">Your agency is configured. Here's what you can do next:</p>

				<div class="grid gap-3 sm:grid-cols-2">
					<a href="/{data.agency.slug}/consultation" class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
						<MessageCircle class="h-5 w-5 text-indigo-500" />
						<div>
							<p class="text-sm font-medium">Start a Consultation</p>
							<p class="text-xs text-base-content/50">Discover client needs</p>
						</div>
						<ArrowRight class="h-4 w-4 ml-auto text-base-content/30" />
					</a>
					<a href="/{data.agency.slug}/proposals/new" class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
						<FileText class="h-5 w-5 text-violet-500" />
						<div>
							<p class="text-sm font-medium">Create a Proposal</p>
							<p class="text-xs text-base-content/50">Win new business</p>
						</div>
						<ArrowRight class="h-4 w-4 ml-auto text-base-content/30" />
					</a>
					<a href="/{data.agency.slug}/contracts/new" class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
						<FileSignature class="h-5 w-5 text-cyan-500" />
						<div>
							<p class="text-sm font-medium">Create a Contract</p>
							<p class="text-xs text-base-content/50">Protect your business</p>
						</div>
						<ArrowRight class="h-4 w-4 ml-auto text-base-content/30" />
					</a>
					<a href="/{data.agency.slug}/settings" class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
						<Users class="h-5 w-5 text-emerald-500" />
						<div>
							<p class="text-sm font-medium">Invite Team Members</p>
							<p class="text-xs text-base-content/50">Collaborate with your team</p>
						</div>
						<ArrowRight class="h-4 w-4 ml-auto text-base-content/30" />
					</a>
				</div>

				<div class="card-actions justify-between mt-6">
					<button class="btn btn-ghost gap-1" onclick={() => currentStep = 3}>
						<ChevronLeft class="h-4 w-4" /> Back
					</button>
					<button class="btn btn-primary gap-1" onclick={completeOnboarding} disabled={isSaving}>
						{#if isSaving}<span class="loading loading-spinner loading-xs"></span>{/if}
						Complete Setup <Check class="h-4 w-4" />
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<script lang="ts">
	import QuestionnaireWizard from '$lib/components/questionnaire/QuestionnaireWizard.svelte';
	import { AlertCircle, Clock, CreditCard, FileText } from 'lucide-svelte';

	interface Props {
		data: {
			allowed: boolean;
			reason?: 'contract_not_signed' | 'payment_required' | 'already_completed';
			contract: {
				id: string;
				slug: string;
				clientBusinessName: string;
				clientContactName: string;
				status: string;
			} | null;
			agency: {
				id: string;
				name: string;
			} | null;
			agencyProfile: {
				logoUrl?: string | null;
			} | null;
			questionnaire: import('$lib/server/schema').QuestionnaireResponse | null;
		};
	}

	let { data }: Props = $props();

	function handleComplete() {
		// Reload the page to show completed state
		window.location.reload();
	}
</script>

<svelte:head>
	<title>Website Questionnaire | {data.agency?.name || 'Questionnaire'}</title>
</svelte:head>

{#if data.allowed && data.questionnaire}
	<!-- Questionnaire Wizard -->
	{@const agencyName = data.agency?.name}
	<QuestionnaireWizard
		questionnaire={data.questionnaire}
		agencyLogoUrl={data.agencyProfile?.logoUrl ?? null}
		{...agencyName ? { agencyName } : {}}
		onComplete={handleComplete}
		readOnly={data.reason === 'already_completed'}
	/>
{:else}
	<!-- Access Denied / Waiting Screen -->
	<div class="min-h-screen bg-base-100 flex items-center justify-center p-4">
		<div class="card bg-base-200 max-w-md w-full">
			<div class="card-body items-center text-center">
				<!-- Agency Logo -->
				{#if data.agencyProfile?.logoUrl}
					<img
						src={data.agencyProfile.logoUrl}
						alt="{data.agency?.name || 'Agency'} Logo"
						class="h-12 max-w-[160px] object-contain mb-4"
					/>
				{:else if data.agency?.name}
					<h2 class="text-lg font-bold text-base-content mb-4">{data.agency.name}</h2>
				{/if}

				<!-- Status Icon & Message -->
				{#if data.reason === 'contract_not_signed'}
					<div class="text-warning mb-4">
						<FileText class="h-16 w-16" />
					</div>
					<h2 class="card-title text-xl">Contract Pending</h2>
					<p class="text-base-content/70 mt-2">
						The questionnaire will become available once you sign the contract.
					</p>
					{#if data.contract?.slug}
						<a href="/c/{data.contract.slug}" class="btn btn-primary mt-6">
							View Contract
						</a>
					{/if}
				{:else if data.reason === 'payment_required'}
					<div class="text-warning mb-4">
						<CreditCard class="h-16 w-16" />
					</div>
					<h2 class="card-title text-xl">Payment Required</h2>
					<p class="text-base-content/70 mt-2">
						The questionnaire will become available once the initial payment is received.
					</p>
					<div class="alert alert-info mt-6">
						<Clock class="h-5 w-5" />
						<span class="text-sm">Please check your email for the invoice.</span>
					</div>
				{:else}
					<div class="text-error mb-4">
						<AlertCircle class="h-16 w-16" />
					</div>
					<h2 class="card-title text-xl">Access Denied</h2>
					<p class="text-base-content/70 mt-2">
						You don't have access to this questionnaire. Please contact the agency if you believe this is an error.
					</p>
				{/if}

				<!-- Contact Info -->
				{#if data.agency?.name}
					<div class="mt-8 pt-6 border-t border-base-300 w-full">
						<p class="text-sm text-base-content/50">
							Questions? Contact {data.agency.name}
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

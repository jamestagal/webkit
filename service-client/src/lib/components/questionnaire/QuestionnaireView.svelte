<script lang="ts">
	import { ClipboardList, CheckCircle, Clock, AlertCircle, ExternalLink, Copy } from 'lucide-svelte';
	import type { QuestionnaireResponse } from '$lib/server/schema';
	import type { QuestionnaireResponses } from '$lib/api/questionnaire.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';

	interface Props {
		questionnaire: QuestionnaireResponse | null;
		contractSlug: string;
	}

	let { questionnaire, contractSlug }: Props = $props();

	const toast = getToast();

	let responses = $derived(questionnaire?.responses as QuestionnaireResponses || {});

	function getStatusInfo(status: string | undefined) {
		switch (status) {
			case 'completed':
				return { class: 'badge-success', icon: CheckCircle, label: 'Completed' };
			case 'in_progress':
				return { class: 'badge-warning', icon: Clock, label: 'In Progress' };
			default:
				return { class: 'badge-ghost', icon: AlertCircle, label: 'Not Started' };
		}
	}

	let statusInfo = $derived(getStatusInfo(questionnaire?.status));

	function formatDate(date: Date | string | null | undefined) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function copyPublicUrl() {
		const url = `${window.location.origin}/q/${contractSlug}`;
		navigator.clipboard.writeText(url);
		toast.success('Questionnaire link copied');
	}

	// Section display configuration
	const sections = [
		{
			title: 'Personal Information',
			fields: [
				{ key: 'first_name', label: 'First Name' },
				{ key: 'last_name', label: 'Last Name' },
				{ key: 'email', label: 'Email' }
			]
		},
		{
			title: 'Company Details',
			fields: [
				{ key: 'company_name', label: 'Company Name' },
				{ key: 'registered_address', label: 'Registered Address' }
			]
		},
		{
			title: 'Display Information',
			fields: [
				{ key: 'displayed_business_name', label: 'Business Name to Display' },
				{ key: 'displayed_address', label: 'Address' },
				{ key: 'displayed_phone', label: 'Phone' },
				{ key: 'displayed_email', label: 'Email' },
				{ key: 'social_media_accounts', label: 'Social Media' },
				{ key: 'opening_hours', label: 'Opening Hours' }
			]
		},
		{
			title: 'Domain & Technical',
			fields: [
				{ key: 'has_domain', label: 'Has Domain?' },
				{ key: 'domain_name', label: 'Domain Name' },
				{ key: 'has_google_business', label: 'Google Business Profile?' }
			]
		},
		{
			title: 'About Your Business',
			fields: [
				{ key: 'business_story', label: 'Story/Background' },
				{ key: 'business_emails', label: 'Business Emails' },
				{ key: 'areas_served', label: 'Areas Served' },
				{ key: 'target_customers', label: 'Target Customers' },
				{ key: 'top_services', label: 'Top Services' },
				{ key: 'other_services', label: 'Other Services' },
				{ key: 'differentiators', label: 'What Sets You Apart' },
				{ key: 'statistics_awards', label: 'Statistics/Awards' },
				{ key: 'additional_business_details', label: 'Additional Details' }
			]
		},
		{
			title: 'Website Content',
			fields: [
				{ key: 'pages_wanted', label: 'Pages Wanted' },
				{ key: 'customer_actions', label: 'Customer Actions' },
				{ key: 'key_information', label: 'Key Information' },
				{ key: 'calls_to_action', label: 'Calls to Action' },
				{ key: 'regularly_updated_content', label: 'Regular Updates' },
				{ key: 'additional_content_details', label: 'Additional Details' }
			]
		},
		{
			title: 'Website Design',
			fields: [
				{ key: 'competitor_websites', label: 'Competitor Websites' },
				{ key: 'reference_websites', label: 'Reference Websites' },
				{ key: 'aesthetic_description', label: 'Desired Aesthetic' },
				{ key: 'branding_guidelines', label: 'Branding Guidelines' },
				{ key: 'additional_design_details', label: 'Additional Details' }
			]
		},
		{
			title: 'Final Details',
			fields: [
				{ key: 'timeline', label: 'Timeline' },
				{ key: 'google_analytics', label: 'Google Analytics?' },
				{ key: 'referral_source', label: 'Referral Source' },
				{ key: 'other_services_interest', label: 'Other Services Interest' },
				{ key: 'marketing_permissions', label: 'Marketing Permissions' }
			]
		}
	];

	function getFieldValue(key: string): string {
		const value = responses[key as keyof QuestionnaireResponses];
		if (Array.isArray(value)) {
			return value.join(', ');
		}
		if (value === 'yes') return 'Yes';
		if (value === 'no') return 'No';
		return value || '-';
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h3 class="font-medium flex items-center gap-2">
			<ClipboardList class="h-4 w-4" />
			Website Questionnaire
		</h3>
		<div class="flex items-center gap-2">
			{#if questionnaire}
				<div class="badge {statusInfo.class} gap-1">
					<statusInfo.icon class="h-3 w-3" />
					{statusInfo.label}
				</div>
			{/if}
		</div>
	</div>

	{#if !questionnaire || questionnaire.status === 'not_started'}
		<!-- Questionnaire Not Started - Prominent CTA -->
		<div class="alert alert-info">
			<ClipboardList class="h-6 w-6" />
			<div class="flex-1">
				<h4 class="font-semibold">Next Step: Website Questionnaire</h4>
				<p class="text-sm opacity-80">
					Share this link with your client to collect their website requirements, content, and design preferences.
				</p>
			</div>
		</div>
		<div class="bg-base-200 rounded-lg p-4 mt-4">
			<label class="text-xs text-base-content/60 block mb-2">Questionnaire Link</label>
			<div class="flex gap-2">
				<input
					type="text"
					readonly
					value="{typeof window !== 'undefined' ? window.location.origin : ''}/q/{contractSlug}"
					class="input input-bordered input-sm flex-1 font-mono text-sm"
				/>
				<button type="button" class="btn btn-primary btn-sm" onclick={copyPublicUrl}>
					<Copy class="h-4 w-4" />
					Copy
				</button>
				<a href="/q/{contractSlug}" target="_blank" class="btn btn-ghost btn-sm">
					<ExternalLink class="h-4 w-4" />
					Preview
				</a>
			</div>
		</div>
	{:else if questionnaire.status === 'in_progress'}
		<div class="space-y-4">
			<div class="alert alert-warning">
				<Clock class="h-5 w-5" />
				<div>
					<p class="font-medium">In Progress - {questionnaire.completionPercentage}% complete</p>
					<p class="text-sm">Last activity: {formatDate(questionnaire.lastActivityAt)}</p>
				</div>
			</div>
			<div class="flex gap-2">
				<a href="/q/{contractSlug}" target="_blank" class="btn btn-ghost btn-sm">
					<ExternalLink class="h-4 w-4" />
					View Form
				</a>
				<button type="button" class="btn btn-ghost btn-sm" onclick={copyPublicUrl}>
					<Copy class="h-4 w-4" />
					Copy Link
				</button>
			</div>
		</div>
	{:else}
		<!-- Completed - Show Responses -->
		<div class="text-sm text-base-content/60 mb-4">
			Completed on {formatDate(questionnaire.completedAt)}
		</div>

		<div class="space-y-6">
			{#each sections as section}
				<div class="collapse collapse-arrow bg-base-200">
					<input type="checkbox" />
					<div class="collapse-title font-medium">
						{section.title}
					</div>
					<div class="collapse-content">
						<div class="space-y-3 pt-2">
							{#each section.fields as field}
								{@const value = getFieldValue(field.key)}
								{#if value !== '-'}
									<div>
										<span class="text-xs text-base-content/50 block">{field.label}</span>
										<p class="whitespace-pre-wrap text-sm">{value}</p>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	import { Mail, CheckCircle, Clock, AlertCircle, RefreshCw, Send, XCircle, Bell, FileText } from 'lucide-svelte';
	import { getEntityEmailLogs, resendEmail } from '$lib/api/email.remote';
	import { getToast } from '$lib/ui/toast_store.svelte';
	import type { EmailLog } from '$lib/server/schema';

	interface Props {
		proposalId?: string;
		invoiceId?: string;
		contractId?: string;
		formSubmissionId?: string;
	}

	let { proposalId, invoiceId, contractId, formSubmissionId }: Props = $props();

	const toast = getToast();

	let emails = $state<EmailLog[]>([]);
	let loading = $state(true);
	let resending = $state<string | null>(null);

	async function loadEmails() {
		loading = true;
		try {
			emails = await getEntityEmailLogs({ proposalId, invoiceId, contractId, formSubmissionId });
		} catch (err) {
			console.error('Failed to load email history:', err);
		} finally {
			loading = false;
		}
	}

	async function handleResend(emailId: string) {
		resending = emailId;
		try {
			const result = await resendEmail({ emailLogId: emailId });
			if (result.success) {
				toast.success('Email resent successfully');
				await loadEmails();
			} else {
				toast.error('Failed to resend email', result.error || '');
			}
		} catch (err) {
			toast.error('Failed to resend email', err instanceof Error ? err.message : '');
		} finally {
			resending = null;
		}
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'sent':
				return { class: 'badge-info', icon: Send, label: 'Sent' };
			case 'delivered':
				return { class: 'badge-success', icon: CheckCircle, label: 'Delivered' };
			case 'opened':
				return { class: 'badge-success', icon: CheckCircle, label: 'Opened' };
			case 'bounced':
				return { class: 'badge-error', icon: XCircle, label: 'Bounced' };
			case 'failed':
				return { class: 'badge-error', icon: AlertCircle, label: 'Failed' };
			default:
				return { class: 'badge-ghost', icon: Clock, label: 'Pending' };
		}
	}

	function getEmailTypeBadge(emailType: string) {
		switch (emailType) {
			case 'invoice_overdue_reminder':
				return { class: 'badge-error', icon: Bell, label: 'Overdue Reminder' };
			case 'invoice_reminder':
				return { class: 'badge-warning', icon: Bell, label: 'Reminder' };
			case 'invoice':
				return { class: 'badge-primary', icon: FileText, label: 'Invoice' };
			case 'proposal':
				return { class: 'badge-primary', icon: FileText, label: 'Proposal' };
			case 'contract':
				return { class: 'badge-primary', icon: FileText, label: 'Contract' };
			case 'form_sent':
				return { class: 'badge-primary', icon: FileText, label: 'Form' };
			default:
				return null; // Don't show badge for unknown types
		}
	}

	function formatDate(date: Date | string | null) {
		if (!date) return '-';
		return new Date(date).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Load on mount
	$effect(() => {
		if (proposalId || invoiceId || contractId || formSubmissionId) {
			loadEmails();
		}
	});
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h3 class="font-medium flex items-center gap-2">
			<Mail class="h-4 w-4" />
			Email History
		</h3>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			onclick={loadEmails}
			disabled={loading}
		>
			<RefreshCw class="h-3 w-3 {loading ? 'animate-spin' : ''}" />
		</button>
	</div>

	{#if loading}
		<div class="flex justify-center py-4">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:else if emails.length === 0}
		<p class="text-sm text-base-content/60 text-center py-4">
			No emails sent yet
		</p>
	{:else}
		<div class="space-y-3">
			{#each emails as email (email.id)}
				{@const status = getStatusBadge(email.status)}
				{@const emailType = getEmailTypeBadge(email.emailType)}
				<div class="bg-base-200 rounded-lg p-3 text-sm">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1 min-w-0">
							<div class="flex flex-wrap items-center gap-2 mb-1">
								{#if emailType}
									<span class="badge {emailType.class} badge-sm gap-1">
										<emailType.icon class="h-3 w-3" />
										{emailType.label}
									</span>
								{/if}
								<span class="badge {status.class} badge-sm gap-1">
									<status.icon class="h-3 w-3" />
									{status.label}
								</span>
								{#if email.hasAttachment}
									<span class="badge badge-ghost badge-sm">PDF</span>
								{/if}
							</div>
							<p class="font-medium truncate">{email.subject}</p>
							<p class="text-base-content/60 truncate">
								To: {email.recipientName ? `${email.recipientName} <${email.recipientEmail}>` : email.recipientEmail}
							</p>
							<p class="text-xs text-base-content/50 mt-1">
								{formatDate(email.sentAt || email.createdAt)}
							</p>
							{#if email.errorMessage}
								<p class="text-xs text-error mt-1">{email.errorMessage}</p>
							{/if}
						</div>
						{#if email.status === 'failed' || email.status === 'bounced'}
							<button
								type="button"
								class="btn btn-ghost btn-xs"
								onclick={() => handleResend(email.id)}
								disabled={resending === email.id}
							>
								{#if resending === email.id}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<RefreshCw class="h-3 w-3" />
									Retry
								{/if}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

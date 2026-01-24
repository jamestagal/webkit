<script lang="ts">
	/**
	 * ClientPickerStep - Pre-form client selection step
	 *
	 * Wraps ClientPicker with a step UI for the consultation flow.
	 * Allows selecting an existing client or skipping for new entry.
	 */
	import ClientPicker from "$lib/components/shared/ClientPicker.svelte";
	import MessageSquarePlus from "lucide-svelte/icons/message-square-plus";
	import UserSearch from "lucide-svelte/icons/user-search";
	import ClipboardList from "lucide-svelte/icons/clipboard-list";
	import FileText from "lucide-svelte/icons/file-text";
	import ArrowRight from "lucide-svelte/icons/arrow-right";
	import PenLine from "lucide-svelte/icons/pen-line";

	type Client = {
		id: string;
		businessName: string;
		email: string;
		contactName: string | null;
		phone: string | null;
	};

	interface Props {
		onSelect: (client: Client) => void;
		onSkip: () => void;
	}

	let { onSelect, onSkip }: Props = $props();
	let selectedClient = $state<Client | null>(null);

	function handleSelect(client: Client | null) {
		selectedClient = client;
	}

	function handleContinue() {
		if (selectedClient) {
			onSelect(selectedClient);
		}
	}
</script>

<div class="consultation-entry">
	<!-- Header -->
	<div class="entry-header">
		<div class="icon-container">
			<MessageSquarePlus size={28} strokeWidth={1.5} />
		</div>
		<h1 class="entry-title">New Consultation</h1>
		<p class="entry-subtitle">
			Start a discovery session to understand your client's needs and goals.
		</p>
	</div>

	<!-- Workflow Steps -->
	<div class="workflow-steps">
		<div class="step-item active">
			<div class="step-number">1</div>
			<span class="step-label">Select Client</span>
			<span class="step-desc">Choose existing or enter new</span>
		</div>
		<div class="step-divider"></div>
		<div class="step-item">
			<div class="step-number">2</div>
			<span class="step-label">Discovery Form</span>
			<span class="step-desc">Gather project requirements</span>
		</div>
		<div class="step-divider"></div>
		<div class="step-item">
			<div class="step-number">3</div>
			<span class="step-label">Generate Proposal</span>
			<span class="step-desc">Create tailored proposal</span>
		</div>
	</div>

	<!-- Client Picker Card -->
	<div class="picker-card">
		<div class="picker-header">
			<UserSearch size={18} strokeWidth={1.5} class="picker-icon" />
			<span class="picker-title">Find an existing client</span>
		</div>
		<ClientPicker
			selected={selectedClient}
			onSelect={handleSelect}
			label=""
			placeholder="Search by business name or email..."
		/>

		{#if selectedClient}
			<div class="selected-banner">
				<div class="selected-info">
					<span class="selected-name">{selectedClient.businessName}</span>
					<span class="selected-email">{selectedClient.email}</span>
				</div>
				<button type="button" class="btn btn-primary btn-sm" onclick={handleContinue}>
					Continue
					<ArrowRight size={14} />
				</button>
			</div>
		{/if}
	</div>

	<!-- Divider -->
	<div class="or-divider">
		<span>or</span>
	</div>

	<!-- Skip Option -->
	<button type="button" class="skip-button" onclick={onSkip}>
		<PenLine size={18} strokeWidth={1.5} />
		<div class="skip-content">
			<span class="skip-label">Enter client details manually</span>
			<span class="skip-desc">Start fresh without pre-filling from an existing record</span>
		</div>
		<ArrowRight size={16} class="skip-arrow" />
	</button>
</div>

<style>
	.consultation-entry {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem 0;
	}

	/* Header */
	.entry-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.icon-container {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 0.875rem;
		background-color: color-mix(in oklch, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
		margin-bottom: 1rem;
	}

	.entry-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-base-content);
		margin: 0 0 0.5rem;
		letter-spacing: -0.02em;
	}

	.entry-subtitle {
		font-size: 0.9375rem;
		color: color-mix(in oklch, var(--color-base-content) 60%, transparent);
		margin: 0;
		line-height: 1.5;
	}

	/* Workflow Steps */
	.workflow-steps {
		display: flex;
		align-items: flex-start;
		margin-bottom: 2.5rem;
		padding: 1.5rem;
		background-color: var(--color-base-100);
		border: 1px solid color-mix(in oklch, var(--color-base-content) 8%, transparent);
		border-radius: 0.75rem;
	}

	.step-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		flex: 1;
		gap: 0.5rem;
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
		flex-shrink: 0;
		background-color: color-mix(in oklch, var(--color-base-content) 8%, transparent);
		color: color-mix(in oklch, var(--color-base-content) 45%, transparent);
	}

	.step-item.active .step-number {
		background-color: var(--color-primary);
		color: var(--color-primary-content);
	}

	.step-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: color-mix(in oklch, var(--color-base-content) 70%, transparent);
	}

	.step-item.active .step-label {
		color: var(--color-base-content);
	}

	.step-desc {
		font-size: 0.6875rem;
		color: color-mix(in oklch, var(--color-base-content) 40%, transparent);
	}

	.step-divider {
		flex-shrink: 0;
		width: 3rem;
		height: 1px;
		background-color: color-mix(in oklch, var(--color-base-content) 12%, transparent);
		margin-top: 1rem;
	}

	/* Picker Card */
	.picker-card {
		background-color: var(--color-base-100);
		border: 1px solid color-mix(in oklch, var(--color-base-content) 8%, transparent);
		border-radius: 0.75rem;
		padding: 1.5rem;
	}

	.picker-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: color-mix(in oklch, var(--color-base-content) 55%, transparent);
	}

	:global(.picker-icon) {
		flex-shrink: 0;
	}

	.picker-title {
		font-size: 0.8125rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.selected-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 1rem;
		padding: 0.875rem 1rem;
		background-color: color-mix(in oklch, var(--color-primary) 6%, transparent);
		border: 1px solid color-mix(in oklch, var(--color-primary) 20%, transparent);
		border-radius: 0.5rem;
	}

	.selected-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.selected-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-base-content);
	}

	.selected-email {
		font-size: 0.75rem;
		color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
	}

	/* OR Divider */
	.or-divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.5rem 0;
	}

	.or-divider::before,
	.or-divider::after {
		content: "";
		flex: 1;
		height: 1px;
		background-color: color-mix(in oklch, var(--color-base-content) 10%, transparent);
	}

	.or-divider span {
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: color-mix(in oklch, var(--color-base-content) 35%, transparent);
	}

	/* Skip Button */
	.skip-button {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		width: 100%;
		padding: 1rem 1.25rem;
		background-color: var(--color-base-100);
		border: 1px solid color-mix(in oklch, var(--color-base-content) 8%, transparent);
		border-radius: 0.75rem;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
		color: var(--color-base-content);
	}

	.skip-button:hover {
		border-color: color-mix(in oklch, var(--color-base-content) 18%, transparent);
		background-color: color-mix(in oklch, var(--color-base-content) 2%, var(--color-base-100));
	}

	.skip-content {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
	}

	.skip-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-base-content);
	}

	.skip-desc {
		font-size: 0.75rem;
		color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
	}

	:global(.skip-arrow) {
		color: color-mix(in oklch, var(--color-base-content) 30%, transparent);
		flex-shrink: 0;
		transition: transform 0.15s ease;
	}

	.skip-button:hover :global(.skip-arrow) {
		transform: translateX(2px);
		color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.workflow-steps {
			padding: 1rem;
		}

		.step-desc {
			display: none;
		}

		.step-divider {
			width: 1.5rem;
		}
	}
</style>

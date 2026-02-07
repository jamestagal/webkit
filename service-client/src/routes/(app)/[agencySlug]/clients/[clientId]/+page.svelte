<script lang="ts">
	import { invalidateAll, goto } from "$app/navigation";
	import { getToast } from "$lib/ui/toast_store.svelte";
	import { updateClient, archiveClient, restoreClient } from "$lib/api/clients.remote";
	import {
		ArrowLeft,
		Users,
		Mail,
		Phone,
		User,
		Pencil,
		Archive,
		RotateCcw,
		MessageCircle,
		FileText,
		ScrollText,
		Receipt,
		Plus,
		ExternalLink,
		CheckCircle,
		Clock,
		AlertCircle,
		Send,
		X,
		Loader2,
		StickyNote,
		RefreshCw,
	} from "lucide-svelte";
	import { FEATURES } from "$lib/config/features";
	import type { PageProps } from "./$types";

	const toast = getToast();
	let { data }: PageProps = $props();

	let agencySlug = $derived(data.agency.slug);
	let client = $derived(data.client);

	// Edit modal state
	let showEditModal = $state(false);
	let isSaving = $state(false);
	let formData = $state({
		businessName: "",
		email: "",
		phone: "",
		contactName: "",
		notes: "",
	});

	// Tab filter state
	let activeTab = $state<"all" | "consultations" | "proposals" | "contracts" | "invoices">("all");

	// Status badge config
	const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; class: string }> = {
		// Consultation statuses
		draft: { label: "Draft", icon: Clock, class: "badge-warning" },
		completed: { label: "Completed", icon: CheckCircle, class: "badge-success" },
		// Proposal statuses
		sent: { label: "Sent", icon: Send, class: "badge-info" },
		viewed: { label: "Viewed", icon: ExternalLink, class: "badge-info" },
		accepted: { label: "Accepted", icon: CheckCircle, class: "badge-success" },
		declined: { label: "Declined", icon: AlertCircle, class: "badge-error" },
		revision_requested: { label: "Revision", icon: Clock, class: "badge-warning" },
		expired: { label: "Expired", icon: AlertCircle, class: "badge-ghost" },
		// Contract statuses
		pending_signature: { label: "Pending", icon: Clock, class: "badge-warning" },
		signed: { label: "Signed", icon: CheckCircle, class: "badge-success" },
		cancelled: { label: "Cancelled", icon: AlertCircle, class: "badge-error" },
		// Invoice statuses
		paid: { label: "Paid", icon: CheckCircle, class: "badge-success" },
		overdue: { label: "Overdue", icon: AlertCircle, class: "badge-error" },
		partially_paid: { label: "Partial", icon: Clock, class: "badge-warning" },
	};

	// Document type config
	const docTypeConfig = {
		consultation: { label: "Consultation", icon: MessageCircle, color: FEATURES.consultations.color },
		proposal: { label: "Proposal", icon: FileText, color: FEATURES.proposals.color },
		contract: { label: "Contract", icon: ScrollText, color: FEATURES.contracts.color },
		invoice: { label: "Invoice", icon: Receipt, color: FEATURES.invoices.color },
	};

	// Combined documents list
	let allDocuments = $derived(() => {
		const docs = [
			...data.consultations.map((d) => ({ ...d, docType: "consultation" as const })),
			...data.proposals.map((d) => ({ ...d, docType: "proposal" as const })),
			...data.contracts.map((d) => ({ ...d, docType: "contract" as const })),
			...data.invoices.map((d) => ({ ...d, docType: "invoice" as const })),
		];
		// Sort by createdAt descending
		return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	});

	// Filtered documents based on active tab
	let filteredDocuments = $derived(() => {
		if (activeTab === "all") return allDocuments();
		return allDocuments().filter((d) => d.docType === activeTab.slice(0, -1)); // Remove trailing 's'
	});

	function openEditModal() {
		formData = {
			businessName: client.businessName,
			email: client.email,
			phone: client.phone || "",
			contactName: client.contactName || "",
			notes: client.notes || "",
		};
		showEditModal = true;
	}

	async function handleUpdate() {
		if (!formData.businessName.trim() || !formData.email.trim()) {
			toast.error("Business name and email are required");
			return;
		}

		isSaving = true;
		try {
			await updateClient({
				id: client.id,
				businessName: formData.businessName.trim(),
				email: formData.email.trim(),
				phone: formData.phone.trim() || null,
				contactName: formData.contactName.trim() || null,
				notes: formData.notes.trim() || null,
			});
			showEditModal = false;
			await invalidateAll();
			toast.success("Client updated successfully");
		} catch (err) {
			toast.error("Failed to update client", err instanceof Error ? err.message : "");
		} finally {
			isSaving = false;
		}
	}

	async function handleArchive() {
		try {
			await archiveClient(client.id);
			await invalidateAll();
			toast.success("Client archived");
		} catch (err) {
			toast.error("Failed to archive client", err instanceof Error ? err.message : "");
		}
	}

	async function handleRestore() {
		try {
			await restoreClient(client.id);
			await invalidateAll();
			toast.success("Client restored");
		} catch (err) {
			toast.error("Failed to restore client", err instanceof Error ? err.message : "");
		}
	}

	function getDocumentUrl(doc: ReturnType<typeof allDocuments>[0]) {
		switch (doc.docType) {
			case "consultation":
				return `/${agencySlug}/consultation/view/${doc.id}`;
			case "proposal":
				return `/${agencySlug}/proposals/${doc.id}`;
			case "contract":
				return `/${agencySlug}/contracts/${doc.id}`;
			case "invoice":
				return `/${agencySlug}/invoices/${doc.id}`;
		}
	}

	function formatDate(date: Date | string | null) {
		if (!date) return "—";
		return new Date(date).toLocaleDateString("en-AU", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	function formatDateTime(date: Date | string | null) {
		if (!date) return "—";
		return new Date(date).toLocaleDateString("en-AU", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	// Email type labels for display
	const emailTypeLabels: Record<string, { label: string; docType: string }> = {
		proposal_sent: { label: "Proposal Sent", docType: "proposal" },
		invoice_sent: { label: "Invoice Sent", docType: "invoice" },
		contract_sent: { label: "Contract Sent", docType: "contract" },
		form_sent: { label: "Form Sent", docType: "form" },
		payment_reminder: { label: "Payment Reminder", docType: "invoice" },
		contract_signed_client: { label: "Signing Confirmation", docType: "contract" },
		contract_signed_agency: { label: "Contract Signed", docType: "contract" },
		invoice_paid_client: { label: "Payment Receipt", docType: "invoice" },
		invoice_paid_agency: { label: "Payment Received", docType: "invoice" },
		proposal_accepted_agency: { label: "Proposal Accepted", docType: "proposal" },
		proposal_declined_agency: { label: "Proposal Declined", docType: "proposal" },
		proposal_revision_requested_agency: { label: "Changes Requested", docType: "proposal" },
	};

	function getEmailTypeLabel(emailType: string): string {
		return emailTypeLabels[emailType]?.label || emailType.replace(/_/g, " ");
	}

	function getEmailDocType(emailType: string): string {
		return emailTypeLabels[emailType]?.docType || "unknown";
	}
</script>

<div class="space-y-6">
	<!-- Header with Back Button -->
	<div class="flex items-start gap-4">
		<a href="/{agencySlug}/clients" class="btn btn-ghost btn-sm btn-square mt-1">
			<ArrowLeft class="h-4 w-4" />
		</a>
		<div class="flex-1">
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-bold">{client.businessName}</h1>
				{#if client.status === "archived"}
					<span class="badge badge-ghost">Archived</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-base-content/70">
				<span class="flex items-center gap-1">
					<Mail class="h-4 w-4" />
					{client.email}
				</span>
				{#if client.phone}
					<span class="flex items-center gap-1">
						<Phone class="h-4 w-4" />
						{client.phone}
					</span>
				{/if}
				{#if client.contactName}
					<span class="flex items-center gap-1">
						<User class="h-4 w-4" />
						{client.contactName}
					</span>
				{/if}
			</div>
		</div>
		<div class="flex gap-2">
			<button type="button" class="btn btn-outline btn-sm" onclick={openEditModal}>
				<Pencil class="h-4 w-4" />
				Edit
			</button>
			{#if client.status === "active"}
				<button type="button" class="btn btn-outline btn-sm" onclick={handleArchive}>
					<Archive class="h-4 w-4" />
					Archive
				</button>
			{:else}
				<button type="button" class="btn btn-outline btn-sm" onclick={handleRestore}>
					<RotateCcw class="h-4 w-4" />
					Restore
				</button>
			{/if}
		</div>
	</div>

	<!-- Notes Card (if exists) -->
	{#if client.notes}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-4">
				<div class="flex items-center gap-2 text-sm font-medium text-base-content/70">
					<StickyNote class="h-4 w-4" />
					Notes
				</div>
				<p class="text-sm whitespace-pre-wrap">{client.notes}</p>
			</div>
		</div>
	{/if}

	<!-- Quick Actions -->
	<div class="flex flex-wrap gap-2">
		<span class="text-sm text-base-content/70 self-center mr-2">Quick Create:</span>
		<a href="/{agencySlug}/consultation?clientId={client.id}" class="btn btn-outline btn-sm">
			<Plus class="h-3 w-3" />
			<MessageCircle class="h-4 w-4" style="color: {FEATURES.consultations.color}" />
			Consultation
		</a>
		<a href="/{agencySlug}/proposals/new?clientId={client.id}" class="btn btn-outline btn-sm">
			<Plus class="h-3 w-3" />
			<FileText class="h-4 w-4" style="color: {FEATURES.proposals.color}" />
			Proposal
		</a>
		<a href="/{agencySlug}/contracts/new?clientId={client.id}" class="btn btn-outline btn-sm">
			<Plus class="h-3 w-3" />
			<ScrollText class="h-4 w-4" style="color: {FEATURES.contracts.color}" />
			Contract
		</a>
		<a href="/{agencySlug}/invoices/new?clientId={client.id}" class="btn btn-outline btn-sm">
			<Plus class="h-3 w-3" />
			<Receipt class="h-4 w-4" style="color: {FEATURES.invoices.color}" />
			Invoice
		</a>
	</div>

	<!-- Document Tabs -->
	<div class="tabs tabs-boxed bg-base-200 p-1 w-fit">
		<button
			class="tab"
			class:tab-active={activeTab === "all"}
			onclick={() => (activeTab = "all")}
		>
			All ({data.counts.total})
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === "consultations"}
			onclick={() => (activeTab = "consultations")}
		>
			<MessageCircle class="h-3 w-3 mr-1" />
			Consultations ({data.counts.consultations})
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === "proposals"}
			onclick={() => (activeTab = "proposals")}
		>
			<FileText class="h-3 w-3 mr-1" />
			Proposals ({data.counts.proposals})
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === "contracts"}
			onclick={() => (activeTab = "contracts")}
		>
			<ScrollText class="h-3 w-3 mr-1" />
			Contracts ({data.counts.contracts})
		</button>
		<button
			class="tab"
			class:tab-active={activeTab === "invoices"}
			onclick={() => (activeTab = "invoices")}
		>
			<Receipt class="h-3 w-3 mr-1" />
			Invoices ({data.counts.invoices})
		</button>
	</div>

	<!-- Documents List -->
	{#if filteredDocuments().length === 0}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body items-center text-center py-12">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-base-200 mb-4"
				>
					{#if activeTab === "all"}
						<Users class="h-8 w-8 text-base-content/40" />
					{:else if activeTab === "consultations"}
						<MessageCircle class="h-8 w-8 text-base-content/40" />
					{:else if activeTab === "proposals"}
						<FileText class="h-8 w-8 text-base-content/40" />
					{:else if activeTab === "contracts"}
						<ScrollText class="h-8 w-8 text-base-content/40" />
					{:else}
						<Receipt class="h-8 w-8 text-base-content/40" />
					{/if}
				</div>
				<h3 class="text-lg font-semibold">No {activeTab === "all" ? "documents" : activeTab} yet</h3>
				<p class="text-base-content/60 max-w-sm">
					{#if activeTab === "all"}
						Start by creating a consultation, proposal, contract, or invoice for this client.
					{:else}
						Create your first {activeTab.slice(0, -1)} for this client using the quick create buttons above.
					{/if}
				</p>
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 border border-base-300 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr class="bg-base-200">
							<th>Type</th>
							<th>Title / Number</th>
							<th>Status</th>
							<th>Created</th>
							<th class="w-10"></th>
						</tr>
					</thead>
					<tbody>
						{#each filteredDocuments() as doc (doc.id)}
							{@const typeConfig = docTypeConfig[doc.docType]}
							{@const status = statusConfig[doc.status] || { label: doc.status, icon: Clock, class: "badge-ghost" }}
							{@const StatusIcon = status.icon}
							{@const TypeIcon = typeConfig.icon}
							<tr class="hover:bg-base-50 cursor-pointer" onclick={() => goto(getDocumentUrl(doc))}>
								<td>
									<div class="flex items-center gap-2">
										<TypeIcon class="h-4 w-4" style="color: {typeConfig.color}" />
										<span class="text-sm">{typeConfig.label}</span>
									</div>
								</td>
								<td>
									<span class="font-medium">
										{#if "number" in doc && doc.number}
											{doc.number}
										{:else}
											{doc.title || "—"}
										{/if}
									</span>
								</td>
								<td>
									<span class="badge {status.class} badge-sm gap-1">
										<StatusIcon class="h-3 w-3" />
										{status.label}
									</span>
								</td>
								<td>
									<span class="text-sm text-base-content/70">
										{formatDate(doc.createdAt)}
									</span>
								</td>
								<td>
									<a href={getDocumentUrl(doc)} class="btn btn-ghost btn-sm btn-square">
										<ExternalLink class="h-4 w-4" />
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Email History -->
	<div class="card bg-base-100 border border-base-300 overflow-hidden">
		<div class="card-body p-4 sm:p-6">
			<div class="flex items-center gap-2 mb-4">
				<Mail class="h-5 w-5 text-base-content/70" />
				<h2 class="text-lg font-semibold">Email History</h2>
				{#if data.emailLogs.length > 0}
					<span class="badge badge-ghost badge-sm">{data.emailLogs.length}</span>
				{/if}
				<button type="button" class="btn btn-ghost btn-xs btn-square ml-auto" onclick={() => invalidateAll()} title="Refresh">
					<RefreshCw class="h-3.5 w-3.5" />
				</button>
			</div>

			{#if data.emailLogs.length > 0}
				<div class="overflow-x-auto -mx-4 sm:-mx-6">
					<table class="table table-sm">
						<thead>
							<tr class="bg-base-200">
								<th>Email</th>
								<th>Type</th>
								<th>Recipient</th>
								<th>Status</th>
								<th>Date</th>
							</tr>
						</thead>
						<tbody>
							{#each data.emailLogs as log (log.id)}
								{@const docType = getEmailDocType(log.emailType)}
								{@const typeConfig = docType !== "unknown" && docType !== "form" ? docTypeConfig[docType as keyof typeof docTypeConfig] : null}
								<tr>
									<td>
										<span class="font-medium text-sm">{getEmailTypeLabel(log.emailType)}</span>
									</td>
									<td>
										{#if typeConfig}
											{@const DocIcon = typeConfig.icon}
											<div class="flex items-center gap-1.5">
												<DocIcon class="h-3.5 w-3.5" style="color: {typeConfig.color}" />
												<span class="text-xs text-base-content/70">{typeConfig.label}</span>
											</div>
										{:else if docType === "form"}
											<div class="flex items-center gap-1.5">
												<Send class="h-3.5 w-3.5 text-pink-500" />
												<span class="text-xs text-base-content/70">Form</span>
											</div>
										{/if}
									</td>
									<td>
										<span class="text-sm text-base-content/70">{log.recipientEmail}</span>
									</td>
									<td>
										{#if log.status === "sent" || log.status === "delivered"}
											<span class="badge badge-success badge-xs gap-1">
												<CheckCircle class="h-2.5 w-2.5" />
												Sent
											</span>
										{:else if log.status === "failed"}
											<span class="badge badge-error badge-xs gap-1">
												<AlertCircle class="h-2.5 w-2.5" />
												Failed
											</span>
										{:else}
											<span class="badge badge-ghost badge-xs">{log.status}</span>
										{/if}
									</td>
									<td>
										<span class="text-xs text-base-content/60 whitespace-nowrap">{formatDateTime(log.createdAt)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="text-sm text-base-content/50 text-center py-4">No emails sent yet</p>
			{/if}
		</div>
	</div>
</div>

<!-- Edit Client Modal -->
{#if showEditModal}
<dialog class="modal modal-open">
	<div class="modal-box">
		<button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => showEditModal = false} disabled={isSaving}>
			<X class="h-4 w-4" />
		</button>

		<div class="flex items-center gap-3 mb-4">
			<div class="flex h-10 w-10 items-center justify-center rounded-full" style="background-color: {FEATURES.clients.colorLight}; color: {FEATURES.clients.color}">
				<Pencil class="h-5 w-5" />
			</div>
			<h3 class="font-bold text-lg">Edit Client</h3>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
			<div class="space-y-4">
				<div class="form-control">
					<label class="label" for="edit-businessName">
						<span class="label-text">Business Name <span class="text-error">*</span></span>
					</label>
					<input
						type="text"
						id="edit-businessName"
						class="input input-bordered"
						bind:value={formData.businessName}
						required
					/>
				</div>

				<div class="form-control">
					<label class="label" for="edit-email">
						<span class="label-text">Email <span class="text-error">*</span></span>
					</label>
					<input
						type="email"
						id="edit-email"
						class="input input-bordered"
						bind:value={formData.email}
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="form-control">
						<label class="label" for="edit-contactName">
							<span class="label-text">Contact Name</span>
						</label>
						<input
							type="text"
							id="edit-contactName"
							class="input input-bordered"
							bind:value={formData.contactName}
						/>
					</div>

					<div class="form-control">
						<label class="label" for="edit-phone">
							<span class="label-text">Phone</span>
						</label>
						<input
							type="tel"
							id="edit-phone"
							class="input input-bordered"
							bind:value={formData.phone}
						/>
					</div>
				</div>

				<div class="form-control">
					<label class="label" for="edit-notes">
						<span class="label-text">Notes</span>
					</label>
					<textarea
						id="edit-notes"
						class="textarea textarea-bordered"
						rows="3"
						bind:value={formData.notes}
					></textarea>
				</div>
			</div>

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => showEditModal = false} disabled={isSaving}>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={isSaving}>
					{#if isSaving}
						<Loader2 class="h-4 w-4 animate-spin" />
						Saving...
					{:else}
						Save Changes
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button type="button" onclick={() => showEditModal = false} disabled={isSaving}>close</button>
	</form>
</dialog>
{/if}

/**
 * Email Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for email operations.
 * Handles sending emails with PDF attachments and email log management.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command, getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/public";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	emailLogs,
	proposals,
	invoices,
	contracts,
	agencies,
	agencyProfiles,
} from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { logActivity } from "$lib/server/db-helpers";
import { hasPermission } from "$lib/server/permissions";
import { getEffectiveBranding } from "$lib/server/document-branding";
import { eq, and, desc } from "drizzle-orm";
import { sendEmail } from "$lib/server/services/email.service";
import {
	fetchProposalPdf,
	fetchInvoicePdf,
	fetchContractPdf,
} from "$lib/server/services/pdf.service";
import {
	generateProposalEmail,
	generateInvoiceEmail,
	generateInvoiceReminderEmail,
	generateContractEmail,
	buildProposalEmailData,
	buildInvoiceEmailData,
	buildContractEmailData,
	type ReminderEmailData,
} from "$lib/templates/email-templates";

/**
 * Get the base URL for public links in emails
 * Uses PUBLIC_CLIENT_URL in dev, or constructs from PUBLIC_APP_DOMAIN in production
 */
function getPublicBaseUrl(): string {
	// PUBLIC_CLIENT_URL should be set correctly per environment:
	// - Dev: http://localhost:3000
	// - Production: https://webkit.au (or the production domain)
	return env.PUBLIC_CLIENT_URL || "https://webkit.au";
}

// =============================================================================
// Validation Schemas
// =============================================================================

const SendProposalEmailSchema = v.object({
	proposalId: v.pipe(v.string(), v.uuid()),
	customMessage: v.optional(v.string()),
});

const SendInvoiceEmailSchema = v.object({
	invoiceId: v.pipe(v.string(), v.uuid()),
	customMessage: v.optional(v.string()),
});

const SendContractEmailSchema = v.object({
	contractId: v.pipe(v.string(), v.uuid()),
	customMessage: v.optional(v.string()),
});

const ResendEmailSchema = v.object({
	emailLogId: v.pipe(v.string(), v.uuid()),
});

const SendInvoiceReminderSchema = v.object({
	invoiceId: v.pipe(v.string(), v.uuid()),
	customMessage: v.optional(v.string()),
});

const GetEmailLogsFilterSchema = v.optional(
	v.object({
		proposalId: v.optional(v.pipe(v.string(), v.uuid())),
		invoiceId: v.optional(v.pipe(v.string(), v.uuid())),
		contractId: v.optional(v.pipe(v.string(), v.uuid())),
		status: v.optional(v.string()),
		limit: v.optional(v.number()),
		offset: v.optional(v.number()),
	}),
);

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get email logs for the agency with optional filters
 */
export const getEmailLogs = query(GetEmailLogsFilterSchema, async (filters) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "email:view_logs")) {
		throw new Error("Permission denied");
	}

	const conditions = [eq(emailLogs.agencyId, context.agencyId)];

	if (filters?.proposalId) {
		conditions.push(eq(emailLogs.proposalId, filters.proposalId));
	}
	if (filters?.invoiceId) {
		conditions.push(eq(emailLogs.invoiceId, filters.invoiceId));
	}
	if (filters?.contractId) {
		conditions.push(eq(emailLogs.contractId, filters.contractId));
	}
	if (filters?.status) {
		conditions.push(eq(emailLogs.status, filters.status));
	}

	const logs = await db.query.emailLogs.findMany({
		where: and(...conditions),
		orderBy: [desc(emailLogs.createdAt)],
		limit: filters?.limit || 50,
		offset: filters?.offset || 0,
	});

	return logs;
});

/**
 * Get email logs for a specific entity (proposal, invoice, or contract)
 */
export const getEntityEmailLogs = query(
	v.object({
		proposalId: v.optional(v.pipe(v.string(), v.uuid())),
		invoiceId: v.optional(v.pipe(v.string(), v.uuid())),
		contractId: v.optional(v.pipe(v.string(), v.uuid())),
	}),
	async (params) => {
		const context = await getAgencyContext();

		// Members can see email history for entities they're working on
		const conditions = [eq(emailLogs.agencyId, context.agencyId)];

		if (params.proposalId) {
			conditions.push(eq(emailLogs.proposalId, params.proposalId));
		} else if (params.invoiceId) {
			conditions.push(eq(emailLogs.invoiceId, params.invoiceId));
		} else if (params.contractId) {
			conditions.push(eq(emailLogs.contractId, params.contractId));
		} else {
			return [];
		}

		const logs = await db.query.emailLogs.findMany({
			where: and(...conditions),
			orderBy: [desc(emailLogs.createdAt)],
			limit: 20,
		});

		return logs;
	},
);

// =============================================================================
// Command Functions
// =============================================================================

/**
 * Send proposal email with PDF attachment
 */
export const sendProposalEmail = command(SendProposalEmailSchema, async (data) => {
	const context = await getAgencyContext();
	const event = getRequestEvent();

	if (!hasPermission(context.role, "email:send")) {
		throw new Error("Permission denied");
	}

	// Fetch proposal with agency and profile
	const proposal = await db.query.proposals.findFirst({
		where: and(eq(proposals.id, data.proposalId), eq(proposals.agencyId, context.agencyId)),
	});

	if (!proposal) {
		throw new Error("Proposal not found");
	}

	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, context.agencyId),
	});

	if (!agency) {
		throw new Error("Agency not found");
	}

	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId),
	});

	// Get email-specific branding (with overrides if configured)
	const emailBranding = await getEffectiveBranding(context.agencyId, "email");

	// Generate public URL (absolute URL for email clients)
	const publicUrl = `${getPublicBaseUrl()}/p/${proposal.slug}`;

	// Build email template data with email branding overrides
	const agencyWithEmailBranding = {
		...agency,
		logoUrl: emailBranding.logoUrl || agency.logoUrl,
		primaryColor: emailBranding.primaryColor || agency.primaryColor,
	};
	const templateData = buildProposalEmailData(
		proposal,
		agencyWithEmailBranding,
		profile || null,
		publicUrl,
	);
	if (data.customMessage) {
		templateData.customMessage = data.customMessage;
	}

	// Generate email content
	const emailContent = generateProposalEmail(templateData);

	// Fetch PDF
	const cookieHeader = event.cookies
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	const pdfResult = await fetchProposalPdf(proposal.id, cookieHeader);

	// Create email log entry
	const [emailLog] = await db
		.insert(emailLogs)
		.values({
			agencyId: context.agencyId,
			proposalId: proposal.id,
			emailType: "proposal_sent",
			recipientEmail: proposal.clientEmail,
			recipientName: proposal.clientContactName || proposal.clientBusinessName,
			subject: emailContent.subject,
			bodyHtml: emailContent.bodyHtml,
			hasAttachment: pdfResult.success,
			attachmentFilename: pdfResult.filename,
			status: "pending",
			sentBy: context.userId,
		})
		.returning();

	// Build email options
	const emailOptions: Parameters<typeof sendEmail>[0] = {
		to: proposal.clientEmail,
		subject: emailContent.subject,
		html: emailContent.bodyHtml,
	};
	if (agency.email) {
		emailOptions.replyTo = agency.email;
	}
	if (pdfResult.success && pdfResult.buffer) {
		emailOptions.attachments = [
			{
				filename: pdfResult.filename || `${proposal.proposalNumber}.pdf`,
				content: pdfResult.buffer,
			},
		];
	}
	const result = await sendEmail(emailOptions);

	// Update email log with result
	if (emailLog) {
		await db
			.update(emailLogs)
			.set({
				status: result.success ? "sent" : "failed",
				resendMessageId: result.messageId,
				sentAt: result.success ? new Date() : null,
				errorMessage: result.error,
			})
			.where(eq(emailLogs.id, emailLog.id));
	}

	// Update proposal sentAt and status on successful send
	if (result.success) {
		const updates: Record<string, unknown> = { updatedAt: new Date() };

		// Set sentAt if first send
		if (!proposal.sentAt) {
			updates.sentAt = new Date();
		}

		// Change status to 'sent' if in draft or ready
		if (proposal.status === "draft" || proposal.status === "ready") {
			updates.status = "sent";
		}

		await db.update(proposals).set(updates).where(eq(proposals.id, proposal.id));
	}

	// Log activity
	await logActivity(result.success ? "email_sent" : "email_failed", "proposal", proposal.id, {
		metadata: { recipientEmail: proposal.clientEmail, error: result.error },
	});

	return {
		success: result.success,
		messageId: result.messageId,
		error: result.error,
	};
});

/**
 * Send invoice email with PDF attachment
 */
export const sendInvoiceEmail = command(SendInvoiceEmailSchema, async (data) => {
	const context = await getAgencyContext();
	const event = getRequestEvent();

	if (!hasPermission(context.role, "email:send")) {
		throw new Error("Permission denied");
	}

	// Fetch invoice with agency and profile
	const invoice = await db.query.invoices.findFirst({
		where: and(eq(invoices.id, data.invoiceId), eq(invoices.agencyId, context.agencyId)),
	});

	if (!invoice) {
		throw new Error("Invoice not found");
	}

	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, context.agencyId),
	});

	if (!agency) {
		throw new Error("Agency not found");
	}

	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId),
	});

	// Get email-specific branding (with overrides if configured)
	const emailBranding = await getEffectiveBranding(context.agencyId, "email");

	// Generate public URL (absolute URL for email clients)
	const publicUrl = `${getPublicBaseUrl()}/i/${invoice.slug}`;

	// Build email template data with email branding overrides
	const agencyWithEmailBranding = {
		...agency,
		logoUrl: emailBranding.logoUrl || agency.logoUrl,
		primaryColor: emailBranding.primaryColor || agency.primaryColor,
	};
	const templateData = buildInvoiceEmailData(
		invoice,
		agencyWithEmailBranding,
		profile || null,
		publicUrl,
		(invoice as unknown as { stripePaymentLinkUrl?: string }).stripePaymentLinkUrl,
	);
	if (data.customMessage) {
		templateData.customMessage = data.customMessage;
	}

	// Generate email content
	const emailContent = generateInvoiceEmail(templateData);

	// Fetch PDF
	const cookieHeader = event.cookies
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	const pdfResult = await fetchInvoicePdf(invoice.id, cookieHeader);

	// Create email log entry
	const [emailLog] = await db
		.insert(emailLogs)
		.values({
			agencyId: context.agencyId,
			invoiceId: invoice.id,
			emailType: "invoice_sent",
			recipientEmail: invoice.clientEmail,
			recipientName: invoice.clientContactName || invoice.clientBusinessName,
			subject: emailContent.subject,
			bodyHtml: emailContent.bodyHtml,
			hasAttachment: pdfResult.success,
			attachmentFilename: pdfResult.filename,
			status: "pending",
			sentBy: context.userId,
		})
		.returning();

	// Build email options
	const emailOptions: Parameters<typeof sendEmail>[0] = {
		to: invoice.clientEmail,
		subject: emailContent.subject,
		html: emailContent.bodyHtml,
	};
	if (agency.email) {
		emailOptions.replyTo = agency.email;
	}
	if (pdfResult.success && pdfResult.buffer) {
		emailOptions.attachments = [
			{ filename: pdfResult.filename || `${invoice.invoiceNumber}.pdf`, content: pdfResult.buffer },
		];
	}
	const result = await sendEmail(emailOptions);

	// Update email log with result
	if (emailLog) {
		await db
			.update(emailLogs)
			.set({
				status: result.success ? "sent" : "failed",
				resendMessageId: result.messageId,
				sentAt: result.success ? new Date() : null,
				errorMessage: result.error,
			})
			.where(eq(emailLogs.id, emailLog.id));
	}

	// Update invoice sentAt and status if first send
	if (result.success && !invoice.sentAt) {
		await db
			.update(invoices)
			.set({
				sentAt: new Date(),
				status: invoice.status === "draft" ? "sent" : invoice.status,
				updatedAt: new Date(),
			})
			.where(eq(invoices.id, invoice.id));
	}

	// Log activity
	await logActivity(result.success ? "email_sent" : "email_failed", "invoice", invoice.id, {
		metadata: { recipientEmail: invoice.clientEmail, error: result.error },
	});

	return {
		success: result.success,
		messageId: result.messageId,
		error: result.error,
	};
});

/**
 * Send invoice payment reminder email
 */
export const sendInvoiceReminder = command(SendInvoiceReminderSchema, async (data) => {
	const context = await getAgencyContext();
	const event = getRequestEvent();

	if (!hasPermission(context.role, "email:send")) {
		throw new Error("Permission denied");
	}

	// Fetch invoice with agency and profile
	const invoice = await db.query.invoices.findFirst({
		where: and(eq(invoices.id, data.invoiceId), eq(invoices.agencyId, context.agencyId)),
	});

	if (!invoice) {
		throw new Error("Invoice not found");
	}

	// Only allow reminders for sent/viewed/overdue invoices
	if (!["sent", "viewed", "overdue"].includes(invoice.status)) {
		throw new Error("Can only send reminders for sent, viewed, or overdue invoices");
	}

	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, context.agencyId),
	});

	if (!agency) {
		throw new Error("Agency not found");
	}

	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId),
	});

	// Get email-specific branding (with overrides if configured)
	const emailBranding = await getEffectiveBranding(context.agencyId, "email");

	// Generate public URL (absolute URL for email clients)
	const publicUrl = `${getPublicBaseUrl()}/i/${invoice.slug}`;

	// Calculate if overdue and days past due
	const now = new Date();
	const dueDate = new Date(invoice.dueDate);
	const isOverdue = now > dueDate;
	const daysPastDue = isOverdue
		? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
		: 0;

	// Build reminder email template data with email branding overrides
	const agencyWithEmailBranding = {
		...agency,
		logoUrl: emailBranding.logoUrl || agency.logoUrl,
		primaryColor: emailBranding.primaryColor || agency.primaryColor,
	};
	const baseData = buildInvoiceEmailData(
		invoice,
		agencyWithEmailBranding,
		profile || null,
		publicUrl,
		(invoice as unknown as { stripePaymentLinkUrl?: string }).stripePaymentLinkUrl,
	);

	const reminderData: ReminderEmailData = {
		...baseData,
		isOverdue,
		daysPastDue: daysPastDue > 0 ? daysPastDue : undefined,
	};

	if (data.customMessage) {
		reminderData.customMessage = data.customMessage;
	}

	// Generate reminder email content
	const emailContent = generateInvoiceReminderEmail(reminderData);

	// Fetch PDF
	const cookieHeader = event.cookies
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	const pdfResult = await fetchInvoicePdf(invoice.id, cookieHeader);

	// Create email log entry
	const [emailLog] = await db
		.insert(emailLogs)
		.values({
			agencyId: context.agencyId,
			invoiceId: invoice.id,
			emailType: isOverdue ? "invoice_overdue_reminder" : "invoice_reminder",
			recipientEmail: invoice.clientEmail,
			recipientName: invoice.clientContactName || invoice.clientBusinessName,
			subject: emailContent.subject,
			bodyHtml: emailContent.bodyHtml,
			hasAttachment: pdfResult.success,
			attachmentFilename: pdfResult.filename,
			status: "pending",
			sentBy: context.userId,
		})
		.returning();

	// Build email options
	const emailOptions: Parameters<typeof sendEmail>[0] = {
		to: invoice.clientEmail,
		subject: emailContent.subject,
		html: emailContent.bodyHtml,
	};
	if (agency.email) {
		emailOptions.replyTo = agency.email;
	}
	if (pdfResult.success && pdfResult.buffer) {
		emailOptions.attachments = [
			{ filename: pdfResult.filename || `${invoice.invoiceNumber}.pdf`, content: pdfResult.buffer },
		];
	}
	const result = await sendEmail(emailOptions);

	// Update email log with result
	if (emailLog) {
		await db
			.update(emailLogs)
			.set({
				status: result.success ? "sent" : "failed",
				resendMessageId: result.messageId,
				sentAt: result.success ? new Date() : null,
				errorMessage: result.error,
			})
			.where(eq(emailLogs.id, emailLog.id));
	}

	// Log activity
	await logActivity(result.success ? "reminder_sent" : "reminder_failed", "invoice", invoice.id, {
		metadata: { recipientEmail: invoice.clientEmail, isOverdue, daysPastDue, error: result.error },
	});

	return {
		success: result.success,
		messageId: result.messageId,
		error: result.error,
	};
});

/**
 * Send contract email with PDF attachment
 */
export const sendContractEmail = command(SendContractEmailSchema, async (data) => {
	const context = await getAgencyContext();
	const event = getRequestEvent();

	if (!hasPermission(context.role, "email:send")) {
		throw new Error("Permission denied");
	}

	// Fetch contract with agency and profile
	const contract = await db.query.contracts.findFirst({
		where: and(eq(contracts.id, data.contractId), eq(contracts.agencyId, context.agencyId)),
	});

	if (!contract) {
		throw new Error("Contract not found");
	}

	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, context.agencyId),
	});

	if (!agency) {
		throw new Error("Agency not found");
	}

	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, context.agencyId),
	});

	// Get email-specific branding (with overrides if configured)
	const emailBranding = await getEffectiveBranding(context.agencyId, "email");

	// Generate public URL (absolute URL for email clients)
	const publicUrl = `${getPublicBaseUrl()}/c/${contract.slug}`;

	// Build email template data with email branding overrides
	const agencyWithEmailBranding = {
		...agency,
		logoUrl: emailBranding.logoUrl || agency.logoUrl,
		primaryColor: emailBranding.primaryColor || agency.primaryColor,
	};
	const templateData = buildContractEmailData(
		contract,
		agencyWithEmailBranding,
		profile || null,
		publicUrl,
	);
	if (data.customMessage) {
		templateData.customMessage = data.customMessage;
	}

	// Generate email content
	const emailContent = generateContractEmail(templateData);

	// Fetch PDF
	const cookieHeader = event.cookies
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	const pdfResult = await fetchContractPdf(contract.id, cookieHeader);

	// Create email log entry
	const [emailLog] = await db
		.insert(emailLogs)
		.values({
			agencyId: context.agencyId,
			contractId: contract.id,
			emailType: "contract_sent",
			recipientEmail: contract.clientEmail,
			recipientName: contract.clientContactName || contract.clientBusinessName,
			subject: emailContent.subject,
			bodyHtml: emailContent.bodyHtml,
			hasAttachment: pdfResult.success,
			attachmentFilename: pdfResult.filename,
			status: "pending",
			sentBy: context.userId,
		})
		.returning();

	// Build email options
	const emailOptions: Parameters<typeof sendEmail>[0] = {
		to: contract.clientEmail,
		subject: emailContent.subject,
		html: emailContent.bodyHtml,
	};
	if (agency.email) {
		emailOptions.replyTo = agency.email;
	}
	if (pdfResult.success && pdfResult.buffer) {
		emailOptions.attachments = [
			{
				filename: pdfResult.filename || `${contract.contractNumber}.pdf`,
				content: pdfResult.buffer,
			},
		];
	}
	const result = await sendEmail(emailOptions);

	// Update email log with result
	if (emailLog) {
		await db
			.update(emailLogs)
			.set({
				status: result.success ? "sent" : "failed",
				resendMessageId: result.messageId,
				sentAt: result.success ? new Date() : null,
				errorMessage: result.error,
			})
			.where(eq(emailLogs.id, emailLog.id));
	}

	// Update contract sentAt and status if first send
	if (result.success && !contract.sentAt) {
		await db
			.update(contracts)
			.set({
				sentAt: new Date(),
				status: contract.status === "draft" ? "sent" : contract.status,
				updatedAt: new Date(),
			})
			.where(eq(contracts.id, contract.id));
	}

	// Log activity
	await logActivity(result.success ? "email_sent" : "email_failed", "contract", contract.id, {
		metadata: { recipientEmail: contract.clientEmail, error: result.error },
	});

	return {
		success: result.success,
		messageId: result.messageId,
		error: result.error,
	};
});

/**
 * Resend a previously sent email
 */
export const resendEmail = command(ResendEmailSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, "email:resend")) {
		throw new Error("Permission denied");
	}

	// Fetch original email log
	const originalLog = await db.query.emailLogs.findFirst({
		where: and(eq(emailLogs.id, data.emailLogId), eq(emailLogs.agencyId, context.agencyId)),
	});

	if (!originalLog) {
		throw new Error("Email log not found");
	}

	// Create new email log for retry
	const [newLog] = await db
		.insert(emailLogs)
		.values({
			agencyId: context.agencyId,
			proposalId: originalLog.proposalId,
			invoiceId: originalLog.invoiceId,
			contractId: originalLog.contractId,
			emailType: originalLog.emailType,
			recipientEmail: originalLog.recipientEmail,
			recipientName: originalLog.recipientName,
			subject: originalLog.subject,
			bodyHtml: originalLog.bodyHtml,
			hasAttachment: false, // Attachments need to be regenerated
			status: "pending",
			retryCount: (originalLog.retryCount || 0) + 1,
			sentBy: context.userId,
		})
		.returning();

	// Send email (without attachment for resend)
	const result = await sendEmail({
		to: originalLog.recipientEmail,
		subject: originalLog.subject,
		html: originalLog.bodyHtml,
	});

	// Update email log with result
	if (newLog) {
		await db
			.update(emailLogs)
			.set({
				status: result.success ? "sent" : "failed",
				resendMessageId: result.messageId,
				sentAt: result.success ? new Date() : null,
				errorMessage: result.error,
			})
			.where(eq(emailLogs.id, newLog.id));
	}

	return {
		success: result.success,
		messageId: result.messageId,
		error: result.error,
	};
});

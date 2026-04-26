/**
 * Server-side contract email utilities.
 * Used by contracts.remote.ts to send emails on contract lifecycle events.
 * Separated because remote functions cannot call other remote functions.
 */

import { db } from "$lib/server/db";
import { emailLogs, agencies, agencyProfiles, contracts } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "$lib/server/services/email.service";
import { getEffectiveBranding } from "$lib/server/document-branding";
import { fetchContractPdf } from "$lib/server/services/pdf.service";
import {
	buildContractEmailData,
	generateContractEmail,
	generateContractSignedClientEmail,
	generateContractSignedAgencyEmail,
	type ContractSignedNotificationData,
} from "$lib/templates/email-templates";
import { env } from "$env/dynamic/public";

function getPublicBaseUrl(): string {
	return env.PUBLIC_CLIENT_URL || "https://webkit.au";
}

/**
 * Send a contract email to the client (for send/resend).
 * Handles agency/profile lookup, branding, PDF attachment, email log.
 */
export async function sendContractEmailToClient(
	contract: typeof contracts.$inferSelect,
	sentBy: string,
	cookieHeader?: string,
): Promise<{ success: boolean; error?: string }> {
	// Fetch agency
	const agency = await db.query.agencies.findFirst({
		where: eq(agencies.id, contract.agencyId),
	});

	if (!agency) {
		return { success: false, error: "Agency not found" };
	}

	// Fetch agency profile
	const profile = await db.query.agencyProfiles.findFirst({
		where: eq(agencyProfiles.agencyId, contract.agencyId),
	});

	// Get email-specific branding (with overrides if configured)
	const emailBranding = await getEffectiveBranding(contract.agencyId, "email");

	// Generate public URL
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

	// Generate email content
	const emailContent = generateContractEmail(templateData);

	// Optionally fetch PDF if cookieHeader provided
	let pdfResult: { success: boolean; buffer?: Buffer; filename?: string } = { success: false };
	if (cookieHeader) {
		pdfResult = await fetchContractPdf(contract.id, cookieHeader);
	}

	// Create email log entry
	const [emailLog] = await db
		.insert(emailLogs)
		.values({
			agencyId: contract.agencyId,
			contractId: contract.id,
			emailType: "contract_sent",
			recipientEmail: contract.clientEmail,
			recipientName: contract.clientContactName || contract.clientBusinessName,
			subject: emailContent.subject,
			bodyHtml: emailContent.bodyHtml,
			hasAttachment: pdfResult.success,
			attachmentFilename: pdfResult.filename,
			status: "pending",
			sentBy,
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

	return {
		success: result.success,
		...(result.error && { error: result.error }),
	};
}

/**
 * Send signature confirmation emails after a client signs.
 * Sends two emails:
 * 1. Confirmation to the client
 * 2. Notification to the agency
 */
export async function sendContractSignedEmails(
	contract: typeof contracts.$inferSelect,
	signatoryName: string,
): Promise<void> {
	try {
		// Fetch agency
		const agency = await db.query.agencies.findFirst({
			where: eq(agencies.id, contract.agencyId),
		});

		if (!agency) {
			console.error("Contract signed emails: agency not found", contract.agencyId);
			return;
		}

		// Fetch agency profile
		const profile = await db.query.agencyProfiles.findFirst({
			where: eq(agencyProfiles.agencyId, contract.agencyId),
		});

		const publicUrl = `${getPublicBaseUrl()}/c/${contract.slug}`;

		const notificationData: ContractSignedNotificationData = {
			agency: {
				name: profile?.tradingName || agency.name,
				email: agency.email || undefined,
				primaryColor: agency.primaryColor || undefined,
				logoUrl: agency.logoUrl || undefined,
			},
			contract: {
				number: contract.contractNumber,
				publicUrl,
			},
			client: {
				name: contract.clientContactName || contract.clientBusinessName,
				businessName: contract.clientBusinessName || undefined,
				email: contract.clientEmail,
			},
			signedAt: new Date().toISOString(),
			signatoryName,
		};

		// Send confirmation to client
		const clientEmail = generateContractSignedClientEmail(notificationData);
		const clientResult = await sendEmail({
			to: contract.clientEmail,
			subject: clientEmail.subject,
			html: clientEmail.bodyHtml,
			...(agency.email && { replyTo: agency.email }),
		});

		// Log client confirmation email
		await db.insert(emailLogs).values({
			agencyId: contract.agencyId,
			contractId: contract.id,
			emailType: "contract_signed_confirmation",
			recipientEmail: contract.clientEmail,
			recipientName: contract.clientContactName || contract.clientBusinessName,
			subject: clientEmail.subject,
			bodyHtml: clientEmail.bodyHtml,
			hasAttachment: false,
			status: clientResult.success ? "sent" : "failed",
			resendMessageId: clientResult.messageId,
			sentAt: clientResult.success ? new Date() : null,
			errorMessage: clientResult.error,
		});

		// Send notification to agency
		if (agency.email) {
			const agencyEmail = generateContractSignedAgencyEmail(notificationData);
			const agencyResult = await sendEmail({
				to: agency.email,
				subject: agencyEmail.subject,
				html: agencyEmail.bodyHtml,
			});

			// Log agency notification email
			await db.insert(emailLogs).values({
				agencyId: contract.agencyId,
				contractId: contract.id,
				emailType: "contract_signed_notification",
				recipientEmail: agency.email,
				recipientName: agency.name,
				subject: agencyEmail.subject,
				bodyHtml: agencyEmail.bodyHtml,
				hasAttachment: false,
				status: agencyResult.success ? "sent" : "failed",
				resendMessageId: agencyResult.messageId,
				sentAt: agencyResult.success ? new Date() : null,
				errorMessage: agencyResult.error,
			});
		}
	} catch (err) {
		console.error("Failed to send contract signed emails:", err);
	}
}

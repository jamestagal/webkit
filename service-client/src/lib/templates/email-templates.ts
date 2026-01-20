/**
 * Email Templates
 *
 * Generates professional HTML emails for proposals, invoices, and contracts.
 * Uses inline styles for maximum email client compatibility.
 */

import type { Agency, AgencyProfile, Proposal, Invoice, Contract } from "$lib/server/schema";

// =============================================================================
// Template Data Interfaces
// =============================================================================

export interface EmailTemplateData {
	agency: {
		name: string;
		email?: string | undefined;
		phone?: string | undefined;
		logoUrl?: string | undefined;
		primaryColor?: string | undefined;
		website?: string | undefined;
	};
	recipient: {
		name: string;
		businessName?: string | undefined;
		email: string;
	};
	document: {
		type: "proposal" | "invoice" | "contract";
		number: string;
		publicUrl: string;
		total?: string | undefined;
		dueDate?: string | undefined;
		paymentLinkUrl?: string | undefined; // Phase 5 integration
	};
	customMessage?: string | undefined;
}

export interface EmailTemplate {
	subject: string;
	bodyHtml: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a decimal string or number as currency (AUD)
 */
function formatCurrency(value: string | number | null | undefined): string {
	const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
		minimumFractionDigits: 2,
	}).format(num);
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string | null | undefined): string {
	if (!date) return "";
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

/**
 * Get default primary color
 */
function getColor(color?: string): string {
	return color || "#4F46E5";
}

// =============================================================================
// Base Email Wrapper
// =============================================================================

function wrapEmail(
	content: string,
	primaryColor: string,
	logoUrl?: string,
	agencyName?: string,
): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto;">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: ${primaryColor}; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                            ${
															logoUrl
																? `<img src="${logoUrl}" alt="${agencyName || "Logo"}" style="max-height: 48px; max-width: 200px;">`
																: `<span style="color: white; font-size: 24px; font-weight: 600;">${agencyName || ""}</span>`
														}
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="background-color: white; padding: 32px; border-radius: 0 0 8px 8px;">
                            ${content}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px; text-align: center; color: #6b7280; font-size: 12px;">
                            <p style="margin: 0;">This email was sent by ${agencyName || "our team"}.</p>
                            <p style="margin: 8px 0 0 0;">If you have any questions, please reply to this email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// =============================================================================
// Proposal Email Template
// =============================================================================

export function generateProposalEmail(data: EmailTemplateData): EmailTemplate {
	const { agency, recipient, document, customMessage } = data;
	const primaryColor = getColor(agency.primaryColor);

	const content = `
        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 20px;">
            Hi ${recipient.name},
        </h2>

        <p style="margin: 0 0 16px 0; color: #4b5563;">
            ${customMessage || `Thank you for your interest in working with ${agency.name}. We've prepared a proposal tailored to your needs.`}
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                    <td style="color: #6b7280; font-size: 14px;">Proposal Number</td>
                    <td style="text-align: right; color: #1f2937; font-weight: 600;">${document.number}</td>
                </tr>
                ${
									document.total
										? `
                <tr>
                    <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">Total Value</td>
                    <td style="text-align: right; color: #1f2937; font-weight: 600; padding-top: 12px;">${formatCurrency(document.total)}</td>
                </tr>
                `
										: ""
								}
            </table>
        </div>

        <p style="margin: 0 0 24px 0; color: #4b5563;">
            Please review the proposal and let us know if you have any questions. You can view the full details by clicking the button below.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${document.publicUrl}"
               style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Proposal
            </a>
        </div>

        <p style="margin: 24px 0 0 0; color: #4b5563;">
            Best regards,<br>
            <strong>${agency.name}</strong>
        </p>
    `;

	return {
		subject: `Proposal ${document.number} from ${agency.name}`,
		bodyHtml: wrapEmail(content, primaryColor, agency.logoUrl, agency.name),
	};
}

// =============================================================================
// Invoice Email Template
// =============================================================================

export function generateInvoiceEmail(data: EmailTemplateData): EmailTemplate {
	const { agency, recipient, document, customMessage } = data;
	const primaryColor = getColor(agency.primaryColor);

	const paymentButton = document.paymentLinkUrl
		? `
        <div style="text-align: center; margin: 24px 0;">
            <a href="${document.paymentLinkUrl}"
               style="display: inline-block; background-color: #059669; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Pay ${formatCurrency(document.total)} Now
            </a>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">
                Secure payment via Stripe
            </p>
        </div>
    `
		: "";

	const content = `
        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 20px;">
            Hi ${recipient.name},
        </h2>

        <p style="margin: 0 0 16px 0; color: #4b5563;">
            ${customMessage || `Please find attached your invoice from ${agency.name}.`}
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                    <td style="color: #6b7280; font-size: 14px;">Invoice Number</td>
                    <td style="text-align: right; color: #1f2937; font-weight: 600;">${document.number}</td>
                </tr>
                <tr>
                    <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">Amount Due</td>
                    <td style="text-align: right; color: #1f2937; font-weight: 600; font-size: 18px; padding-top: 12px;">
                        ${formatCurrency(document.total)}
                    </td>
                </tr>
                ${
									document.dueDate
										? `
                <tr>
                    <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">Due Date</td>
                    <td style="text-align: right; color: #1f2937; font-weight: 600; padding-top: 12px;">${document.dueDate}</td>
                </tr>
                `
										: ""
								}
            </table>
        </div>

        ${paymentButton}

        <div style="text-align: center; margin: 24px 0;">
            <a href="${document.publicUrl}"
               style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Invoice
            </a>
        </div>

        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
            A PDF copy of this invoice is attached to this email.
        </p>

        <p style="margin: 24px 0 0 0; color: #4b5563;">
            Thank you for your business,<br>
            <strong>${agency.name}</strong>
        </p>
    `;

	return {
		subject: `Invoice ${document.number} from ${agency.name}`,
		bodyHtml: wrapEmail(content, primaryColor, agency.logoUrl, agency.name),
	};
}

// =============================================================================
// Invoice Reminder Email Template
// =============================================================================

export interface ReminderEmailData extends EmailTemplateData {
	isOverdue: boolean;
	daysPastDue?: number;
}

export function generateInvoiceReminderEmail(data: ReminderEmailData): EmailTemplate {
	const { agency, recipient, document, customMessage, isOverdue, daysPastDue } = data;
	const primaryColor = getColor(agency.primaryColor);

	// Different messaging for overdue vs friendly reminder
	let reminderMessage: string;
	let subjectPrefix: string;

	if (isOverdue && daysPastDue) {
		subjectPrefix = "Overdue: ";
		reminderMessage =
			customMessage ||
			`This is a reminder that Invoice ${document.number} is now ${daysPastDue} day${daysPastDue === 1 ? "" : "s"} overdue. Please arrange payment at your earliest convenience.`;
	} else {
		subjectPrefix = "Reminder: ";
		reminderMessage =
			customMessage ||
			`This is a friendly reminder that Invoice ${document.number} is due on ${document.dueDate}. Please arrange payment by the due date to avoid any late fees.`;
	}

	const paymentButton = document.paymentLinkUrl
		? `
        <div style="text-align: center; margin: 24px 0;">
            <a href="${document.paymentLinkUrl}"
               style="display: inline-block; background-color: #059669; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Pay ${formatCurrency(document.total)} Now
            </a>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">
                Secure payment via Stripe
            </p>
        </div>
    `
		: "";

	const urgencyBanner = isOverdue
		? `
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: 600;">
                ⚠️ This invoice is overdue
            </p>
        </div>
    `
		: "";

	const content = `
        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 20px;">
            Hi ${recipient.name},
        </h2>

        ${urgencyBanner}

        <p style="margin: 0 0 16px 0; color: #4b5563;">
            ${reminderMessage}
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                    <td style="color: #6b7280; font-size: 14px;">Invoice Number</td>
                    <td style="text-align: right; color: #1f2937; font-weight: 600;">${document.number}</td>
                </tr>
                <tr>
                    <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">Amount Due</td>
                    <td style="text-align: right; color: ${isOverdue ? "#dc2626" : "#1f2937"}; font-weight: 600; font-size: 18px; padding-top: 12px;">
                        ${formatCurrency(document.total)}
                    </td>
                </tr>
                ${
									document.dueDate
										? `
                <tr>
                    <td style="color: #6b7280; font-size: 14px; padding-top: 12px;">Due Date</td>
                    <td style="text-align: right; color: ${isOverdue ? "#dc2626" : "#1f2937"}; font-weight: 600; padding-top: 12px;">${document.dueDate}</td>
                </tr>
                `
										: ""
								}
            </table>
        </div>

        ${paymentButton}

        <div style="text-align: center; margin: 24px 0;">
            <a href="${document.publicUrl}"
               style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Invoice
            </a>
        </div>

        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
            If you have already made this payment, please disregard this reminder.
        </p>

        <p style="margin: 24px 0 0 0; color: #4b5563;">
            Thank you,<br>
            <strong>${agency.name}</strong>
        </p>
    `;

	return {
		subject: `${subjectPrefix}Invoice ${document.number} from ${agency.name}`,
		bodyHtml: wrapEmail(content, primaryColor, agency.logoUrl, agency.name),
	};
}

// =============================================================================
// Contract Email Template
// =============================================================================

export function generateContractEmail(data: EmailTemplateData): EmailTemplate {
	const { agency, recipient, document, customMessage } = data;
	const primaryColor = getColor(agency.primaryColor);

	const content = `
        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 20px;">
            Hi ${recipient.name},
        </h2>

        <p style="margin: 0 0 16px 0; color: #4b5563;">
            ${customMessage || `${agency.name} has sent you a contract for your review and signature.`}
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                    <td style="color: #6b7280; font-size: 14px;">Contract Reference</td>
                    <td style="text-align: right; color: #1f2937; font-weight: 600;">${document.number}</td>
                </tr>
            </table>
        </div>

        <p style="margin: 0 0 24px 0; color: #4b5563;">
            Please review the contract carefully. Once you're ready, you can sign it electronically by clicking the button below.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${document.publicUrl}"
               style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Review & Sign Contract
            </a>
        </div>

        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
            A PDF copy of this contract is attached for your records.
        </p>

        <p style="margin: 24px 0 0 0; color: #4b5563;">
            Best regards,<br>
            <strong>${agency.name}</strong>
        </p>
    `;

	return {
		subject: `Contract from ${agency.name} - Please Review and Sign`,
		bodyHtml: wrapEmail(content, primaryColor, agency.logoUrl, agency.name),
	};
}

// =============================================================================
// Helper Functions for Building Template Data
// =============================================================================

export function buildProposalEmailData(
	proposal: Proposal,
	agency: Agency,
	profile: AgencyProfile | null,
	publicUrl: string,
): EmailTemplateData {
	return {
		agency: {
			name: profile?.tradingName || agency.name,
			email: agency.email || undefined,
			phone: agency.phone || undefined,
			logoUrl: agency.logoUrl || undefined,
			primaryColor: agency.primaryColor || undefined,
			website: agency.website || undefined,
		},
		recipient: {
			name: proposal.clientContactName || proposal.clientBusinessName,
			businessName: proposal.clientBusinessName || undefined,
			email: proposal.clientEmail,
		},
		document: {
			type: "proposal",
			number: proposal.proposalNumber,
			publicUrl,
		},
	};
}

export function buildInvoiceEmailData(
	invoice: Invoice,
	agency: Agency,
	profile: AgencyProfile | null,
	publicUrl: string,
	paymentLinkUrl?: string,
): EmailTemplateData {
	return {
		agency: {
			name: profile?.tradingName || agency.name,
			email: agency.email || undefined,
			phone: agency.phone || undefined,
			logoUrl: agency.logoUrl || undefined,
			primaryColor: agency.primaryColor || undefined,
			website: agency.website || undefined,
		},
		recipient: {
			name: invoice.clientContactName || invoice.clientBusinessName,
			businessName: invoice.clientBusinessName || undefined,
			email: invoice.clientEmail,
		},
		document: {
			type: "invoice",
			number: invoice.invoiceNumber,
			publicUrl,
			total: invoice.total?.toString(),
			dueDate: formatDate(invoice.dueDate),
			paymentLinkUrl,
		},
	};
}

export function buildContractEmailData(
	contract: Contract,
	agency: Agency,
	profile: AgencyProfile | null,
	publicUrl: string,
): EmailTemplateData {
	return {
		agency: {
			name: profile?.tradingName || agency.name,
			email: agency.email || undefined,
			phone: agency.phone || undefined,
			logoUrl: agency.logoUrl || undefined,
			primaryColor: agency.primaryColor || undefined,
			website: agency.website || undefined,
		},
		recipient: {
			name: contract.clientContactName || contract.clientBusinessName,
			businessName: contract.clientBusinessName || undefined,
			email: contract.clientEmail,
		},
		document: {
			type: "contract",
			number: contract.contractNumber,
			publicUrl,
		},
	};
}

// =============================================================================
// Questionnaire Completion Notification (to agency)
// =============================================================================

export interface QuestionnaireNotificationData {
	agency: {
		name: string;
		primaryColor?: string | undefined;
		logoUrl?: string | undefined;
	};
	client: {
		name: string;
		businessName?: string | undefined;
		email: string;
	};
	contract?: {
		number: string;
	};
	questionnaireUrl: string;
}

// =============================================================================
// Team Invitation Email Templates
// =============================================================================

export interface TeamInvitationData {
	agency: {
		name: string;
		primaryColor?: string | undefined;
		logoUrl?: string | undefined;
	};
	invitee: {
		email: string;
	};
	inviter: {
		name: string;
	};
	role: "admin" | "member";
	loginUrl: string;
}

/**
 * Generate invitation email for NEW users who don't have an account yet
 */
export function generateTeamInvitationEmail(data: TeamInvitationData): EmailTemplate {
	const { agency, invitee, inviter, role, loginUrl } = data;
	const primaryColor = getColor(agency.primaryColor);

	const roleDescription =
		role === "admin"
			? "As an Admin, you can manage all agency work and invite new members."
			: "As a Member, you can create and manage your own consultations and proposals.";

	const content = `
        <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #111827;">
            You're invited to join ${agency.name}
        </h1>

        <p style="margin: 0 0 16px 0; color: #4b5563;">
            <strong>${inviter.name}</strong> has invited you to join <strong>${agency.name}</strong> on Webkit as a <strong>${role === "admin" ? "Admin" : "Member"}</strong>.
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; color: #4b5563; font-size: 14px;">
                ${roleDescription}
            </p>
        </div>

        <p style="margin: 0 0 24px 0; color: #4b5563;">
            Click the button below to sign in and access your agency workspace. You can sign in using Google or a Magic Link sent to ${invitee.email}.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}"
               style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Accept Invitation & Sign In
            </a>
        </div>

        <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
            If you weren't expecting this invitation, you can safely ignore this email.
        </p>
    `;

	return {
		subject: `You've been invited to join ${agency.name} on Webkit`,
		bodyHtml: wrapEmail(content, primaryColor, agency.logoUrl, agency.name),
	};
}

/**
 * Generate notification email for EXISTING users who already have an account
 */
export function generateTeamAddedEmail(data: TeamInvitationData): EmailTemplate {
	const { agency, inviter, role, loginUrl } = data;
	const primaryColor = getColor(agency.primaryColor);

	const roleDescription =
		role === "admin"
			? "As an Admin, you can manage all agency work and invite new members."
			: "As a Member, you can create and manage your own consultations and proposals.";

	const content = `
        <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #111827;">
            You've been added to ${agency.name}
        </h1>

        <p style="margin: 0 0 16px 0; color: #4b5563;">
            <strong>${inviter.name}</strong> has added you to <strong>${agency.name}</strong> as a <strong>${role === "admin" ? "Admin" : "Member"}</strong>.
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; color: #4b5563; font-size: 14px;">
                ${roleDescription}
            </p>
        </div>

        <p style="margin: 0 0 24px 0; color: #4b5563;">
            You can now access this agency from your account. Click the button below to go to the agency workspace.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}"
               style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Go to ${agency.name}
            </a>
        </div>
    `;

	return {
		subject: `You've been added to ${agency.name}`,
		bodyHtml: wrapEmail(content, primaryColor, agency.logoUrl, agency.name),
	};
}

// =============================================================================
// Questionnaire Completion Notification (to agency)
// =============================================================================

/**
 * Generate email notification to agency when client completes questionnaire
 */
export function generateQuestionnaireCompletedEmail(
	data: QuestionnaireNotificationData,
): EmailTemplate {
	const { agency, client, contract, questionnaireUrl } = data;
	const primaryColor = getColor(agency.primaryColor);

	const content = `
        <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #111827;">
            Questionnaire Completed
        </h1>

        <p style="margin: 0 0 16px 0; color: #4b5563;">
            Great news! <strong>${client.name}</strong>${client.businessName ? ` (${client.businessName})` : ""} has completed their Initial Website Questionnaire.
        </p>

        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Client Name:</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">${client.name}</td>
                </tr>
                ${
									client.businessName
										? `
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Business:</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">${client.businessName}</td>
                </tr>
                `
										: ""
								}
                ${
									contract
										? `
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Contract #:</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">${contract.number}</td>
                </tr>
                `
										: ""
								}
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                    <td style="padding: 8px 0; color: #111827; text-align: right;">${client.email}</td>
                </tr>
            </table>
        </div>

        <p style="margin: 0 0 24px 0; color: #4b5563;">
            You can now review their responses and start working on their website.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${questionnaireUrl}"
               style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 14px 32px;
                      text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Questionnaire Responses
            </a>
        </div>
    `;

	return {
		subject: `${client.name} has completed their Website Questionnaire`,
		bodyHtml: wrapEmail(content, primaryColor, agency.logoUrl, agency.name),
	};
}

// =============================================================================
// Beta Invite Email Template
// =============================================================================

export interface BetaInviteEmailData {
	inviteUrl: string;
	expiresAt: Date;
}

/**
 * Generate beta tester invitation email
 */
export function generateBetaInviteEmail(data: BetaInviteEmailData): EmailTemplate {
	const { inviteUrl, expiresAt } = data;
	const primaryColor = "#4F46E5"; // WebKit brand color

	const formattedExpiry = formatDate(expiresAt);

	const content = `
        <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #111827;">
            You're Invited to WebKit Beta! 🎉
        </h1>

        <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px;">
            You've been selected for <strong>early access</strong> to WebKit – the professional proposal and contract platform for web agencies.
        </p>

        <div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border-radius: 12px; padding: 24px; margin: 24px 0;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #4338CA;">
                ✨ Your Enterprise Beta Benefits
            </h3>
            <p style="margin: 0 0 12px 0; color: #4b5563;">
                As a beta tester, you'll enjoy <strong>full enterprise-level access</strong> including:
            </p>
            <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;"><strong>Unlimited team members</strong> – invite your whole team</li>
                <li style="margin-bottom: 8px;"><strong>Unlimited consultations</strong> – no monthly caps</li>
                <li style="margin-bottom: 8px;"><strong>Unlimited proposals & contracts</strong> – create as many as you need</li>
                <li style="margin-bottom: 8px;"><strong>Unlimited templates</strong> – build your library</li>
                <li style="margin-bottom: 0;"><strong>Priority support</strong> from our founding team</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}"
               style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 16px 40px;
                      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
                Accept Invite & Get Started
            </a>
        </div>

        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">
                📋 How to Create Your Account
            </h4>
            <ol style="margin: 0; padding-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;">Click the button above to accept your invite</li>
                <li style="margin-bottom: 8px;">During beta testing, you'll sign in through <strong>Cloudflare Zero Trust</strong> (a 2-step verification process)</li>
                <li style="margin-bottom: 8px;">Create your agency and start building proposals!</li>
            </ol>
            <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 14px;">
                <em>Note: Once authenticated, you'll only need to sign in once per session.</em>
            </p>
        </div>

        <div style="background-color: #ECFDF5; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #065F46; font-size: 14px;">
                <strong>🚀 Coming Soon: Feedback Portal</strong><br>
                We're building a dedicated portal where beta testers can report bugs, request features, and help shape the future of WebKit. Stay tuned!
            </p>
        </div>

        <div style="background-color: #FEF3C7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #92400E; font-size: 14px;">
                <strong>⏰ This invite expires on ${formattedExpiry}</strong><br>
                Make sure to accept before then to secure your beta access.
            </p>
        </div>

        <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px;">
            Questions or feedback? Just reply to this email – we'd love to hear from you.
        </p>

        <p style="margin: 24px 0 0 0; color: #4b5563;">
            Welcome aboard,<br>
            <strong>The WebKit Team</strong>
        </p>
    `;

	return {
		subject: "You're invited to WebKit Beta! 🎉",
		bodyHtml: wrapEmail(content, primaryColor, undefined, "WebKit"),
	};
}

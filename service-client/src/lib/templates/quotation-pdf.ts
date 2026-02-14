/**
 * Quotation PDF HTML Template
 *
 * Generates professional A4 quotation HTML for Gotenberg PDF conversion.
 * Uses inline styles for maximum PDF compatibility.
 */

import type {
	Quotation,
	QuotationScopeSection,
	Agency,
	AgencyProfile,
} from "$lib/server/schema";
import type { EffectiveBranding } from "$lib/server/document-branding";
import { formatCurrency, formatDate } from "$lib/utils/formatting";

interface TermsBlock {
	title: string;
	content: string;
	sortOrder: number;
}

export interface QuotationPdfData {
	quotation: Quotation;
	sections: QuotationScopeSection[];
	agency: Agency;
	profile: AgencyProfile | null;
	brandingOverride?: EffectiveBranding;
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): { bg: string; text: string } {
	switch (status) {
		case "accepted":
			return { bg: "#dcfce7", text: "#166534" };
		case "sent":
		case "viewed":
			return { bg: "#fef3c7", text: "#92400e" };
		case "declined":
			return { bg: "#fee2e2", text: "#991b1b" };
		default:
			return { bg: "#e0e7ff", text: "#3730a3" };
	}
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function buildAgencyAddress(agency: Agency, profile: AgencyProfile | null): string {
	const parts: string[] = [];

	if (profile?.tradingName || agency.name) {
		parts.push(`<strong>${escapeHtml(profile?.tradingName || agency.name)}</strong>`);
	}
	if (profile?.addressLine1) parts.push(escapeHtml(profile.addressLine1));
	if (profile?.addressLine2) parts.push(escapeHtml(profile.addressLine2));
	if (profile?.city || profile?.state || profile?.postcode) {
		parts.push(
			[profile?.city, profile?.state, profile?.postcode]
				.filter(Boolean)
				.map((s) => escapeHtml(s as string))
				.join(" "),
		);
	}
	if (agency.email) parts.push(escapeHtml(agency.email));
	if (agency.phone) parts.push(escapeHtml(agency.phone));
	if (profile?.abn) parts.push(`ABN: ${escapeHtml(profile.abn)}`);

	return parts.join("<br>");
}

function buildClientAddress(quotation: Quotation): string {
	const parts: string[] = [];

	if (quotation.clientBusinessName) {
		parts.push(`<strong>${escapeHtml(quotation.clientBusinessName)}</strong>`);
	}
	if (quotation.clientContactName) parts.push(escapeHtml(quotation.clientContactName));
	if (quotation.clientAddress) parts.push(escapeHtml(quotation.clientAddress));
	if (quotation.clientEmail) parts.push(escapeHtml(quotation.clientEmail));
	if (quotation.clientPhone) parts.push(escapeHtml(quotation.clientPhone));

	return parts.join("<br>");
}

function buildWorkItemsHtml(items: string[]): string {
	if (items.length === 0) return "";

	// Two-column layout for work items
	const midpoint = Math.ceil(items.length / 2);
	const col1 = items.slice(0, midpoint);
	const col2 = items.slice(midpoint);

	return `
		<table style="width: 100%; border-collapse: collapse;">
			<tr>
				<td style="vertical-align: top; width: 50%; padding-right: 12px;">
					${col1
						.map(
							(item) => `
						<div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px; font-size: 12px; color: #374151;">
							<span style="color: #6366f1; margin-top: 2px;">&#x2022;</span>
							<span>${escapeHtml(item)}</span>
						</div>
					`,
						)
						.join("")}
				</td>
				<td style="vertical-align: top; width: 50%; padding-left: 12px;">
					${col2
						.map(
							(item) => `
						<div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px; font-size: 12px; color: #374151;">
							<span style="color: #6366f1; margin-top: 2px;">&#x2022;</span>
							<span>${escapeHtml(item)}</span>
						</div>
					`,
						)
						.join("")}
				</td>
			</tr>
		</table>
	`;
}

export function generateQuotationPdfHtml(data: QuotationPdfData): string {
	const { quotation, sections, agency, profile, brandingOverride } = data;

	const logoUrl = brandingOverride?.logoUrl || agency.logoUrl;
	const accentColor = brandingOverride?.primaryColor || agency.primaryColor || "#6366f1";
	const statusColor = getStatusColor(quotation.status);

	const isAccepted = quotation.status === "accepted";

	const termsBlocks = ((quotation.termsBlocks as TermsBlock[]) || []).sort(
		(a, b) => a.sortOrder - b.sortOrder,
	);

	// Build scope sections HTML
	const scopeSectionsHtml = sections
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map(
			(section) => `
		<div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
			<div style="background: #f9fafb; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
				<h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">${escapeHtml(section.title)}</h3>
				<span style="font-size: 14px; font-weight: 700; color: ${accentColor};">
					${formatCurrency(section.sectionTotal)}
					${quotation.gstRegistered ? '<span style="font-size: 10px; color: #6b7280; font-weight: 400;"> inc GST</span>' : ""}
				</span>
			</div>
			<div style="padding: 12px 16px;">
				${buildWorkItemsHtml((section.workItems as string[]) || [])}
			</div>
		</div>
	`,
		)
		.join("");

	// Build terms HTML
	const termsHtml =
		termsBlocks.length > 0
			? `
		<div style="margin: 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Terms & Conditions</h2>
			${termsBlocks
				.map(
					(term) => `
				<div style="margin-bottom: 12px;">
					<h3 style="font-size: 12px; font-weight: 600; margin: 0 0 4px 0; color: #374151;">${escapeHtml(term.title)}</h3>
					<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${escapeHtml(term.content)}</div>
				</div>
			`,
				)
				.join("")}
		</div>
	`
			: "";

	// Build acceptance block
	const acceptanceHtml = isAccepted
		? `
		<div style="margin: 48px 0 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Acceptance</h2>

			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
				<!-- Agency -->
				<div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
						From ${escapeHtml(agency.name)}
					</div>
					<div style="margin-top: 16px;">
						<div style="font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(agency.name)}</div>
						<div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Prepared: ${formatDate(quotation.preparedDate, "long")}</div>
					</div>
				</div>

				<!-- Client -->
				<div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
						For ${escapeHtml(quotation.clientBusinessName || "Client")}
					</div>
					<div style="margin-top: 16px;">
						<div style="display: flex; align-items: center; gap: 8px;">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
							<div style="font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(quotation.acceptedByName || "")}</div>
						</div>
						${quotation.acceptedByTitle ? `<div style="font-size: 13px; color: #6b7280; margin-top: 2px; margin-left: 28px;">${escapeHtml(quotation.acceptedByTitle)}</div>` : ""}
						<div style="font-size: 12px; color: #16a34a; margin-top: 8px; margin-left: 28px;">Accepted: ${formatDate(quotation.acceptedAt, "long")}</div>
					</div>
				</div>
			</div>
		</div>
	`
		: `
		<div style="margin: 48px 0 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Acceptance</h2>

			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
				<!-- Agency -->
				<div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
						From ${escapeHtml(agency.name)}
					</div>
					<div style="margin-top: 16px;">
						<div style="font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(agency.name)}</div>
						<div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Prepared: ${formatDate(quotation.preparedDate, "long")}</div>
					</div>
				</div>

				<!-- Client -->
				<div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
						For ${escapeHtml(quotation.clientBusinessName || "Client")}
					</div>
					<div style="height: 60px; border-bottom: 2px solid #d1d5db; margin: 20px 0;"></div>
					<div style="font-size: 12px; color: #9ca3af;">Date: _______________</div>
				</div>
			</div>
		</div>
	`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Quotation ${quotation.quotationNumber}</title>
	<style>
		@page {
			size: A4;
			margin: 15mm;
		}
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			font-size: 14px;
			line-height: 1.5;
			color: #374151;
			background: white;
		}
		.container {
			max-width: 800px;
			margin: 0 auto;
			position: relative;
		}
		${
			isAccepted
				? `
		.accepted-watermark {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%) rotate(-45deg);
			font-size: 100px;
			font-weight: bold;
			color: rgba(22, 163, 74, 0.06);
			z-index: 0;
			pointer-events: none;
			user-select: none;
		}
		`
				: ""
		}
	</style>
</head>
<body>
	${isAccepted ? '<div class="accepted-watermark">ACCEPTED</div>' : ""}
	<div class="container">
		<!-- Header -->
		<div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid ${accentColor};">
			<div style="flex: 1; min-width: 0;">
				${
					logoUrl && logoUrl.trim()
						? `<img src="${logoUrl}" alt="${escapeHtml(agency.name)}" style="max-height: 60px; max-width: 200px; object-fit: contain;">`
						: `<div style="font-size: 24px; font-weight: bold; color: ${accentColor};">${escapeHtml(agency.name)}</div>`
				}
			</div>
			<div style="text-align: right; flex-shrink: 0;">
				<div style="font-size: 28px; font-weight: bold; color: #111827; margin-bottom: 4px;">QUOTATION</div>
				<div style="font-family: monospace; font-size: 16px; color: #6b7280;">#${quotation.quotationNumber}</div>
				<div style="margin-top: 8px;">
					<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${statusColor.bg}; color: ${statusColor.text}; text-transform: uppercase;">
						${quotation.status}
					</span>
				</div>
			</div>
		</div>

		<!-- Addresses -->
		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin: 24px 0;">
			<div>
				<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">From</h3>
				<div style="font-size: 13px; line-height: 1.6;">
					${buildAgencyAddress(agency, profile)}
				</div>
			</div>
			<div style="text-align: right;">
				<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Prepared For</h3>
				<div style="font-size: 13px; line-height: 1.6;">
					${buildClientAddress(quotation)}
				</div>
			</div>
		</div>

		<!-- Dates & Site -->
		<div style="display: grid; grid-template-columns: repeat(${quotation.siteAddress ? "3" : "2"}, 1fr); gap: 24px; margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${accentColor};">
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Date</div>
				<div style="font-weight: 500;">${formatDate(quotation.preparedDate, "long")}</div>
			</div>
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Valid Until</div>
				<div style="font-weight: 500;">${formatDate(quotation.expiryDate, "long")}</div>
			</div>
			${
				quotation.siteAddress
					? `
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Site Address</div>
				<div style="font-weight: 500;">${escapeHtml(quotation.siteAddress)}</div>
			</div>
			`
					: ""
			}
		</div>

		${
			quotation.siteReference
				? `
		<div style="margin-bottom: 16px; font-size: 13px;">
			<span style="font-weight: 600; color: #6b7280;">Reference:</span>
			<span style="margin-left: 8px; font-weight: 500;">${escapeHtml(quotation.siteReference)}</span>
		</div>
		`
				: ""
		}

		<!-- Scope of Works -->
		<div style="margin: 24px 0;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Scope of Works</h2>
			${scopeSectionsHtml}
		</div>

		<!-- Totals -->
		<div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 100%); border-radius: 12px; border: 1px solid ${accentColor}20; page-break-inside: avoid;">
			<div style="display: flex; justify-content: space-between; align-items: center;">
				<div>
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Quotation Total</div>
					<div style="font-size: 32px; font-weight: bold; color: ${accentColor};">${formatCurrency(quotation.total)}</div>
					<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${quotation.gstRegistered ? "Inclusive of GST" : "Exclusive of GST"}</div>
				</div>
				<div style="text-align: right;">
					<div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">
						<span>Subtotal (ex GST):</span>
						<span style="font-weight: 500; margin-left: 8px;">${formatCurrency(quotation.subtotal)}</span>
					</div>
					${
						parseFloat(quotation.discountAmount as string) > 0
							? `
					<div style="font-size: 14px; color: #059669; margin-bottom: 4px;">
						<span>Discount${quotation.discountDescription ? ` (${escapeHtml(quotation.discountDescription)})` : ""}:</span>
						<span style="margin-left: 8px;">-${formatCurrency(quotation.discountAmount)}</span>
					</div>
					`
							: ""
					}
					${
						quotation.gstRegistered && parseFloat(quotation.gstAmount as string) > 0
							? `
					<div style="font-size: 14px; color: #6b7280;">
						<span>GST (${parseFloat(quotation.gstRate as string)}%):</span>
						<span style="font-weight: 500; margin-left: 8px;">${formatCurrency(quotation.gstAmount)}</span>
					</div>
					`
							: ""
					}
				</div>
			</div>
		</div>

		<!-- Options Notes -->
		${
			quotation.optionsNotes
				? `
		<div style="margin: 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Options & Notes</h2>
			<div style="font-size: 13px; color: #6b7280; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(quotation.optionsNotes)}</div>
		</div>
		`
				: ""
		}

		<!-- Terms & Conditions -->
		${termsHtml}

		<!-- Acceptance Block -->
		${acceptanceHtml}

		<!-- Footer -->
		<div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
			<div>Generated on ${formatDate(new Date(), "long")} by ${escapeHtml(agency.name)}</div>
		</div>
	</div>
</body>
</html>`;
}

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

function buildAgencyAddress(agency: Agency, profile: AgencyProfile | null): string {
	const parts: string[] = [];

	if (profile?.tradingName || agency.name) {
		parts.push(`<strong>${profile?.tradingName || agency.name}</strong>`);
	}
	if (profile?.addressLine1) parts.push(profile.addressLine1);
	if (profile?.addressLine2) parts.push(profile.addressLine2);
	if (profile?.city || profile?.state || profile?.postcode) {
		parts.push([profile?.city, profile?.state, profile?.postcode].filter(Boolean).join(" "));
	}
	if (agency.email) parts.push(agency.email);
	if (agency.phone) parts.push(agency.phone);
	if (profile?.abn) parts.push(`ABN: ${profile.abn}`);

	return parts.join("<br>");
}

function buildClientAddress(quotation: Quotation): string {
	const parts: string[] = [];

	if (quotation.clientBusinessName) {
		parts.push(`<strong>${quotation.clientBusinessName}</strong>`);
	}
	if (quotation.clientContactName) parts.push(quotation.clientContactName);
	if (quotation.clientAddress) parts.push(quotation.clientAddress);
	if (quotation.clientEmail) parts.push(quotation.clientEmail);
	if (quotation.clientPhone) parts.push(quotation.clientPhone);

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
							<span>${item}</span>
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
							<span>${item}</span>
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
	const primaryColor = brandingOverride?.primaryColor || agency.primaryColor || "#111827";

	const isAccepted = quotation.status === "accepted";

	const termsBlocks = ((quotation.termsBlocks as TermsBlock[]) || []).sort(
		(a, b) => a.sortOrder - b.sortOrder,
	);

	// Build scope sections HTML
	const scopeSectionsHtml = sections
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map(
			(section) => `
		<div style="margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
			<div style="background: #f9fafb; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
				<h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">${section.title}</h3>
				<span style="font-size: 14px; font-weight: 700; color: ${primaryColor};">
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
		<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
			<h2 style="font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">Terms & Conditions</h2>
			${termsBlocks
				.map(
					(term) => `
				<div style="margin-bottom: 12px;">
					<h3 style="font-size: 12px; font-weight: 600; margin: 0 0 4px 0; color: #374151;">${term.title}</h3>
					<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${term.content}</div>
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
		<div style="margin-top: 32px; padding: 16px; background: #dcfce7; border-radius: 8px; text-align: center;">
			<div style="font-weight: 700; color: #166534; font-size: 14px;">Accepted</div>
			<div style="font-size: 12px; color: #166534; margin-top: 4px;">
				By ${quotation.acceptedByName}${quotation.acceptedByTitle ? ` (${quotation.acceptedByTitle})` : ""}
				on ${formatDate(quotation.acceptedAt, "long")}
			</div>
		</div>
	`
		: `
		<div style="margin-top: 32px; padding: 16px; border: 2px dashed #d1d5db; border-radius: 8px;">
			<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
				Acceptance
			</div>
			<table style="width: 100%; font-size: 12px;">
				<tr>
					<td style="padding: 8px 0; width: 120px; color: #6b7280;">Name:</td>
					<td style="padding: 8px 0; border-bottom: 1px solid #d1d5db;"></td>
				</tr>
				<tr>
					<td style="padding: 8px 0; color: #6b7280;">Position/Title:</td>
					<td style="padding: 8px 0; border-bottom: 1px solid #d1d5db;"></td>
				</tr>
				<tr>
					<td style="padding: 8px 0; color: #6b7280;">Date:</td>
					<td style="padding: 8px 0; border-bottom: 1px solid #d1d5db;"></td>
				</tr>
				<tr>
					<td style="padding: 8px 0; color: #6b7280;">Signature:</td>
					<td style="padding: 8px 0; border-bottom: 1px solid #d1d5db; height: 40px;"></td>
				</tr>
			</table>
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
			margin: 20mm;
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
			font-size: 120px;
			font-weight: bold;
			color: rgba(22, 163, 74, 0.08);
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
		<div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid ${primaryColor};">
			<div>
				${
					logoUrl
						? `<img src="${logoUrl}" alt="${agency.name}" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-bottom: 8px;">`
						: `<div style="font-size: 24px; font-weight: bold; color: ${primaryColor};">${agency.name}</div>`
				}
				${profile?.tagline ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${profile.tagline}</div>` : ""}
			</div>
			<div style="text-align: right;">
				<div style="font-size: 28px; font-weight: bold; color: #111827; margin-bottom: 4px;">QUOTATION</div>
				<div style="font-family: monospace; font-size: 16px; color: #6b7280;">#${quotation.quotationNumber}</div>
			</div>
		</div>

		<!-- Addresses -->
		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin: 32px 0;">
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
		<div style="display: grid; grid-template-columns: repeat(${quotation.siteAddress ? "3" : "2"}, 1fr); gap: 24px; margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
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
				<div style="font-weight: 500;">${quotation.siteAddress}</div>
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
			<span style="margin-left: 8px; font-weight: 500;">${quotation.siteReference}</span>
		</div>
		`
				: ""
		}

		<!-- Scope of Works -->
		<div style="margin-top: 24px;">
			<h2 style="font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">Scope of Works</h2>
			${scopeSectionsHtml}
		</div>

		<!-- Totals -->
		<div style="display: flex; justify-content: flex-end; margin-top: 24px;">
			<div style="width: 280px;">
				<div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px;">
					<span style="color: #6b7280;">Subtotal (ex GST)</span>
					<span style="font-weight: 500;">${formatCurrency(quotation.subtotal)}</span>
				</div>
				${
					parseFloat(quotation.discountAmount as string) > 0
						? `
				<div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #059669;">
					<span>Discount${quotation.discountDescription ? ` (${quotation.discountDescription})` : ""}</span>
					<span>-${formatCurrency(quotation.discountAmount)}</span>
				</div>
				`
						: ""
				}
				${
					quotation.gstRegistered && parseFloat(quotation.gstAmount as string) > 0
						? `
				<div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px;">
					<span style="color: #6b7280;">GST (${parseFloat(quotation.gstRate as string)}%)</span>
					<span style="font-weight: 500;">${formatCurrency(quotation.gstAmount)}</span>
				</div>
				`
						: ""
				}
				<div style="display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid #111827; font-size: 18px; font-weight: bold;">
					<span>Total</span>
					<span>${formatCurrency(quotation.total)}</span>
				</div>
			</div>
		</div>

		<!-- Options Notes -->
		${
			quotation.optionsNotes
				? `
		<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
			<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Options & Notes</h3>
			<div style="font-size: 13px; color: #6b7280; white-space: pre-wrap;">${quotation.optionsNotes}</div>
		</div>
		`
				: ""
		}

		<!-- Terms & Conditions -->
		${termsHtml}

		<!-- Acceptance Block -->
		${acceptanceHtml}
	</div>
</body>
</html>`;
}

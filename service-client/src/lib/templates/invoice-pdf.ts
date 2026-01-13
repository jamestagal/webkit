/**
 * Invoice PDF HTML Template
 *
 * Generates professional A4 invoice HTML for Gotenberg PDF conversion.
 * Uses inline styles for maximum PDF compatibility.
 */

import type { Invoice, InvoiceLineItem, Agency, AgencyProfile } from '$lib/server/schema';
import type { EffectiveBranding } from '$lib/server/document-branding';

export interface InvoicePdfData {
	invoice: Invoice;
	lineItems: InvoiceLineItem[];
	agency: Agency;
	profile: AgencyProfile | null;
	/** Optional branding override - if provided, takes precedence over agency branding */
	brandingOverride?: EffectiveBranding;
}

/**
 * Format a decimal string or number as currency (AUD)
 */
function formatCurrency(value: string | number | null): string {
	const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
	return new Intl.NumberFormat('en-AU', {
		style: 'currency',
		currency: 'AUD',
		minimumFractionDigits: 2
	}).format(num);
}

/**
 * Format a date for display
 */
function formatDate(date: Date | string | null): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('en-AU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): { bg: string; text: string } {
	switch (status) {
		case 'paid':
			return { bg: '#dcfce7', text: '#166534' };
		case 'sent':
		case 'viewed':
			return { bg: '#fef3c7', text: '#92400e' };
		case 'overdue':
			return { bg: '#fee2e2', text: '#991b1b' };
		case 'cancelled':
		case 'refunded':
			return { bg: '#f3f4f6', text: '#6b7280' };
		default:
			return { bg: '#e0e7ff', text: '#3730a3' };
	}
}

/**
 * Build the agency address block
 */
function buildAgencyAddress(agency: Agency, profile: AgencyProfile | null): string {
	const parts: string[] = [];

	if (profile?.tradingName || agency.name) {
		parts.push(`<strong>${profile?.tradingName || agency.name}</strong>`);
	}
	if (profile?.addressLine1) parts.push(profile.addressLine1);
	if (profile?.addressLine2) parts.push(profile.addressLine2);
	if (profile?.city || profile?.state || profile?.postcode) {
		parts.push([profile?.city, profile?.state, profile?.postcode].filter(Boolean).join(' '));
	}
	if (agency.email) parts.push(agency.email);
	if (agency.phone) parts.push(agency.phone);
	if (profile?.abn) parts.push(`ABN: ${profile.abn}`);

	return parts.join('<br>');
}

/**
 * Build the client address block
 */
function buildClientAddress(invoice: Invoice): string {
	const parts: string[] = [];

	if (invoice.clientBusinessName) {
		parts.push(`<strong>${invoice.clientBusinessName}</strong>`);
	}
	if (invoice.clientContactName) parts.push(invoice.clientContactName);
	if (invoice.clientAddress) parts.push(invoice.clientAddress);
	if (invoice.clientEmail) parts.push(invoice.clientEmail);
	if (invoice.clientPhone) parts.push(invoice.clientPhone);
	if (invoice.clientAbn) parts.push(`ABN: ${invoice.clientAbn}`);

	return parts.join('<br>');
}


/**
 * Generate invoice PDF HTML
 */
export function generateInvoicePdfHtml(data: InvoicePdfData): string {
	const { invoice, lineItems, agency, profile, brandingOverride } = data;
	const statusColor = getStatusColor(invoice.status);
	const isPaid = invoice.status === 'paid';

	// Use branding override if provided, otherwise fall back to agency branding
	const logoUrl = brandingOverride?.logoUrl || agency.logoUrl;
	const primaryColor = brandingOverride?.primaryColor || agency.primaryColor || '#111827';

	// Calculate line item display values
	const lineItemRows = lineItems
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map(
			(item) => `
		<tr>
			<td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
				<div style="font-weight: 500; color: #111827;">${item.description}</div>
				${item.category ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${item.category}</div>` : ''}
			</td>
			<td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
				${parseFloat(item.quantity as string).toFixed(2)}
			</td>
			<td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">
				${formatCurrency(item.unitPrice)}
			</td>
			<td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">
				${formatCurrency(item.amount)}
				${!item.isTaxable ? '<span style="font-size: 10px; color: #9ca3af;">(No GST)</span>' : ''}
			</td>
		</tr>
	`
		)
		.join('');

	// Build payment details with invoice reference
	const paymentDetailsHtml =
		profile?.bankName || profile?.bsb || profile?.accountNumber
			? `
		<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
			<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">
				Payment Details
			</h3>
			<div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
				<table style="width: 100%; font-size: 13px;">
					${profile.bankName ? `<tr><td style="color: #6b7280; padding: 4px 0;">Bank</td><td style="text-align: right; font-weight: 500;">${profile.bankName}</td></tr>` : ''}
					${profile.accountName ? `<tr><td style="color: #6b7280; padding: 4px 0;">Account Name</td><td style="text-align: right; font-weight: 500;">${profile.accountName}</td></tr>` : ''}
					${profile.bsb ? `<tr><td style="color: #6b7280; padding: 4px 0;">BSB</td><td style="text-align: right; font-weight: 500; font-family: monospace;">${profile.bsb}</td></tr>` : ''}
					${profile.accountNumber ? `<tr><td style="color: #6b7280; padding: 4px 0;">Account Number</td><td style="text-align: right; font-weight: 500; font-family: monospace;">${profile.accountNumber}</td></tr>` : ''}
					<tr><td style="color: #6b7280; padding: 4px 0;">Reference</td><td style="text-align: right; font-weight: 500; font-family: monospace;">${invoice.invoiceNumber}</td></tr>
				</table>
			</div>
		</div>
	`
			: '';

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Invoice ${invoice.invoiceNumber}</title>
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
			isPaid
				? `
		.paid-watermark {
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
				: ''
		}
	</style>
</head>
<body>
	${isPaid ? '<div class="paid-watermark">PAID</div>' : ''}
	<div class="container">
		<!-- Header -->
		<div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #111827;">
			<div>
				${
					logoUrl
						? `<img src="${logoUrl}" alt="${agency.name}" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-bottom: 8px;">`
						: `<div style="font-size: 24px; font-weight: bold; color: ${primaryColor};">${agency.name}</div>`
				}
			</div>
			<div style="text-align: right;">
				<div style="font-size: 28px; font-weight: bold; color: #111827; margin-bottom: 4px;">INVOICE</div>
				<div style="font-family: monospace; font-size: 16px; color: #6b7280;">#${invoice.invoiceNumber}</div>
				<div style="margin-top: 8px;">
					<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${statusColor.bg}; color: ${statusColor.text}; text-transform: uppercase;">
						${invoice.status}
					</span>
				</div>
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
				<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Bill To</h3>
				<div style="font-size: 13px; line-height: 1.6;">
					${buildClientAddress(invoice)}
				</div>
			</div>
		</div>

		<!-- Dates -->
		<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px;">
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Issue Date</div>
				<div style="font-weight: 500;">${formatDate(invoice.issueDate)}</div>
			</div>
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Due Date</div>
				<div style="font-weight: 500;">${formatDate(invoice.dueDate)}</div>
			</div>
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Payment Terms</div>
				<div style="font-weight: 500;">${invoice.paymentTerms === 'CUSTOM' ? invoice.paymentTermsCustom : invoice.paymentTerms.replace('_', ' ')}</div>
			</div>
		</div>

		<!-- Line Items Table -->
		<div style="margin: 32px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
			<table style="width: 100%; border-collapse: collapse;">
				<thead>
					<tr style="background: #f9fafb;">
						<th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Description</th>
						<th style="padding: 12px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
						<th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Unit Price</th>
						<th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Amount</th>
					</tr>
				</thead>
				<tbody>
					${lineItemRows}
				</tbody>
			</table>
		</div>

		<!-- Totals -->
		<div style="display: flex; justify-content: flex-end;">
			<div style="width: 280px;">
				<div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px;">
					<span style="color: #6b7280;">Subtotal</span>
					<span style="font-weight: 500;">${formatCurrency(invoice.subtotal)}</span>
				</div>
				${
					parseFloat(invoice.discountAmount as string) > 0
						? `
				<div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #059669;">
					<span>Discount${invoice.discountDescription ? ` (${invoice.discountDescription})` : ''}</span>
					<span>-${formatCurrency(invoice.discountAmount)}</span>
				</div>
				`
						: ''
				}
				${
					invoice.gstRegistered && parseFloat(invoice.gstAmount as string) > 0
						? `
				<div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px;">
					<span style="color: #6b7280;">GST (${parseFloat(invoice.gstRate as string)}%)</span>
					<span style="font-weight: 500;">${formatCurrency(invoice.gstAmount)}</span>
				</div>
				`
						: ''
				}
				<div style="display: flex; justify-content: space-between; padding: 12px 0; margin-top: 8px; border-top: 2px solid #111827; font-size: 18px; font-weight: bold;">
					<span>Total</span>
					<span>${formatCurrency(invoice.total)}</span>
				</div>
				${
					isPaid && invoice.paidAt
						? `
				<div style="margin-top: 8px; padding: 8px 12px; background: #dcfce7; border-radius: 6px; text-align: center;">
					<span style="color: #166534; font-weight: 600;">Paid on ${formatDate(invoice.paidAt)}</span>
				</div>
				`
						: ''
				}
			</div>
		</div>

		<!-- Payment Details -->
		${!isPaid ? paymentDetailsHtml : ''}

		<!-- Notes -->
		${
			invoice.publicNotes
				? `
		<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
			<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Notes</h3>
			<div style="font-size: 13px; color: #6b7280; white-space: pre-wrap;">${invoice.publicNotes}</div>
		</div>
		`
				: ''
		}

		<!-- Footer -->
		${
			profile?.invoiceFooter
				? `
		<div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
			${profile.invoiceFooter}
		</div>
		`
				: ''
		}
	</div>
</body>
</html>`;
}

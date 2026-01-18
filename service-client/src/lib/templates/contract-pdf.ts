/**
 * Contract PDF HTML Template
 *
 * Generates professional A4 contract HTML for Gotenberg PDF conversion.
 * Uses inline styles for maximum PDF compatibility.
 */

import type { Contract, ContractSchedule, Agency, AgencyProfile } from '$lib/server/schema';
import type { EffectiveBranding } from '$lib/server/document-branding';

export interface ContractPdfData {
	contract: Contract;
	agency: Agency;
	profile: AgencyProfile | null;
	includedSchedules: ContractSchedule[];
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
		case 'signed':
		case 'completed':
			return { bg: '#dcfce7', text: '#166534' };
		case 'sent':
		case 'viewed':
			return { bg: '#fef3c7', text: '#92400e' };
		case 'expired':
		case 'terminated':
			return { bg: '#fee2e2', text: '#991b1b' };
		default:
			return { bg: '#e0e7ff', text: '#3730a3' };
	}
}

/**
 * Check if a field should be visible
 */
function isFieldVisible(visibleFields: string[], field: string): boolean {
	return visibleFields.includes(field);
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
function buildClientAddress(contract: Contract): string {
	const parts: string[] = [];

	if (contract.clientBusinessName) {
		parts.push(`<strong>${contract.clientBusinessName}</strong>`);
	}
	if (contract.clientContactName) parts.push(contract.clientContactName);
	if (contract.clientAddress) parts.push(contract.clientAddress);
	if (contract.clientEmail) parts.push(contract.clientEmail);
	if (contract.clientPhone) parts.push(contract.clientPhone);

	return parts.join('<br>');
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Generate contract PDF HTML
 */
export function generateContractPdfHtml(data: ContractPdfData): string {
	const { contract, agency, profile, includedSchedules, brandingOverride } = data;
	const statusColor = getStatusColor(contract.status);
	const isSigned = contract.status === 'signed' || contract.status === 'completed';

	// Use branding override if provided, otherwise fall back to agency branding
	const logoUrl = brandingOverride?.logoUrl || agency.logoUrl;
	const accentColor = brandingOverride?.primaryColor || agency.primaryColor || '#6366f1';

	// Get visible fields
	const visibleFields = (contract.visibleFields as string[]) || [
		'services',
		'commencementDate',
		'completionDate',
		'price',
		'paymentTerms',
		'specialConditions'
	];

	// Build schedule sections HTML
	const schedulesHtml = includedSchedules
		.sort((a, b) => a.displayOrder - b.displayOrder)
		.map(
			(schedule) => `
			<div class="schedule-section" style="margin-bottom: 24px; page-break-inside: avoid;">
				<h3 style="font-size: 14px; font-weight: 500; color: #374151; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">
					${escapeHtml(schedule.name)}
				</h3>
				<div class="schedule-content" style="font-size: 13px; line-height: 1.7; color: #374151;">
					${schedule.content}
				</div>
			</div>
		`
		)
		.join('');

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Contract ${contract.contractNumber}</title>
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
			isSigned
				? `
		.signed-watermark {
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
				: ''
		}
		/* Schedule content heading overrides */
		.schedule-content h1,
		.schedule-content h2,
		.schedule-content h3,
		.schedule-content h4,
		.schedule-content h5,
		.schedule-content h6 {
			font-size: 14px !important;
			font-weight: 500 !important;
			color: #374151 !important;
			margin: 16px 0 8px 0 !important;
			padding: 0 !important;
			border: none !important;
		}
		/* Hide first heading in schedule section (duplicate of schedule name) */
		.schedule-section .schedule-content > h1:first-child,
		.schedule-section .schedule-content > h2:first-child,
		.schedule-section .schedule-content > h3:first-child,
		.schedule-section .schedule-content > h4:first-child {
			display: none !important;
		}
	</style>
</head>
<body>
	${isSigned ? '<div class="signed-watermark">SIGNED</div>' : ''}
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
				<div style="font-size: 28px; font-weight: bold; color: #111827; margin-bottom: 4px;">CONTRACT</div>
				<div style="font-family: monospace; font-size: 16px; color: #6b7280;">#${contract.contractNumber}</div>
				<div style="margin-top: 8px;">
					<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${statusColor.bg}; color: ${statusColor.text}; text-transform: uppercase;">
						${contract.status.replace('_', ' ')}
					</span>
				</div>
			</div>
		</div>

		<!-- Parties -->
		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin: 32px 0;">
			<div>
				<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Service Provider</h3>
				<div style="font-size: 13px; line-height: 1.6;">
					${buildAgencyAddress(agency, profile)}
				</div>
			</div>
			<div style="text-align: right;">
				<h3 style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Client</h3>
				<div style="font-size: 13px; line-height: 1.6;">
					${buildClientAddress(contract)}
				</div>
			</div>
		</div>

		<!-- Contract Details -->
		<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${accentColor};">
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Contract Date</div>
				<div style="font-weight: 500;">${formatDate(contract.createdAt)}</div>
			</div>
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Valid Until</div>
				<div style="font-weight: 500;">${formatDate(contract.validUntil)}</div>
			</div>
			${
				isFieldVisible(visibleFields, 'commencementDate') && contract.commencementDate
					? `
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Commencement</div>
				<div style="font-weight: 500;">${formatDate(contract.commencementDate)}</div>
			</div>
			`
					: '<div></div>'
			}
			${
				isFieldVisible(visibleFields, 'completionDate') && contract.completionDate
					? `
			<div>
				<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Completion</div>
				<div style="font-weight: 500;">${formatDate(contract.completionDate)}</div>
			</div>
			`
					: '<div></div>'
			}
		</div>

		<!-- Services Description -->
		${
			isFieldVisible(visibleFields, 'services') && contract.servicesDescription
				? `
		<div style="margin: 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Services</h2>
			<p style="font-size: 14px; line-height: 1.7; color: #374151;">${escapeHtml(contract.servicesDescription)}</p>
		</div>
		`
				: ''
		}

		<!-- Contract Value -->
		${
			isFieldVisible(visibleFields, 'price')
				? `
		<div style="margin: 32px 0; padding: 24px; background: linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 100%); border-radius: 12px; border: 1px solid ${accentColor}20; page-break-inside: avoid;">
			<div style="display: flex; justify-content: space-between; align-items: center;">
				<div>
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Contract Value</div>
					<div style="font-size: 32px; font-weight: bold; color: ${accentColor};">${formatCurrency(contract.totalPrice)}</div>
					<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${contract.priceIncludesGst ? 'Inclusive of GST' : 'Exclusive of GST'}</div>
				</div>
				${
					isFieldVisible(visibleFields, 'paymentTerms') && contract.paymentTerms
						? `
				<div style="text-align: right; max-width: 300px;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Payment Terms</div>
					<div style="font-size: 13px; color: #374151; line-height: 1.6;">${escapeHtml(contract.paymentTerms)}</div>
				</div>
				`
						: ''
				}
			</div>
		</div>
		`
				: ''
		}

		<!-- Terms & Conditions -->
		${
			contract.generatedTermsHtml
				? `
		<div style="margin: 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Terms & Conditions</h2>
			<div class="schedule-content" style="font-size: 13px; line-height: 1.7; color: #374151;">
				${contract.generatedTermsHtml}
			</div>
		</div>
		`
				: ''
		}

		<!-- Schedule A Sections -->
		${
			includedSchedules.length > 0
				? `
		<div style="margin: 32px 0;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Schedule A</h2>
			${schedulesHtml}
		</div>
		`
				: contract.generatedScheduleHtml
					? `
		<div style="margin: 32px 0;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Schedule A</h2>
			<div class="schedule-content" style="font-size: 13px; line-height: 1.7; color: #374151;">
				${contract.generatedScheduleHtml}
			</div>
		</div>
		`
					: ''
		}

		<!-- Special Conditions -->
		${
			isFieldVisible(visibleFields, 'specialConditions') && contract.specialConditions
				? `
		<div style="margin: 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Special Conditions</h2>
			<p style="font-size: 14px; line-height: 1.7; color: #374151; white-space: pre-wrap;">${escapeHtml(contract.specialConditions)}</p>
		</div>
		`
				: ''
		}

		<!-- Signatures -->
		<div style="margin: 48px 0 32px 0; page-break-inside: avoid;">
			<h2 style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid ${accentColor};">Signatures</h2>

			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
				<!-- Agency Signature -->
				<div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
						For ${escapeHtml(agency.name)}
					</div>
					${
						contract.agencySignatoryName
							? `
					<div style="margin-top: 16px;">
						<div style="font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(contract.agencySignatoryName)}</div>
						${contract.agencySignatoryTitle ? `<div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${escapeHtml(contract.agencySignatoryTitle)}</div>` : ''}
						<div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Signed: ${formatDate(contract.agencySignedAt || contract.sentAt)}</div>
					</div>
					`
							: `
					<div style="height: 60px; border-bottom: 2px solid #d1d5db; margin: 20px 0;"></div>
					<div style="font-size: 12px; color: #9ca3af;">Date: _______________</div>
					`
					}
				</div>

				<!-- Client Signature -->
				<div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
					<div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
						For ${escapeHtml(contract.clientBusinessName || 'Client')}
					</div>
					${
						contract.clientSignatoryName
							? `
					<div style="margin-top: 16px;">
						<div style="display: flex; align-items: center; gap: 8px;">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
							<div style="font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(contract.clientSignatoryName)}</div>
						</div>
						${contract.clientSignatoryTitle ? `<div style="font-size: 13px; color: #6b7280; margin-top: 2px; margin-left: 28px;">${escapeHtml(contract.clientSignatoryTitle)}</div>` : ''}
						<div style="font-size: 12px; color: #16a34a; margin-top: 8px; margin-left: 28px;">Signed: ${formatDate(contract.clientSignedAt)}</div>
					</div>
					`
							: `
					<div style="height: 60px; border-bottom: 2px solid #d1d5db; margin: 20px 0;"></div>
					<div style="font-size: 12px; color: #9ca3af;">Date: _______________</div>
					`
					}
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
			<div>Generated on ${formatDate(new Date())} by ${escapeHtml(agency.name)}</div>
		</div>
	</div>
</body>
</html>`;
}

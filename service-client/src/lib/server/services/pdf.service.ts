/**
 * PDF Service
 *
 * Internal service for fetching generated PDFs from API endpoints.
 * Used by email service to attach PDFs to emails.
 */

import { env } from '$env/dynamic/public';

// =============================================================================
// Types
// =============================================================================

export interface PdfFetchResult {
	success: boolean;
	buffer?: Buffer;
	filename?: string;
	error?: string;
}

// =============================================================================
// PDF Fetching
// =============================================================================

/**
 * Fetch proposal PDF from internal API
 */
export async function fetchProposalPdf(
	proposalId: string,
	cookies: string
): Promise<PdfFetchResult> {
	return fetchPdf(`/api/proposals/${proposalId}/pdf`, `proposal-${proposalId}.pdf`, cookies);
}

/**
 * Fetch invoice PDF from internal API
 */
export async function fetchInvoicePdf(invoiceId: string, cookies: string): Promise<PdfFetchResult> {
	return fetchPdf(`/api/invoices/${invoiceId}/pdf`, `invoice-${invoiceId}.pdf`, cookies);
}

/**
 * Fetch contract PDF from internal API
 */
export async function fetchContractPdf(
	contractId: string,
	cookies: string
): Promise<PdfFetchResult> {
	return fetchPdf(`/api/contracts/${contractId}/pdf`, `contract-${contractId}.pdf`, cookies);
}

/**
 * Internal fetch function for PDF endpoints
 */
async function fetchPdf(
	endpoint: string,
	defaultFilename: string,
	cookies: string
): Promise<PdfFetchResult> {
	try {
		const baseUrl = env.PUBLIC_CLIENT_URL || 'http://localhost:3004';
		const url = `${baseUrl}${endpoint}`;

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Cookie: cookies,
				Accept: 'application/pdf'
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Failed to fetch PDF from ${endpoint}:`, response.status, errorText);
			return {
				success: false,
				error: `Failed to fetch PDF: ${response.status}`
			};
		}

		// Get buffer from response
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Try to get filename from Content-Disposition header
		const contentDisposition = response.headers.get('Content-Disposition');
		let filename = defaultFilename;
		if (contentDisposition) {
			const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
			if (match && match[1]) {
				filename = match[1];
			}
		}

		return {
			success: true,
			buffer,
			filename
		};
	} catch (err) {
		console.error('Error fetching PDF:', err);
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Unknown error fetching PDF'
		};
	}
}

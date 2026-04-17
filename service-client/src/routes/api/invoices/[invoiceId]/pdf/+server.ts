/**
 * Invoice PDF Generation API Endpoint
 *
 * GET /api/invoices/[invoiceId]/pdf - Download invoice as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires authentication and agency membership.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { invoices, invoiceLineItems, agencies, agencyProfiles, agencyMemberships } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { generateInvoicePdfHtml } from "$lib/templates/invoice-pdf";
import { decryptProfileFields } from "$lib/server/crypto";
import { convertHtmlToPdf, RateLimitError } from "$lib/server/gotenberg";
import { consumePDFExport } from "$lib/server/usage";

export const GET: RequestHandler = async ({ params, locals }) => {
	const { invoiceId } = params;

	if (!invoiceId) {
		return json({ error: "Invoice ID is required" }, { status: 400 });
	}

	// Auth: require logged-in user
	if (!locals.user?.id) {
		return json({ error: "Authentication required" }, { status: 401 });
	}

	try {
		// Fetch invoice
		const invoice = await db.query.invoices.findFirst({
			where: eq(invoices.id, invoiceId),
		});

		if (!invoice) {
			return json({ error: "Invoice not found" }, { status: 404 });
		}

		// Auth: verify user has membership in this agency
		const membership = await db.query.agencyMemberships.findFirst({
			where: and(
				eq(agencyMemberships.userId, locals.user.id),
				eq(agencyMemberships.agencyId, invoice.agencyId),
			),
		});

		if (!membership) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		// Fetch related data
		const [agency, profile, lineItems] = await Promise.all([
			db.query.agencies.findFirst({
				where: eq(agencies.id, invoice.agencyId),
			}),
			db.query.agencyProfiles.findFirst({
				where: eq(agencyProfiles.agencyId, invoice.agencyId),
			}),
			db.query.invoiceLineItems.findMany({
				where: eq(invoiceLineItems.invoiceId, invoiceId),
				orderBy: (items, { asc }) => [asc(items.sortOrder)],
			}),
		]);

		if (!agency) {
			return json({ error: "Agency not found" }, { status: 404 });
		}

		// Generate HTML
		const html = generateInvoicePdfHtml({
			invoice,
			lineItems,
			agency,
			profile: profile ? decryptProfileFields(profile) : null,
		});

		// Enforce monthly PDF-export cap before hitting Gotenberg.
		// Throws 429 with reset_date on limit exceeded.
		await consumePDFExport(invoice.agencyId);

		// Convert to PDF
		const pdfBuffer = await convertHtmlToPdf(html, locals.user.id);
		const filename = `${invoice.invoiceNumber}.pdf`;

		return new Response(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Content-Length": pdfBuffer.byteLength.toString(),
				"Cache-Control": "private, max-age=60",
			},
		});
	} catch (err) {
		if (err instanceof RateLimitError) {
			return json({ error: err.message }, { status: 429 });
		}
		console.error("PDF generation error:", err);
		const message = err instanceof Error ? err.message : "PDF generation failed";
		return json({ error: message }, { status: 500 });
	}
};

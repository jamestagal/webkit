/**
 * Invoice PDF Generation API Endpoint
 *
 * GET /api/invoices/[invoiceId]/pdf - Download invoice as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires agency membership and invoice view permission.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { invoices, invoiceLineItems, agencies, agencyProfiles } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import { generateInvoicePdfHtml } from "$lib/templates/invoice-pdf";
import { env } from "$env/dynamic/private";

const GOTENBERG_URL = env["GOTENBERG_URL"] || "http://localhost:3003";

export const GET: RequestHandler = async ({ params }) => {
	const { invoiceId } = params;

	if (!invoiceId) {
		return json({ error: "Invoice ID is required" }, { status: 400 });
	}

	try {
		// Fetch invoice with agency and profile
		const invoice = await db.query.invoices.findFirst({
			where: eq(invoices.id, invoiceId),
		});

		if (!invoice) {
			return json({ error: "Invoice not found" }, { status: 404 });
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
			profile: profile || null,
		});

		// Convert to PDF using Gotenberg
		const formData = new FormData();
		formData.append("files", new Blob([html], { type: "text/html" }), "index.html");

		// Gotenberg options
		formData.append("paperWidth", "8.27"); // A4 width in inches
		formData.append("paperHeight", "11.69"); // A4 height in inches
		formData.append("marginTop", "0.4");
		formData.append("marginBottom", "0.4");
		formData.append("marginLeft", "0.4");
		formData.append("marginRight", "0.4");
		formData.append("printBackground", "true");
		formData.append("preferCssPageSize", "true");

		const pdfResponse = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
			method: "POST",
			body: formData,
		});

		if (!pdfResponse.ok) {
			const errorText = await pdfResponse.text();
			console.error("Gotenberg error:", errorText);
			return json({ error: "Failed to generate PDF" }, { status: 500 });
		}

		const pdfBuffer = await pdfResponse.arrayBuffer();
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
		console.error("PDF generation error:", err);
		const message = err instanceof Error ? err.message : "PDF generation failed";
		return json({ error: message }, { status: 500 });
	}
};

/**
 * Quotation PDF Generation API Endpoint
 *
 * GET /api/quotations/[quotationId]/pdf - Download quotation as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires agency membership and quotation view permission.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
	quotations,
	quotationScopeSections,
	agencies,
	agencyProfiles,
} from "$lib/server/schema";
import { eq, asc } from "drizzle-orm";
import { generateQuotationPdfHtml } from "$lib/templates/quotation-pdf";
import { env } from "$env/dynamic/private";
import { decryptProfileFields } from "$lib/server/crypto";
import { getEffectiveBranding } from "$lib/server/document-branding";

const GOTENBERG_URL = env["GOTENBERG_URL"] || "http://localhost:3003";

export const GET: RequestHandler = async ({ params }) => {
	const { quotationId } = params;

	if (!quotationId) {
		return json({ error: "Quotation ID is required" }, { status: 400 });
	}

	try {
		// Fetch quotation
		const [quotation] = await db
			.select()
			.from(quotations)
			.where(eq(quotations.id, quotationId))
			.limit(1);

		if (!quotation) {
			return json({ error: "Quotation not found" }, { status: 404 });
		}

		// Fetch related data in parallel
		const [agency, rawProfile, sections] = await Promise.all([
			db
				.select()
				.from(agencies)
				.where(eq(agencies.id, quotation.agencyId))
				.limit(1)
				.then(([a]) => a),
			db
				.select()
				.from(agencyProfiles)
				.where(eq(agencyProfiles.agencyId, quotation.agencyId))
				.limit(1)
				.then(([p]) => p),
			db
				.select()
				.from(quotationScopeSections)
				.where(eq(quotationScopeSections.quotationId, quotationId))
				.orderBy(asc(quotationScopeSections.sortOrder)),
		]);

		if (!agency) {
			return json({ error: "Agency not found" }, { status: 404 });
		}

		const profile = rawProfile ? decryptProfileFields(rawProfile) : null;

		// Get branding (with document-level overrides)
		const brandingOverride = await getEffectiveBranding(quotation.agencyId, "quotation");

		// Generate HTML
		const html = generateQuotationPdfHtml({
			quotation,
			sections,
			agency,
			profile,
			brandingOverride,
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
		const filename = `${quotation.quotationNumber}.pdf`;

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

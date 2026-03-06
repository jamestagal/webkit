/**
 * Quotation PDF Generation API Endpoint
 *
 * GET /api/quotations/[quotationId]/pdf - Download quotation as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires authentication and agency membership.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
	quotations,
	quotationScopeSections,
	agencies,
	agencyProfiles,
	agencyMemberships,
} from "$lib/server/schema";
import { eq, and, asc } from "drizzle-orm";
import { generateQuotationPdfHtml } from "$lib/templates/quotation-pdf";
import { decryptProfileFields } from "$lib/server/crypto";
import { convertHtmlToPdf, RateLimitError } from "$lib/server/gotenberg";

export const GET: RequestHandler = async ({ params, locals }) => {
	const { quotationId } = params;

	if (!quotationId) {
		return json({ error: "Quotation ID is required" }, { status: 400 });
	}

	// Auth: require logged-in user
	if (!locals.user?.id) {
		return json({ error: "Authentication required" }, { status: 401 });
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

		// Auth: verify user has membership in this agency
		const membership = await db.query.agencyMemberships.findFirst({
			where: and(
				eq(agencyMemberships.userId, locals.user.id),
				eq(agencyMemberships.agencyId, quotation.agencyId),
			),
		});

		if (!membership) {
			return json({ error: "Access denied" }, { status: 403 });
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

		// Generate HTML
		const html = generateQuotationPdfHtml({
			quotation,
			sections,
			agency,
			profile,
		});

		// Convert to PDF
		const pdfBuffer = await convertHtmlToPdf(html, locals.user.id);
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
		if (err instanceof RateLimitError) {
			return json({ error: err.message }, { status: 429 });
		}
		console.error("PDF generation error:", err);
		const message = err instanceof Error ? err.message : "PDF generation failed";
		return json({ error: message }, { status: 500 });
	}
};

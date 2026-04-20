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
import { consumePDFExport } from "$lib/server/usage";

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

		// Enforce monthly PDF-export cap before hitting Gotenberg.
		// Throws 429 with reset_date on limit exceeded (propagates via SvelteKit).
		// TODO(usage): consume runs before convertHtmlToPdf — a Gotenberg failure
		// here bills the agency for a PDF they never received. Acceptable while
		// Gotenberg is reliable; revisit if failure rate climbs.
		await consumePDFExport(quotation.agencyId);

		// Convert to PDF
		const pdfBuffer = await convertHtmlToPdf(html, locals.user.id);
		const filename = `${quotation.quotationNumber}.pdf`;

		return new Response(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Content-Length": pdfBuffer.byteLength.toString(),
				// no-store: every download must hit the server so consumePDFExport runs.
				// Prior `max-age=60` let browsers serve repeat downloads from cache and
				// silently skip the usage counter.
				"Cache-Control": "private, no-store",
			},
		});
	} catch (err) {
		if (err instanceof RateLimitError) {
			return json({ error: err.message }, { status: 429 });
		}
		console.error("PDF generation error:", err);
		// Forward the HttpError shape (status + structured body from usage.ts)
		// so the frontend can render a clean "Resets 1 May 2026 — all 10 used"
		// alert without regex-parsing the raw Go message on every page.
		const httpErr = err as {
			status?: number;
			body?: { message?: string; limit?: number; feature?: string; resetDate?: string };
		};
		const status = httpErr?.status ?? 500;
		const message =
			httpErr?.body?.message ??
			(err instanceof Error ? err.message : "PDF generation failed");
		return json(
			{
				error: message,
				limit: httpErr?.body?.limit,
				feature: httpErr?.body?.feature,
				resetDate: httpErr?.body?.resetDate,
			},
			{ status },
		);
	}
};

/**
 * Form Submission PDF Generation API Endpoint
 *
 * GET /api/forms/[submissionId]/pdf - Download form submission as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires authentication and agency membership.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { formSubmissions, agencyForms, agencies, agencyProfiles, agencyMemberships } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { generateFormSubmissionPdfHtml } from "$lib/templates/form-submission-pdf";
import { convertHtmlToPdf, RateLimitError } from "$lib/server/gotenberg";
import { consumePDFExport } from "$lib/server/usage";

export const GET: RequestHandler = async ({ params, locals }) => {
	const { submissionId } = params;

	if (!submissionId) {
		return json({ error: "Submission ID is required" }, { status: 400 });
	}

	// Auth: require logged-in user
	if (!locals.user?.id) {
		return json({ error: "Authentication required" }, { status: 401 });
	}

	try {
		// Fetch submission with form
		const [result] = await db
			.select({
				submission: formSubmissions,
				form: agencyForms,
			})
			.from(formSubmissions)
			.leftJoin(agencyForms, eq(formSubmissions.formId, agencyForms.id))
			.where(eq(formSubmissions.id, submissionId));

		if (!result || !result.submission) {
			return json({ error: "Submission not found" }, { status: 404 });
		}

		const { submission, form } = result;

		if (!form) {
			return json({ error: "Form not found" }, { status: 404 });
		}

		// Auth: verify user has membership in this agency
		const membership = await db.query.agencyMemberships.findFirst({
			where: and(
				eq(agencyMemberships.userId, locals.user.id),
				eq(agencyMemberships.agencyId, submission.agencyId),
			),
		});

		if (!membership) {
			return json({ error: "Access denied" }, { status: 403 });
		}

		// Fetch agency and profile
		const [agency, profile] = await Promise.all([
			db.query.agencies.findFirst({
				where: eq(agencies.id, submission.agencyId),
			}),
			db.query.agencyProfiles.findFirst({
				where: eq(agencyProfiles.agencyId, submission.agencyId),
			}),
		]);

		if (!agency) {
			return json({ error: "Agency not found" }, { status: 404 });
		}

		// Generate HTML
		const html = generateFormSubmissionPdfHtml({
			submission: {
				id: submission.id,
				clientBusinessName: submission.clientBusinessName,
				clientEmail: submission.clientEmail,
				data: submission.data as Record<string, unknown>,
				status: submission.status,
				submittedAt: submission.submittedAt,
				createdAt: submission.createdAt,
			},
			form: {
				name: form.name,
				schema: form.schema,
			},
			agency,
			profile: profile || null,
		});

		// Enforce monthly PDF-export cap before hitting Gotenberg.
		// Throws 429 with reset_date on limit exceeded.
		// TODO(usage): consume runs before convertHtmlToPdf — a Gotenberg failure
		// here bills the agency for a PDF they never received. Acceptable while
		// Gotenberg is reliable; revisit if failure rate climbs.
		await consumePDFExport(submission.agencyId);

		// Convert to PDF
		const pdfBuffer = await convertHtmlToPdf(html, locals.user.id);

		// Generate filename from client business name and form name
		const clientName = submission.clientBusinessName
			? submission.clientBusinessName
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "")
			: "submission";
		const formName = form.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		const dateStr = new Date().toISOString().split("T")[0];
		const filename = `${formName}-${clientName}-${dateStr}.pdf`;

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
		// Forward HttpError status + message from consumePDFExport so 429/403
		// reach the caller intact instead of being flattened to 500.
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

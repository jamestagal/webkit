/**
 * Form Submission PDF Generation API Endpoint
 *
 * GET /api/forms/[submissionId]/pdf - Download form submission as PDF
 *
 * Uses Gotenberg for HTML-to-PDF conversion with professional template.
 * Requires agency membership and submission access permission.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { formSubmissions, agencyForms, agencies, agencyProfiles } from "$lib/server/schema";
import { eq } from "drizzle-orm";
import { generateFormSubmissionPdfHtml } from "$lib/templates/form-submission-pdf";
import { env } from "$env/dynamic/private";

const GOTENBERG_URL = env["GOTENBERG_URL"] || "http://localhost:3003";

export const GET: RequestHandler = async ({ params }) => {
	const { submissionId } = params;

	if (!submissionId) {
		return json({ error: "Submission ID is required" }, { status: 400 });
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

		// Convert to PDF using Gotenberg
		const formData = new FormData();
		formData.append("files", new Blob([html], { type: "text/html" }), "index.html");

		// Gotenberg options for A4
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
				"Cache-Control": "private, max-age=60",
			},
		});
	} catch (err) {
		console.error("PDF generation error:", err);
		const message = err instanceof Error ? err.message : "PDF generation failed";
		return json({ error: message }, { status: 500 });
	}
};

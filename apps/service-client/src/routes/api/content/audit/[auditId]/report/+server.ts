/**
 * Audit Report PDF Endpoint
 *
 * POST /api/content/audit/[auditId]/report - Generate and download SEO audit PDF report
 *
 * Proxies the request to the Go content-service which generates the HTML report
 * and converts it to PDF via Gotenberg. Forwards auth cookies and agency context.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { getAgencyContext } from "$lib/server/agency";

const CONTENT_URL = env["CONTENT_URL"] || "http://localhost:5001";

export const POST: RequestHandler = async ({ params, cookies }) => {
	const { auditId } = params;

	if (!auditId) {
		return json({ error: "Audit ID is required" }, { status: 400 });
	}

	try {
		const accessToken = cookies.get("access_token");
		const context = await getAgencyContext();

		const res = await fetch(`${CONTENT_URL}/api/content/audit/${auditId}/report`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
				"X-Agency-ID": context.agencyId,
			},
		});

		if (!res.ok) {
			const errBody = await res.json().catch(() => ({ message: "Report generation failed" }));
			return json({ error: errBody.message }, { status: res.status });
		}

		const buffer = await res.arrayBuffer();
		const contentType = res.headers.get("Content-Type") || "application/pdf";
		const contentDisposition =
			res.headers.get("Content-Disposition") ||
			'attachment; filename="seo-audit-report.pdf"';

		return new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": contentDisposition,
				"Content-Length": buffer.byteLength.toString(),
			},
		});
	} catch (err) {
		console.error("Audit report generation error:", err);
		const message = err instanceof Error ? err.message : "Report generation failed";
		return json({ error: message }, { status: 500 });
	}
};

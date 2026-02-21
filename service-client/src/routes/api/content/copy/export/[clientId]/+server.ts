/**
 * Copy Export API Endpoint
 *
 * POST /api/content/copy/export/[clientId] - Export copy as markdown/txt zip or PDF
 *
 * Proxies the request to the Go content-service which handles the actual
 * export generation. Forwards auth cookies and agency context securely.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { getAgencyContext } from "$lib/server/agency";

const CONTENT_URL = env["CONTENT_URL"] || "http://localhost:5001";

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const { clientId } = params;

	if (!clientId) {
		return json({ error: "Client ID is required" }, { status: 400 });
	}

	try {
		const accessToken = cookies.get("access_token");
		const context = await getAgencyContext();
		const body = await request.json();

		const res = await fetch(`${CONTENT_URL}/api/content/copy/export/${clientId}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
				"X-Agency-ID": context.agencyId,
			},
			body: JSON.stringify({
				format: body.format,
				scope: body.scope,
				selected_copy_ids: body.selectedCopyIds,
			}),
		});

		if (!res.ok) {
			const errBody = await res.json().catch(() => ({ message: "Export failed" }));
			return json({ error: errBody.message }, { status: res.status });
		}

		const buffer = await res.arrayBuffer();
		const contentType = res.headers.get("Content-Type") || "application/octet-stream";
		const contentDisposition =
			res.headers.get("Content-Disposition") || 'attachment; filename="export"';

		return new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": contentDisposition,
				"Content-Length": buffer.byteLength.toString(),
			},
		});
	} catch (err) {
		console.error("Copy export error:", err);
		const message = err instanceof Error ? err.message : "Export failed";
		return json({ error: message }, { status: 500 });
	}
};

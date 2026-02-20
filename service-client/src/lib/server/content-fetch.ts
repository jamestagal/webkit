/**
 * Content Service Fetch Helper
 *
 * Server-only utility for proxying requests to the Go content-service.
 * Placed in $lib/server/ (not .remote.ts) so it can be imported by
 * multiple remote function files without violating the "all exports
 * must be remote functions" constraint.
 */

import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { getAgencyContext } from "$lib/server/agency";
import { error } from "@sveltejs/kit";

/**
 * Fetch from the Go content-service with auth forwarding.
 * Similar to callBillingAPI in billing.remote.ts but adds X-Agency-ID header.
 */
export async function contentFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const event = getRequestEvent();
	const accessToken = event.cookies.get("access_token");
	const context = await getAgencyContext();

	const res = await fetch(`${env["CONTENT_URL"]}${endpoint}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			"X-Agency-ID": context.agencyId,
			...options.headers,
		},
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({ message: "Content service error" }));
		throw error(res.status, body.message || "Content API error");
	}

	const json = await res.json();
	return json.data as T;
}

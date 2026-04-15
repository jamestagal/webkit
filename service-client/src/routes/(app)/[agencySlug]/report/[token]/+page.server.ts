/**
 * Public SEO audit report loader.
 *
 * Unauthenticated — token validation is the access control. Auth bypass is
 * wired in hooks.server.ts (public-route regex) and the parent agency layout
 * (branding-only early return).
 */

import { error } from "@sveltejs/kit";
import { loadPublicReport, recordShareView } from "$lib/server/share-tokens";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const { agencySlug, token } = params;

	const result = await loadPublicReport(token, agencySlug);

	// Revoked and not-found collapse into a single 404 — no existence leak.
	if (result.status === "not-found" || result.status === "revoked") {
		throw error(404, "Report not available");
	}

	if (result.status === "expired") {
		return {
			expired: true as const,
			agency: result.agency,
		};
	}

	// Silent on revoked/expired — separate call but validation already passed.
	await recordShareView(token);

	return {
		expired: false as const,
		audit: result.audit,
		agency: result.agency,
		client: result.client,
		issues: result.issues,
		backlink: result.backlink,
		keyword: result.keyword,
		competitors: result.competitors,
	};
};

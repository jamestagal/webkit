/**
 * Server-only helpers for share-link presentation.
 *
 * Extracted from content-audit.remote.ts so non-remote consumers (new
 * getClientReports query) can reuse the same URL construction + status
 * derivation without duplicating logic.
 *
 * Remote-function rule: .remote.ts files can only export wrapped functions,
 * so these utilities must live outside that boundary.
 */
import { env } from "$env/dynamic/public";

export function buildShareUrl(agencySlug: string, token: string): string {
	const host = env["PUBLIC_APP_DOMAIN"] || "app.webkit.au";
	const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
	return `${protocol}://${host}/${agencySlug}/report/${token}`;
}

export type ShareComputedStatus = "active" | "revoked" | "expired";

/**
 * Single-value status for row-level UI (e.g. table badge). Revoked takes
 * precedence over expired when both apply. Callers that need to display
 * both flags independently (e.g. ShareReportModal, which shows an expiry
 * note inside the revoked branch) should compute isRevoked / isExpired
 * booleans directly from the row — NOT round-trip through this string.
 */
export function deriveShareStatus(row: {
	shareRevokedAt: Date | null;
	shareExpiresAt: Date | null;
}): ShareComputedStatus {
	if (row.shareRevokedAt != null) return "revoked";
	if (row.shareExpiresAt != null && row.shareExpiresAt.getTime() < Date.now()) {
		return "expired";
	}
	return "active";
}

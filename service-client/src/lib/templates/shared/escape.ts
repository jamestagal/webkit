/**
 * Shared HTML escaping utility for PDF templates.
 * Prevents XSS by escaping special HTML characters.
 */

/**
 * Escape HTML special characters for safe text rendering.
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Validate that a logo URL is safe for embedding in PDFs.
 * Only allows data:image/ URIs (current storage pattern).
 * Returns empty string for unsafe URLs.
 */
export function sanitizeLogoUrl(url: string | null | undefined): string {
	if (!url || !url.trim()) return "";
	const trimmed = url.trim();

	// Allow data:image/ URIs (base64 encoded images — current pattern)
	if (trimmed.startsWith("data:image/")) return trimmed;

	// Reject everything else: https://, javascript:, data:text/html, etc.
	return "";
}

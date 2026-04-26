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
 * Allows data:image/ URIs and HTTPS URLs pointing to image files.
 * Returns empty string for unsafe URLs.
 */
export function sanitizeLogoUrl(url: string | null | undefined): string {
	if (!url || !url.trim()) return "";
	const trimmed = url.trim();

	// Allow data:image/ URIs (base64 encoded images)
	if (trimmed.startsWith("data:image/")) return trimmed;

	// Allow HTTPS URLs to image files
	if (trimmed.startsWith("https://")) {
		try {
			const parsed = new URL(trimmed);
			const path = parsed.pathname.toLowerCase();
			if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(path)) {
				return trimmed;
			}
		} catch {
			// Invalid URL
		}
	}

	// Reject everything else: http://, javascript:, data:text/html, etc.
	return "";
}

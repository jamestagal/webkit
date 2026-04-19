/**
 * Client-side PDF download helper.
 *
 * Replaces `window.open('/api/.../pdf', '_blank')` and `<a href download>`
 * patterns so quota errors (HTTP 429 / 403) can be handled inline instead
 * of rendering as raw JSON in a new tab.
 *
 * Usage:
 *   try {
 *     await downloadPdf('/api/invoices/abc/pdf', 'INV-0001.pdf');
 *   } catch (err) {
 *     if (err instanceof PDFDownloadError && err.isLimit) { ... }
 *   }
 */

export class PDFDownloadError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly isLimit: boolean,
	) {
		super(message);
		this.name = "PDFDownloadError";
	}
}

/**
 * Fetches a PDF from `url` and triggers a browser download as `filename`.
 *
 * If `filename` is an empty string the server's `Content-Disposition`
 * header is honoured (fallback for callers that don't know the filename
 * client-side).
 *
 * Throws PDFDownloadError on non-2xx responses. `isLimit === true` means
 * the failure was a usage-cap hit — agency callers should render an
 * Upgrade CTA, public share pages should swallow the server message and
 * show a generic "temporarily unavailable" line.
 */
export async function downloadPdf(url: string, filename: string): Promise<void> {
	const res = await fetch(url);

	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as {
			error?: string;
			message?: string;
		};
		const message =
			body.error ?? body.message ?? `PDF download failed (${res.status})`;
		const isLimit =
			res.status === 429 ||
			(res.status === 403 && /limit|not available|upgrade/i.test(message));
		throw new PDFDownloadError(res.status, message, isLimit);
	}

	const blob = await res.blob();
	const objectUrl = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = objectUrl;
	a.download = filename || extractFilenameFromDisposition(res) || "download.pdf";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(objectUrl);
}

function extractFilenameFromDisposition(res: Response): string | null {
	const header = res.headers.get("Content-Disposition");
	if (!header) return null;
	// attachment; filename="foo.pdf"  OR  filename=foo.pdf
	const match = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
	const raw = match?.[1];
	return raw ? decodeURIComponent(raw) : null;
}

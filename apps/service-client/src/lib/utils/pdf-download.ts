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
		public readonly limit?: number,
		public readonly feature?: string,
		public readonly resetDate?: string,
	) {
		super(message);
		this.name = "PDFDownloadError";
	}
}

const FEATURE_LABELS: Record<string, string> = {
	pdf_export: "PDF export",
	ai_generation: "AI generation",
	seo_audit: "SEO audit",
};

function featureLabel(feature: string | undefined): string {
	return feature ? FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ") : "export";
}

function formatResetDate(iso: string | undefined): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	// en-GB gives "1 May 2026" (day-month-year) which reads naturally in the
	// UK/AU market this app targets, without the US comma.
	return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Human-friendly single-line message for inline alerts on detail pages.
 * Example: "You've used all 10 PDF exports for this month. Resets 1 May 2026."
 * Upgrade CTA is rendered as a separate button below, so this string doesn't
 * include "Upgrade your plan for more" — keeps the alert tight.
 */
export function friendlyLimitMessage(err: PDFDownloadError): string {
	if (!err.isLimit) return err.message;
	const label = featureLabel(err.feature);
	const noun = `${label}${label.endsWith("s") ? "" : "s"}`;
	const parts: string[] = [];
	parts.push(
		err.limit
			? `You've used all ${err.limit} ${noun} for this month.`
			: `You've hit your monthly ${label} limit.`,
	);
	const resets = formatResetDate(err.resetDate);
	if (resets) parts.push(`Resets ${resets}.`);
	return parts.join(" ");
}

/**
 * Title + body for toast notifications on surfaces where a CTA can't sit
 * beside the message (e.g. the invoice list page). Includes the upgrade
 * nudge in the body since the toast has no button.
 */
export function formatLimitToast(err: PDFDownloadError): { title: string; body: string } {
	if (!err.isLimit) {
		return { title: "PDF download failed", body: err.message };
	}
	return {
		title: `Monthly ${featureLabel(err.feature)} limit reached`,
		body: `${friendlyLimitMessage(err)} Upgrade your plan for more.`,
	};
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
			limit?: number;
			feature?: string;
			resetDate?: string;
		};
		const message =
			body.error ?? body.message ?? `PDF download failed (${res.status})`;
		const isLimit =
			res.status === 429 ||
			(res.status === 403 && /limit|not available|upgrade/i.test(message));
		throw new PDFDownloadError(
			res.status,
			message,
			isLimit,
			body.limit,
			body.feature,
			body.resetDate,
		);
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

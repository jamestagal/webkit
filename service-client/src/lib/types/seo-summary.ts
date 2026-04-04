/**
 * SEO Summary Structured Data Types
 *
 * Used for rendering the visual SEO Health Summary component
 * in proposals. The DB stores this as a JSON-stringified string
 * in the proposals.seo_summary text column.
 */

export interface SEOSummaryData {
	overallScore: number;
	overallAssessment: string;
	categories: Array<{
		name: string;
		score: number;
		status: "green" | "yellow" | "red";
		description: string;
	}>;
	criticalIssues: Array<{
		title: string;
		impact: string;
	}>;
	recommendations: Array<{
		action: string;
		detail: string;
	}>;
}

/**
 * Try to parse a seoSummary string as structured JSON data.
 * Returns null if the content is legacy HTML or invalid JSON.
 */
export function parseSEOSummary(raw: string): SEOSummaryData | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			typeof parsed.overallScore === "number" &&
			Array.isArray(parsed.categories)
		) {
			return parsed as SEOSummaryData;
		}
	} catch {
		/* not JSON — legacy HTML content */
	}
	return null;
}

/**
 * Get the DaisyUI color class for a score value.
 */
export function getScoreStatus(score: number): "green" | "yellow" | "red" {
	if (score >= 80) return "green";
	if (score >= 50) return "yellow";
	return "red";
}

/**
 * Get Tailwind text color class for a score status.
 */
export function getStatusColorClass(status: "green" | "yellow" | "red"): string {
	switch (status) {
		case "green":
			return "text-success";
		case "yellow":
			return "text-warning";
		case "red":
			return "text-error";
	}
}

/**
 * Get Tailwind background color class for a score status.
 */
export function getStatusBgClass(status: "green" | "yellow" | "red"): string {
	switch (status) {
		case "green":
			return "bg-success/10";
		case "yellow":
			return "bg-warning/10";
		case "red":
			return "bg-error/10";
	}
}

/**
 * PageSpeed Insights Service
 *
 * Provides website performance auditing via PageSpeed Insights API.
 * Ported from Plentify project with TypeScript types.
 */

import { config } from "dotenv";
import { resolve } from "path";
import type { PerformanceData, WebVitalMetric } from "$lib/server/schema";

// Load .env file explicitly
config({ path: resolve(process.cwd(), ".env") });
const env = process.env;

// Configuration
// Use Google's API directly with API key, or fall back to proxy
const GOOGLE_PAGESPEED_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PAGESPEED_API_KEY = env["PAGESPEED_API_KEY"] || "";
const PAGESPEED_PROXY_URL = env["PAGESPEED_API_URL"] || "";

const DEFAULT_STRATEGY = "mobile";
// Request all Lighthouse categories for full audit
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

// =============================================================================
// Types
// =============================================================================

interface LighthouseAudit {
	id: string;
	title: string;
	description?: string;
	score: number | null;
	displayValue?: string;
	numericValue?: number;
	details?: {
		type: string;
	};
}

interface LighthouseCategoryScore {
	score: number;
}

interface LighthouseResult {
	categories: {
		performance?: LighthouseCategoryScore;
		accessibility?: LighthouseCategoryScore;
		"best-practices"?: LighthouseCategoryScore;
		seo?: LighthouseCategoryScore;
	};
	audits: Record<string, LighthouseAudit>;
}

interface PageSpeedResponse {
	lighthouseResult?: LighthouseResult;
	error?: {
		message: string;
	};
}

interface ParsedMetric {
	title: string;
	description: string;
	rawValue: number | null;
	displayValue: string;
	category: "good" | "needs-improvement" | "poor" | "unknown";
	formattedValue: string;
}

interface Recommendation {
	title: string;
	description: string;
	score: number;
	displayValue?: string;
}

export interface PageSpeedResult {
	// All Lighthouse category scores (0-100)
	score: number; // Performance score (primary)
	accessibility: number;
	bestPractices: number;
	seo: number;
	// Core Web Vitals
	metrics: {
		LCP: ParsedMetric;
		CLS: ParsedMetric;
		INP: ParsedMetric;
		FCP: ParsedMetric;
		TBT: ParsedMetric;
		SI: ParsedMetric;
	};
	recommendations: Recommendation[];
	priorityRecommendations: string[];
}

// =============================================================================
// Core Web Vitals Thresholds
// =============================================================================

const THRESHOLDS: Record<string, { good: number; needsImprovement: number }> = {
	"largest-contentful-paint": { good: 2.5, needsImprovement: 4.0 }, // seconds
	"cumulative-layout-shift": { good: 0.1, needsImprovement: 0.25 }, // unitless
	"interaction-to-next-paint": { good: 0.2, needsImprovement: 0.5 }, // seconds
	interactive: { good: 3.8, needsImprovement: 7.3 }, // seconds
	"first-contentful-paint": { good: 1.8, needsImprovement: 3.0 }, // seconds
	"speed-index": { good: 3.4, needsImprovement: 5.8 }, // seconds
	"total-blocking-time": { good: 200, needsImprovement: 600 }, // milliseconds
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize metric values (convert ms to seconds for time-based metrics)
 */
function normalizeMetricValue(audit: LighthouseAudit | undefined): number | null {
	if (!audit || audit.numericValue === undefined) return null;

	let value = audit.numericValue;

	// Convert milliseconds to seconds for time-based metrics
	if (
		(audit.id === "largest-contentful-paint" ||
			audit.id === "first-contentful-paint" ||
			audit.id === "interactive" ||
			audit.id === "speed-index") &&
		value > 1000
	) {
		value = value / 1000;
	}

	return value;
}

/**
 * Determine performance category based on thresholds
 */
function getPerformanceCategory(
	metricId: string,
	value: number | null,
): "good" | "needs-improvement" | "poor" | "unknown" {
	if (value === null) return "unknown";

	const threshold = THRESHOLDS[metricId] || { good: 0, needsImprovement: 0 };

	if (metricId === "total-blocking-time") {
		// In ms, lower is better
		if (value <= threshold.good) return "good";
		if (value <= threshold.needsImprovement) return "needs-improvement";
		return "poor";
	} else if (metricId === "interaction-to-next-paint") {
		// Special handling for INP
		if (value > 1) {
			if (value <= 2) return "needs-improvement";
			return "poor";
		}
		if (value <= threshold.good) return "good";
		if (value <= threshold.needsImprovement) return "needs-improvement";
		return "poor";
	} else {
		// All other metrics
		if (value <= threshold.good) return "good";
		if (value <= threshold.needsImprovement) return "needs-improvement";
		return "poor";
	}
}

/**
 * Create a fallback result when data is missing
 */
function createFallbackResult(score: number): PageSpeedResult {
	const fallbackMetric: ParsedMetric = {
		title: "",
		description: "",
		rawValue: null,
		displayValue: "N/A",
		category: "unknown",
		formattedValue: "N/A",
	};

	return {
		score,
		accessibility: 0,
		bestPractices: 0,
		seo: 0,
		metrics: {
			LCP: { ...fallbackMetric, title: "Largest Contentful Paint" },
			CLS: { ...fallbackMetric, title: "Cumulative Layout Shift" },
			INP: { ...fallbackMetric, title: "Interaction to Next Paint" },
			FCP: { ...fallbackMetric, title: "First Contentful Paint" },
			TBT: { ...fallbackMetric, title: "Total Blocking Time" },
			SI: { ...fallbackMetric, title: "Speed Index" },
		},
		recommendations: [
			{
				title: "Optimize server response time",
				description: "Reduce server response times",
				score: 0,
			},
			{
				title: "Eliminate render-blocking resources",
				description: "Resources block the first paint of your page",
				score: 0,
			},
			{
				title: "Reduce unused JavaScript",
				description: "Reduce unused JavaScript to decrease payload sizes",
				score: 0,
			},
		],
		priorityRecommendations: [
			"Optimize server response time",
			"Eliminate render-blocking resources",
		],
	};
}

// =============================================================================
// Main API Functions
// =============================================================================

/**
 * Fetch PageSpeed Insights data for a URL
 * Uses Google's API directly if API key is configured, otherwise falls back to proxy
 */
export async function fetchPageSpeedData(url: string): Promise<PageSpeedResponse> {
	let apiUrl: URL;

	if (PAGESPEED_API_KEY) {
		// Use Google's API directly with API key
		apiUrl = new URL(GOOGLE_PAGESPEED_API);
		apiUrl.searchParams.set("key", PAGESPEED_API_KEY);
	} else if (PAGESPEED_PROXY_URL) {
		// Fall back to proxy (which adds its own API key)
		apiUrl = new URL(PAGESPEED_PROXY_URL);
	} else {
		throw new Error("PageSpeed API not configured. Set PAGESPEED_API_KEY or PAGESPEED_API_URL.");
	}

	apiUrl.searchParams.set("url", url);
	apiUrl.searchParams.set("strategy", DEFAULT_STRATEGY);
	// Request all Lighthouse categories
	for (const category of CATEGORIES) {
		apiUrl.searchParams.append("category", category);
	}

	console.log("Fetching PageSpeed data from:", apiUrl.toString().replace(PAGESPEED_API_KEY, "***"));
	const response = await fetch(apiUrl.toString());

	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage = `HTTP error! status: ${response.status}`;

		try {
			const errorData = JSON.parse(errorText);
			errorMessage = errorData.error?.message || errorData.error || errorMessage;
		} catch {
			errorMessage = errorText || errorMessage;
		}

		throw new Error(errorMessage);
	}

	const data = await response.json();
	console.log("PageSpeed API response keys:", Object.keys(data));
	if (data.lighthouseResult) {
		console.log(
			"lighthouseResult.categories:",
			Object.keys(data.lighthouseResult.categories || {}),
		);
		console.log(
			"lighthouseResult.audits count:",
			Object.keys(data.lighthouseResult.audits || {}).length,
		);
	}
	return data;
}

/**
 * Parse PageSpeed Insights API response into structured data
 */
export function parsePageSpeedResults(pageSpeedData: PageSpeedResponse): PageSpeedResult {
	if (!pageSpeedData) {
		console.warn("PageSpeed data is undefined or null, using fallback");
		return createFallbackResult(50);
	}

	if (!pageSpeedData.lighthouseResult) {
		console.warn("Missing lighthouseResult in PageSpeed data, using fallback");
		console.warn("Received data:", JSON.stringify(pageSpeedData).slice(0, 500));
		return createFallbackResult(45);
	}

	const { lighthouseResult } = pageSpeedData;

	if (!lighthouseResult.categories?.performance) {
		console.warn("Missing performance category, using fallback");
		console.warn("Available categories:", Object.keys(lighthouseResult.categories || {}));
		return createFallbackResult(40);
	}

	if (typeof lighthouseResult.categories.performance.score !== "number") {
		console.warn("Performance score is not a number, using fallback");
		console.warn("Score value:", lighthouseResult.categories.performance.score);
		return createFallbackResult(35);
	}

	// Extract all category scores (0-100)
	const performanceScore = Math.round(lighthouseResult.categories.performance.score * 100);
	const accessibilityScore = lighthouseResult.categories.accessibility
		? Math.round(lighthouseResult.categories.accessibility.score * 100)
		: 0;
	const bestPracticesScore = lighthouseResult.categories["best-practices"]
		? Math.round(lighthouseResult.categories["best-practices"].score * 100)
		: 0;
	const seoScore = lighthouseResult.categories.seo
		? Math.round(lighthouseResult.categories.seo.score * 100)
		: 0;

	// Get raw audits
	const audits = lighthouseResult.audits || {};
	const rawMetrics = {
		lcp: audits["largest-contentful-paint"],
		cls: audits["cumulative-layout-shift"],
		inp: audits["interaction-to-next-paint"],
		tti: audits["interactive"],
		fcp: audits["first-contentful-paint"],
		tbt: audits["total-blocking-time"],
		si: audits["speed-index"],
	};

	// Process metrics
	const metrics: PageSpeedResult["metrics"] = {
		LCP: {
			title: "Largest Contentful Paint (LCP)",
			description: "How quickly does the main content load?",
			rawValue: normalizeMetricValue(rawMetrics.lcp),
			displayValue: rawMetrics.lcp?.displayValue || "N/A",
			category: getPerformanceCategory(
				"largest-contentful-paint",
				normalizeMetricValue(rawMetrics.lcp),
			),
			formattedValue:
				normalizeMetricValue(rawMetrics.lcp) !== null
					? `${normalizeMetricValue(rawMetrics.lcp)!.toFixed(1)}s`
					: "N/A",
		},
		CLS: {
			title: "Cumulative Layout Shift (CLS)",
			description: "Does the page layout shift unexpectedly?",
			rawValue: normalizeMetricValue(rawMetrics.cls),
			displayValue: rawMetrics.cls?.displayValue || "N/A",
			category: getPerformanceCategory(
				"cumulative-layout-shift",
				normalizeMetricValue(rawMetrics.cls),
			),
			formattedValue:
				normalizeMetricValue(rawMetrics.cls) !== null
					? normalizeMetricValue(rawMetrics.cls)!.toFixed(2)
					: "N/A",
		},
		INP: {
			title: "Interaction to Next Paint (INP)",
			description: "How quickly does the page respond to user input?",
			rawValue: normalizeMetricValue(rawMetrics.inp) || normalizeMetricValue(rawMetrics.tti),
			displayValue: rawMetrics.inp?.displayValue || rawMetrics.tti?.displayValue || "N/A",
			category: (() => {
				const value = normalizeMetricValue(rawMetrics.inp) || normalizeMetricValue(rawMetrics.tti);
				if (value !== null && value >= 1 && value < 20) {
					if (value <= 0.2) return "good";
					if (value <= 0.5) return "needs-improvement";
					return "poor";
				}
				return getPerformanceCategory(
					rawMetrics.inp ? "interaction-to-next-paint" : "interactive",
					value,
				);
			})(),
			formattedValue: (() => {
				const value = normalizeMetricValue(rawMetrics.inp) || normalizeMetricValue(rawMetrics.tti);
				if (value === null) return "N/A";
				if (value >= 1 && value < 20) return `${value.toFixed(1)}s`;
				if (value >= 100) return `${value.toFixed(0)}ms`;
				return `${value.toFixed(1)}s`;
			})(),
		},
		FCP: {
			title: "First Contentful Paint (FCP)",
			description: "How quickly does content first appear?",
			rawValue: normalizeMetricValue(rawMetrics.fcp),
			displayValue: rawMetrics.fcp?.displayValue || "N/A",
			category: getPerformanceCategory(
				"first-contentful-paint",
				normalizeMetricValue(rawMetrics.fcp),
			),
			formattedValue:
				normalizeMetricValue(rawMetrics.fcp) !== null
					? `${normalizeMetricValue(rawMetrics.fcp)!.toFixed(1)}s`
					: "N/A",
		},
		TBT: {
			title: "Total Blocking Time (TBT)",
			description: "How much time is blocked by scripts?",
			rawValue: normalizeMetricValue(rawMetrics.tbt),
			displayValue: rawMetrics.tbt?.displayValue || "N/A",
			category: getPerformanceCategory("total-blocking-time", normalizeMetricValue(rawMetrics.tbt)),
			formattedValue:
				normalizeMetricValue(rawMetrics.tbt) !== null
					? `${normalizeMetricValue(rawMetrics.tbt)!.toFixed(0)}ms`
					: "N/A",
		},
		SI: {
			title: "Speed Index (SI)",
			description: "How quickly content is visibly populated?",
			rawValue: normalizeMetricValue(rawMetrics.si),
			displayValue: rawMetrics.si?.displayValue || "N/A",
			category: getPerformanceCategory("speed-index", normalizeMetricValue(rawMetrics.si)),
			formattedValue:
				normalizeMetricValue(rawMetrics.si) !== null
					? `${normalizeMetricValue(rawMetrics.si)!.toFixed(1)}s`
					: "N/A",
		},
	};

	// Extract recommendations (opportunities)
	const recommendations: Recommendation[] = [];

	// Get opportunities for improvement
	const opportunities = Object.values(audits)
		.filter(
			(audit): audit is LighthouseAudit =>
				audit !== undefined &&
				audit.details?.type === "opportunity" &&
				typeof audit.score === "number" &&
				audit.score < 1 &&
				!!audit.displayValue,
		)
		.sort((a, b) => (a.score || 0) - (b.score || 0))
		.map((audit) => ({
			title: audit.title || "Unnamed Audit",
			description: audit.description || "",
			score: audit.score || 0,
			displayValue: audit.displayValue || "N/A",
		}));

	recommendations.push(...opportunities);

	// Add diagnostics if not enough recommendations
	if (recommendations.length < 3) {
		const diagnostics = Object.values(audits)
			.filter(
				(audit): audit is LighthouseAudit =>
					audit !== undefined &&
					audit.details?.type === "diagnostic" &&
					typeof audit.score === "number" &&
					audit.score < 0.9,
			)
			.slice(0, 5)
			.map((audit) => ({
				title: audit.title || "Unnamed Audit",
				description: audit.description || "",
				score: audit.score || 0,
			}));

		recommendations.push(...diagnostics);
	}

	// Default recommendations if none found
	if (recommendations.length === 0) {
		recommendations.push(
			{
				title: "Optimize server response time",
				description: "Reduce server response times",
				score: 0,
			},
			{
				title: "Eliminate render-blocking resources",
				description: "Resources block the first paint of your page",
				score: 0,
			},
			{
				title: "Reduce unused JavaScript",
				description: "Reduce unused JavaScript to decrease payload sizes",
				score: 0,
			},
		);
	}

	// Get top priority recommendations
	const priorityRecommendations = recommendations.slice(0, 5).map((rec) => rec.title);

	return {
		score: performanceScore,
		accessibility: accessibilityScore,
		bestPractices: bestPracticesScore,
		seo: seoScore,
		metrics,
		recommendations: recommendations.slice(0, 10),
		priorityRecommendations,
	};
}

/**
 * Convert PageSpeedResult to PerformanceData format for storage
 */
export function toPerformanceData(result: PageSpeedResult, url: string): PerformanceData {
	const convertMetric = (metric: ParsedMetric): WebVitalMetric => ({
		value: metric.formattedValue,
		category: metric.category === "unknown" ? "poor" : metric.category,
		description: metric.description,
	});

	return {
		// All Lighthouse category scores
		performance: result.score,
		accessibility: result.accessibility,
		bestPractices: result.bestPractices,
		seo: result.seo,
		// Load time from LCP (main content load time)
		loadTime: result.metrics.LCP.formattedValue,
		// Core Web Vitals
		metrics: {
			LCP: convertMetric(result.metrics.LCP),
			CLS: convertMetric(result.metrics.CLS),
			INP: convertMetric(result.metrics.INP),
			FCP: convertMetric(result.metrics.FCP),
			TBT: convertMetric(result.metrics.TBT),
			SI: convertMetric(result.metrics.SI),
		},
		recommendations: result.priorityRecommendations,
		auditedAt: new Date().toISOString(),
		auditedUrl: url,
	};
}

/**
 * Run a full PageSpeed audit and return PerformanceData
 */
export async function runPageSpeedAudit(url: string): Promise<PerformanceData> {
	const response = await fetchPageSpeedData(url);
	const result = parsePageSpeedResults(response);
	return toPerformanceData(result, url);
}

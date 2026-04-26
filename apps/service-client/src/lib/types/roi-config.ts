/**
 * ROI Configuration Types
 *
 * Configuration for ROI analysis generation with guardrails.
 * ROI is OFF by default and requires explicit agency opt-in.
 */

import type { ROIAnalysis, ROIProjection } from "./ai-proposal";

/**
 * Agency-configurable ROI settings
 */
export interface ROIConfiguration {
	/** Whether ROI section is enabled for this agency */
	enabled: boolean;

	/** Custom formulas for ROI calculations */
	formulas: {
		/** Expected conversion rate improvement (percentage) */
		conversionImprovement: {
			poor_to_good: number; // e.g., 15 (15% improvement)
			needs_improvement_to_good: number; // e.g., 8
		};

		/** Traffic increase estimates based on performance improvement */
		trafficImprovement: {
			per_10_point_score_increase: number; // e.g., 5 (5% more traffic)
		};

		/** Lead value estimates by industry */
		leadValues: Record<string, number>; // e.g., { "Electrical Services": 150 }
	};

	/** Confidence level descriptions */
	confidenceDescriptions: {
		low: string;
		medium: string;
		high: string;
	};

	/** Custom disclaimer text (cannot be empty) */
	disclaimer: string;
}

/**
 * Default ROI configuration - used when agency hasn't customised
 */
export const DEFAULT_ROI_CONFIG: ROIConfiguration = {
	enabled: false, // OFF by default
	formulas: {
		conversionImprovement: {
			poor_to_good: 15,
			needs_improvement_to_good: 8,
		},
		trafficImprovement: {
			per_10_point_score_increase: 5,
		},
		leadValues: {
			default: 100,
			"Electrical Services": 150,
			Plumbing: 200,
			"Legal Services": 500,
			Medical: 300,
			"E-commerce": 50,
			"Real Estate": 400,
			Accounting: 350,
			"Home Services": 175,
			Automotive: 200,
			Hospitality: 80,
			Retail: 40,
		},
	},
	confidenceDescriptions: {
		low: "Based on general industry trends",
		medium: "Based on similar client outcomes",
		high: "Based on your specific data and benchmarks",
	},
	disclaimer:
		"These projections are estimates based on industry benchmarks and historical data. Actual results will vary based on market conditions, competition, and other factors outside our control.",
};

/**
 * Minimum disclaimer that must always be included
 */
export const MANDATORY_DISCLAIMER_PREFIX =
	"These projections are estimates only. Actual results may vary.";

/**
 * Ensure disclaimer always includes mandatory text
 */
export function ensureDisclaimerValidity(disclaimer: string): string {
	if (!disclaimer || disclaimer.trim().length < 20) {
		return DEFAULT_ROI_CONFIG.disclaimer;
	}
	if (!disclaimer.toLowerCase().includes("estimate")) {
		return `${MANDATORY_DISCLAIMER_PREFIX} ${disclaimer}`;
	}
	return disclaimer;
}

/**
 * Re-export types from ai-proposal for convenience
 */
export type { ROIAnalysis, ROIProjection };

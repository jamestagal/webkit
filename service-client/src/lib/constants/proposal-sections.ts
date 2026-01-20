/**
 * Proposal Section Constants
 *
 * Shared constants for proposal sections that can be used in both
 * client and server code.
 */

/**
 * Section display names for UI
 */
export const SECTION_DISPLAY_NAMES: Record<string, string> = {
	executiveSummary: "Executive Summary",
	opportunityContent: "Market Opportunity",
	currentIssues: "Current Issues",
	performanceStandards: "Performance Standards",
	proposedPages: "Proposed Pages",
	timeline: "Project Timeline",
	nextSteps: "Next Steps",
	closingContent: "Closing",
};

/**
 * All available sections in order
 */
export const ALL_SECTIONS = [
	"executiveSummary",
	"opportunityContent",
	"currentIssues",
	"performanceStandards",
	"proposedPages",
	"timeline",
	"nextSteps",
	"closingContent",
] as const;

export type ProposalSection = (typeof ALL_SECTIONS)[number];

/**
 * AI Proposal Generation Types
 *
 * TypeScript interfaces for AI-generated proposal content.
 */

/**
 * AI-generated proposal content structure
 */
export interface AIProposalOutput {
	executiveSummary?: string;
	opportunityContent?: string;
	currentIssues?: CurrentIssue[];
	performanceStandards?: PerformanceStandard[];
	roiAnalysis?: ROIAnalysis;
	proposedPages?: ProposedPage[];
	timeline?: TimelinePhase[];
	nextSteps?: NextStep[];
	closingContent?: string;
}

export interface CurrentIssue {
	/** Clear, non-technical title */
	title: string;
	/** Business-impact focused description */
	description: string;
	/** Severity level */
	impact: 'high' | 'medium' | 'low';
	/** Where this issue was identified */
	source: 'pagespeed' | 'consultation' | 'inferred';
	/** Optional: specific metric or data point */
	metric?: string;
}

export interface PerformanceStandard {
	/** Metric name (e.g., "Page Load Time", "Mobile Score") */
	metric: string;
	/** Current value from audit */
	current: string;
	/** Target value after improvements */
	target: string;
	/** Percentage or description of improvement */
	improvement: string;
	/** Business impact of this improvement */
	businessImpact?: string;
}

export interface ROIAnalysis {
	/** Disclaimer text (always included) */
	disclaimer: string;
	/** Projected improvements */
	projections: ROIProjection[];
	/** Assumptions made */
	assumptions: string[];
	/** Time period for projections */
	timePeriod: string;
}

export interface ROIProjection {
	metric: string;
	currentEstimate: string;
	projectedEstimate: string;
	improvement: string;
	confidence: 'low' | 'medium' | 'high';
}

export interface ProposedPage {
	/** Page name */
	name: string;
	/** Brief description of page purpose */
	purpose: string;
	/** Priority level */
	priority: 'essential' | 'recommended' | 'optional';
	/** Key features/sections on this page */
	features?: string[];
}

export interface TimelinePhase {
	/** Phase name */
	phase: string;
	/** Duration in weeks */
	duration: string;
	/** Week numbers (e.g., "Week 1-2") */
	timing: string;
	/** What gets delivered */
	deliverables: string[];
	/** What client needs to provide */
	clientTasks?: string[];
}

export interface NextStep {
	/** Step number */
	order: number;
	/** Action title */
	action: string;
	/** Brief description */
	description: string;
	/** Who is responsible */
	owner: 'client' | 'agency' | 'both';
}

/**
 * JSON Schema for validating AI response (used with Ajv)
 */
export const AI_PROPOSAL_SCHEMA = {
	type: 'object',
	properties: {
		executiveSummary: { type: 'string', minLength: 100, maxLength: 2000 },
		opportunityContent: { type: 'string', minLength: 50, maxLength: 1500 },
		currentIssues: {
			type: 'array',
			items: {
				type: 'object',
				required: ['title', 'description', 'impact', 'source'],
				properties: {
					title: { type: 'string' },
					description: { type: 'string' },
					impact: { enum: ['high', 'medium', 'low'] },
					source: { enum: ['pagespeed', 'consultation', 'inferred'] },
					metric: { type: 'string' }
				}
			},
			minItems: 1,
			maxItems: 10
		},
		performanceStandards: {
			type: 'array',
			items: {
				type: 'object',
				required: ['metric', 'current', 'target', 'improvement'],
				properties: {
					metric: { type: 'string' },
					current: { type: 'string' },
					target: { type: 'string' },
					improvement: { type: 'string' },
					businessImpact: { type: 'string' }
				}
			}
		},
		roiAnalysis: {
			type: 'object',
			required: ['disclaimer', 'projections', 'assumptions', 'timePeriod'],
			properties: {
				disclaimer: { type: 'string' },
				projections: {
					type: 'array',
					items: {
						type: 'object',
						required: [
							'metric',
							'currentEstimate',
							'projectedEstimate',
							'improvement',
							'confidence'
						],
						properties: {
							metric: { type: 'string' },
							currentEstimate: { type: 'string' },
							projectedEstimate: { type: 'string' },
							improvement: { type: 'string' },
							confidence: { enum: ['low', 'medium', 'high'] }
						}
					}
				},
				assumptions: { type: 'array', items: { type: 'string' } },
				timePeriod: { type: 'string' }
			}
		},
		proposedPages: {
			type: 'array',
			items: {
				type: 'object',
				required: ['name', 'purpose', 'priority'],
				properties: {
					name: { type: 'string' },
					purpose: { type: 'string' },
					priority: { enum: ['essential', 'recommended', 'optional'] },
					features: { type: 'array', items: { type: 'string' } }
				}
			},
			minItems: 3,
			maxItems: 15
		},
		timeline: {
			type: 'array',
			items: {
				type: 'object',
				required: ['phase', 'duration', 'timing', 'deliverables'],
				properties: {
					phase: { type: 'string' },
					duration: { type: 'string' },
					timing: { type: 'string' },
					deliverables: { type: 'array', items: { type: 'string' } },
					clientTasks: { type: 'array', items: { type: 'string' } }
				}
			}
		},
		nextSteps: {
			type: 'array',
			items: {
				type: 'object',
				required: ['order', 'action', 'description', 'owner'],
				properties: {
					order: { type: 'number' },
					action: { type: 'string' },
					description: { type: 'string' },
					owner: { enum: ['client', 'agency', 'both'] }
				}
			},
			minItems: 3,
			maxItems: 7
		},
		closingContent: { type: 'string', minLength: 30, maxLength: 500 }
	}
} as const;

/**
 * Section keys that can be generated
 */
export type AIProposalSectionKey = keyof AIProposalOutput;

/**
 * Map of section keys to their value types
 */
export type AIProposalSectionValue<K extends AIProposalSectionKey> = NonNullable<AIProposalOutput[K]>;

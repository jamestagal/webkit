/**
 * Prompt Builder for AI Proposal Generation
 *
 * Assembles all consultation and agency context into a structured prompt
 * for Claude to generate proposal sections.
 */

import { PROPOSAL_SYSTEM_PROMPT } from './proposal-system';
import { SECTION_PROMPTS, type ProposalSection } from './proposal-sections';

/**
 * Performance data from PageSpeed audit
 */
export interface PerformanceDataContext {
	performance: number;
	metrics: Record<string, { value: string; category: string; description?: string }>;
	recommendations: string[];
	auditedUrl: string;
	auditedAt: string;
}

/**
 * Agency context for customising tone and content
 */
export interface AgencyContext {
	name: string;
	brandVoice?: 'professional' | 'friendly' | 'technical' | undefined;
	packages?: Array<{ name: string; priceRange: string; features: string[] }>;
	usps?: string[] | undefined;
}

/**
 * Full context for generating a proposal
 */
export interface PromptContext {
	// Client data (from consultation)
	businessName: string;
	contactPerson: string;
	industry: string;
	businessType: string;
	websiteStatus: 'refresh' | 'rebuild' | 'none';
	website?: string | undefined;

	// Challenges & Goals
	primaryChallenges: string[];
	urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
	primaryGoals: string[];
	conversionGoal?: string | undefined;
	budgetRange: string;
	timeline?: string | undefined;

	// Preferences
	designStyles?: string[] | undefined;
	admiredWebsites?: string | undefined;
	consultationNotes?: string | undefined;

	// PageSpeed data (optional)
	performanceData?: PerformanceDataContext | undefined;

	// Agency context
	agency: AgencyContext;
}

/**
 * Request for generating proposal content
 */
export interface GenerationRequest {
	context: PromptContext;
	sections: ProposalSection[];
}

/**
 * Build the complete prompt for proposal generation
 */
export function buildProposalPrompt(request: GenerationRequest): {
	system: string;
	user: string;
} {
	const { context, sections } = request;

	const userPrompt = `
## Client Information
- Business Name: ${context.businessName}
- Contact Person: ${context.contactPerson}
- Industry: ${context.industry}
- Business Type: ${context.businessType}
- Current Website: ${context.website || 'None'}
- Website Status: ${context.websiteStatus}

## Challenges
${context.primaryChallenges.map((c) => `- ${c}`).join('\n')}
- Urgency Level: ${context.urgencyLevel}

## Goals
${context.primaryGoals.map((g) => `- ${g}`).join('\n')}
- Primary Conversion Goal: ${context.conversionGoal || 'Not specified'}
- Budget Range: ${context.budgetRange}
- Timeline Preference: ${context.timeline || 'Flexible'}

## Design Preferences
${context.designStyles?.length ? `- Preferred Styles: ${context.designStyles.join(', ')}` : '- No style preferences specified'}
${context.admiredWebsites ? `- Admired Websites: ${context.admiredWebsites}` : ''}
${context.consultationNotes ? `- Additional Notes: ${context.consultationNotes}` : ''}

${context.performanceData ? buildPerformanceSection(context.performanceData) : '## PageSpeed Data\nNo audit data available. Use industry-standard benchmarks for performance targets.'}

## Agency Context
- Agency Name: ${context.agency.name}
${context.agency.brandVoice ? `- Brand Voice: ${context.agency.brandVoice}` : ''}
${context.agency.usps?.length ? `- Key Differentiators: ${context.agency.usps.join(', ')}` : ''}
${context.agency.packages?.length ? buildPackagesContext(context.agency.packages) : ''}

## Sections to Generate
Generate ONLY the following sections:
${sections.map((s) => `- ${s}: ${interpolatePrompt(SECTION_PROMPTS[s] || '', context)}`).join('\n\n')}

## Required Output Format
Return a JSON object with these exact keys:
${JSON.stringify(buildOutputSchema(sections), null, 2)}

Remember: Return ONLY the JSON object, no other text.`;

	return {
		system: PROPOSAL_SYSTEM_PROMPT,
		user: userPrompt
	};
}

/**
 * Build the performance section of the prompt
 */
function buildPerformanceSection(data: PerformanceDataContext): string {
	// Defensive checks for potentially null/undefined properties from JSONB
	const metrics = data.metrics || {};
	const recommendations = data.recommendations || [];

	const metricsText = Object.entries(metrics)
		.map(([key, val]) => `  - ${key}: ${val?.value || 'N/A'} (${val?.category || 'unknown'})`)
		.join('\n');

	return `## PageSpeed Audit Data
- Audited URL: ${data.auditedUrl || 'Unknown'}
- Audited At: ${data.auditedAt || 'Unknown'}
- Overall Performance Score: ${data.performance ?? 'N/A'}/100

### Core Web Vitals
${metricsText || '  - No metrics available'}

### Google's Recommendations
${recommendations.slice(0, 5).map((r) => `- ${r}`).join('\n') || '- No recommendations available'}`;
}

/**
 * Build the packages context section
 */
function buildPackagesContext(
	packages: NonNullable<AgencyContext['packages']>
): string {
	return `- Available Packages:
${packages.map((p) => `  - ${p.name} (${p.priceRange}): ${p.features.slice(0, 3).join(', ')}`).join('\n')}`;
}

/**
 * Interpolate placeholders in section prompts
 */
function interpolatePrompt(prompt: string, context: PromptContext): string {
	return prompt
		.replace(/{industry}/g, context.industry)
		.replace(/{businessType}/g, context.businessType)
		.replace(/{websiteStatus}/g, context.websiteStatus)
		.replace(/{contactPerson}/g, context.contactPerson)
		.replace(/{timeline}/g, context.timeline || 'flexible')
		.replace(/{budgetRange}/g, context.budgetRange);
}

/**
 * Build the expected output schema for the prompt
 * Shows explicit structure for array sections so AI knows what format to return
 */
function buildOutputSchema(sections: ProposalSection[]): Record<string, unknown> {
	const schema: Record<string, unknown> = {};
	sections.forEach((s) => {
		// Provide explicit structure for array sections
		if (s === 'currentIssues') {
			schema[s] = [{ title: 'string', description: 'string', impact: 'high|medium|low', source: 'pagespeed|consultation|inferred' }];
		} else if (s === 'performanceStandards') {
			schema[s] = [{ metric: 'string', current: 'string', target: 'string', improvement: 'string' }];
		} else if (s === 'proposedPages') {
			schema[s] = [{ name: 'string', purpose: 'string', priority: 'essential|recommended|optional' }];
		} else if (s === 'timeline') {
			schema[s] = [{ phase: 'string', duration: 'string', timing: 'string', deliverables: ['string'] }];
		} else if (s === 'nextSteps') {
			schema[s] = [{ order: 'number', action: 'string', description: 'string', owner: 'client|agency|both' }];
		} else {
			// String sections
			schema[s] = '<string content>';
		}
	});
	return schema;
}

/**
 * Validate that performanceData has the expected structure from PageSpeed audit
 */
function isValidPerformanceData(data: unknown): data is PerformanceDataContext {
	if (!data || typeof data !== 'object') return false;
	const obj = data as Record<string, unknown>;
	// At minimum, should have a performance score
	return typeof obj['performance'] === 'number';
}

/**
 * Extract context from a proposal record (used by remote function)
 */
export function buildContextFromProposal(
	proposal: {
		clientBusinessName?: string | null;
		clientContactName?: string | null;
		clientWebsite?: string | null;
		consultationChallenges?: string[] | null;
		consultationGoals?: {
			primary_goals?: string[];
			conversion_goal?: string;
			budget_range?: string;
		} | null;
		consultationPainPoints?: {
			urgency_level?: string;
		} | null;
		performanceData?: PerformanceDataContext | null;
	},
	consultation: {
		industry?: string | null;
		businessType?: string | null;
		websiteStatus?: string | null;
		timeline?: string | null;
		designStyles?: string[] | null;
		admiredWebsites?: string | null;
		consultationNotes?: string | null;
	} | null,
	agency: {
		businessName: string;
		brandVoice?: string | null;
		usps?: string[] | null;
	}
): PromptContext {
	// Validate brandVoice is a valid value
	const validBrandVoices = ['professional', 'friendly', 'technical'] as const;
	const brandVoice = agency.brandVoice && validBrandVoices.includes(agency.brandVoice as typeof validBrandVoices[number])
		? (agency.brandVoice as AgencyContext['brandVoice'])
		: undefined;

	return {
		businessName: proposal.clientBusinessName || 'Unknown Business',
		contactPerson: proposal.clientContactName || 'Client',
		industry: consultation?.industry || 'General',
		businessType: consultation?.businessType || 'Business',
		websiteStatus: (consultation?.websiteStatus as PromptContext['websiteStatus']) || 'refresh',
		website: proposal.clientWebsite || undefined,
		primaryChallenges: proposal.consultationChallenges || [],
		urgencyLevel:
			(proposal.consultationPainPoints?.urgency_level as PromptContext['urgencyLevel']) || 'medium',
		primaryGoals: proposal.consultationGoals?.primary_goals || [],
		conversionGoal: proposal.consultationGoals?.conversion_goal,
		budgetRange: proposal.consultationGoals?.budget_range || 'unknown',
		timeline: consultation?.timeline || undefined,
		designStyles: consultation?.designStyles || undefined,
		admiredWebsites: consultation?.admiredWebsites || undefined,
		consultationNotes: consultation?.consultationNotes || undefined,
		// Only include performanceData if it has meaningful content
		performanceData: isValidPerformanceData(proposal.performanceData) ? proposal.performanceData : undefined,
		agency: {
			name: agency.businessName,
			brandVoice,
			usps: agency.usps || undefined
		}
	};
}

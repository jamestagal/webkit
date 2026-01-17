/**
 * AI Response Parser
 *
 * Parses and validates AI-generated proposal content with retry logic.
 */

import type {
	AIProposalOutput,
	CurrentIssue,
	PerformanceStandard,
	ProposedPage,
	TimelinePhase,
	NextStep,
	ROIProjection
} from '$lib/types/ai-proposal';
import { AIServiceError, AIErrorCode } from './ai-errors';

/**
 * Options for parsing AI response
 */
export interface ParseOptions {
	/** Allow partial results (some sections missing) */
	allowPartial?: boolean | undefined;
	/** Sections that must be present */
	requiredSections?: string[] | undefined;
}

/**
 * Parse raw text response from Claude into structured proposal content
 */
export function parseAIResponse(
	rawText: string,
	options: ParseOptions = {}
): AIProposalOutput {
	if (!rawText || rawText.trim().length === 0) {
		throw new AIServiceError(
			'Empty response from AI',
			AIErrorCode.RESPONSE_EMPTY,
			true
		);
	}

	let jsonString = rawText.trim();

	// Handle common issues: markdown code blocks, leading/trailing text
	const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (jsonMatch && jsonMatch[1]) {
		jsonString = jsonMatch[1].trim();
	} else if (!rawText.trim().startsWith('{')) {
		// Try to find JSON object in the response
		const startIndex = rawText.indexOf('{');
		const endIndex = rawText.lastIndexOf('}');
		if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
			jsonString = rawText.slice(startIndex, endIndex + 1);
		}
	}

	// Parse JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonString);
	} catch {
		throw new AIServiceError(
			'Invalid JSON in AI response',
			AIErrorCode.RESPONSE_INVALID_JSON,
			true,
			{ raw: rawText.slice(0, 500) }
		);
	}

	// Basic type check
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new AIServiceError(
			'AI response is not a valid object',
			AIErrorCode.RESPONSE_SCHEMA_MISMATCH,
			true
		);
	}

	const result = parsed as Record<string, unknown>;

	// Validate required sections
	if (options.requiredSections?.length) {
		const missing = options.requiredSections.filter((section) => !result[section]);
		if (missing.length > 0 && !options.allowPartial) {
			throw new AIServiceError(
				`Missing required sections: ${missing.join(', ')}`,
				AIErrorCode.RESPONSE_MISSING_FIELDS,
				true,
				{ missing }
			);
		}
	}

	// Validate section types
	const validated = validateSectionTypes(result, options.allowPartial);

	return validated;
}

/**
 * Validate and coerce section types
 */
function validateSectionTypes(
	data: Record<string, unknown>,
	allowPartial?: boolean
): AIProposalOutput {
	const result: AIProposalOutput = {};

	// String sections
	if (typeof data['executiveSummary'] === 'string') {
		result.executiveSummary = data['executiveSummary'];
	}
	if (typeof data['opportunityContent'] === 'string') {
		result.opportunityContent = data['opportunityContent'];
	}
	if (typeof data['closingContent'] === 'string') {
		result.closingContent = data['closingContent'];
	}

	// Array sections with validation
	if (Array.isArray(data['currentIssues'])) {
		result.currentIssues = data['currentIssues'].filter(isValidCurrentIssue);
	}
	if (Array.isArray(data['performanceStandards'])) {
		result.performanceStandards = data['performanceStandards'].filter(isValidPerformanceStandard);
	}
	if (Array.isArray(data['proposedPages'])) {
		result.proposedPages = data['proposedPages'].filter(isValidProposedPage);
	}
	if (Array.isArray(data['timeline'])) {
		result.timeline = data['timeline'].filter(isValidTimelinePhase);
	}
	if (Array.isArray(data['nextSteps'])) {
		result.nextSteps = data['nextSteps'].filter(isValidNextStep);
	}

	// ROI Analysis (complex object)
	if (data['roiAnalysis'] && typeof data['roiAnalysis'] === 'object') {
		const roi = data['roiAnalysis'] as Record<string, unknown>;
		if (
			typeof roi['disclaimer'] === 'string' &&
			Array.isArray(roi['projections']) &&
			Array.isArray(roi['assumptions']) &&
			typeof roi['timePeriod'] === 'string'
		) {
			result.roiAnalysis = {
				disclaimer: roi['disclaimer'],
				projections: roi['projections'].filter(isValidROIProjection),
				assumptions: roi['assumptions'].filter((a): a is string => typeof a === 'string'),
				timePeriod: roi['timePeriod']
			};
		}
	}

	// Check if we got any content
	const hasContent = Object.keys(result).length > 0;
	if (!hasContent && !allowPartial) {
		throw new AIServiceError(
			'AI response contained no valid sections',
			AIErrorCode.RESPONSE_SCHEMA_MISMATCH,
			true
		);
	}

	return result;
}

// Type guards for section validation
// NOTE: These are lenient validators that accept variations in enum values
// and normalize them to expected values. This prevents data loss when AI
// returns slightly different formats.

function normalizeImpact(value: unknown): 'high' | 'medium' | 'low' | null {
	if (typeof value !== 'string') return null;
	const lower = value.toLowerCase();
	if (lower.includes('high') || lower.includes('critical')) return 'high';
	if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
	if (lower.includes('low') || lower.includes('minor')) return 'low';
	return 'medium'; // Default to medium if unclear
}

function normalizeSource(value: unknown): 'pagespeed' | 'consultation' | 'inferred' {
	if (typeof value !== 'string') return 'inferred';
	const lower = value.toLowerCase();
	if (lower.includes('pagespeed') || lower.includes('audit') || lower.includes('performance')) return 'pagespeed';
	if (lower.includes('consultation') || lower.includes('client') || lower.includes('meeting')) return 'consultation';
	return 'inferred';
}

function normalizePriority(value: unknown): 'essential' | 'recommended' | 'optional' {
	if (typeof value !== 'string') return 'recommended';
	const lower = value.toLowerCase();
	if (lower.includes('essential') || lower.includes('required') || lower.includes('must')) return 'essential';
	if (lower.includes('optional') || lower.includes('nice')) return 'optional';
	return 'recommended';
}

function normalizeOwner(value: unknown): 'client' | 'agency' | 'both' {
	if (typeof value !== 'string') return 'agency';
	const lower = value.toLowerCase();
	if (lower.includes('both') || lower.includes('shared')) return 'both';
	if (lower.includes('client') || lower.includes('customer')) return 'client';
	return 'agency';
}

function isValidCurrentIssue(item: unknown): item is CurrentIssue {
	if (typeof item !== 'object' || item === null) return false;
	const obj = item as Record<string, unknown>;
	if (typeof obj['title'] !== 'string' || typeof obj['description'] !== 'string') return false;
	// Normalize enum values
	obj['impact'] = normalizeImpact(obj['impact']);
	obj['source'] = normalizeSource(obj['source']);
	return true;
}

function isValidPerformanceStandard(item: unknown): item is PerformanceStandard {
	if (typeof item !== 'object' || item === null) return false;
	const obj = item as Record<string, unknown>;
	// Accept if it has at least a metric name - fill in defaults for missing fields
	const metric = obj['metric'] || obj['name'] || obj['label'];
	if (typeof metric !== 'string') return false;
	// Normalize and provide defaults
	obj['metric'] = metric;
	obj['current'] = String(obj['current'] || obj['currentValue'] || 'N/A');
	obj['target'] = String(obj['target'] || obj['targetValue'] || obj['goal'] || 'Improved');
	obj['improvement'] = String(obj['improvement'] || obj['change'] || obj['delta'] || '');
	return true;
}

function isValidProposedPage(item: unknown): item is ProposedPage {
	if (typeof item !== 'object' || item === null) return false;
	const obj = item as Record<string, unknown>;
	// Accept if it has at least a name - fill in defaults
	const name = obj['name'] || obj['title'] || obj['pageName'];
	if (typeof name !== 'string') return false;
	obj['name'] = name;
	obj['purpose'] = String(obj['purpose'] || obj['description'] || obj['details'] || '');
	obj['priority'] = normalizePriority(obj['priority']);
	return true;
}

function isValidTimelinePhase(item: unknown): item is TimelinePhase {
	if (typeof item !== 'object' || item === null) return false;
	const obj = item as Record<string, unknown>;
	// Accept if it has at least a phase name - fill in defaults
	const phase = obj['phase'] || obj['name'] || obj['title'] || obj['phaseName'];
	if (typeof phase !== 'string') return false;
	obj['phase'] = phase;
	obj['duration'] = String(obj['duration'] || obj['weeks'] || obj['time'] || '');
	obj['timing'] = String(obj['timing'] || obj['weekRange'] || obj['schedule'] || '');
	// Handle deliverables - accept string or array
	const deliverables = obj['deliverables'] || obj['tasks'] || obj['items'] || [];
	if (Array.isArray(deliverables)) {
		obj['deliverables'] = deliverables.map(String);
	} else if (typeof deliverables === 'string') {
		obj['deliverables'] = deliverables.split(',').map((s: string) => s.trim()).filter(Boolean);
	} else {
		obj['deliverables'] = [];
	}
	return true;
}

function isValidNextStep(item: unknown): item is NextStep {
	if (typeof item !== 'object' || item === null) return false;
	const obj = item as Record<string, unknown>;
	// Accept if it has at least an action - fill in defaults
	const action = obj['action'] || obj['step'] || obj['title'] || obj['name'];
	if (typeof action !== 'string') return false;
	obj['action'] = action;
	obj['description'] = String(obj['description'] || obj['details'] || obj['info'] || '');
	obj['owner'] = normalizeOwner(obj['owner'] || obj['responsibility'] || obj['assignee']);
	if (typeof obj['order'] !== 'number') {
		obj['order'] = typeof obj['order'] === 'string' ? parseInt(obj['order'], 10) || 1 : 1;
	}
	return true;
}

function isValidROIProjection(item: unknown): item is ROIProjection {
	if (typeof item !== 'object' || item === null) return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj['metric'] === 'string' &&
		typeof obj['currentEstimate'] === 'string' &&
		typeof obj['projectedEstimate'] === 'string' &&
		typeof obj['improvement'] === 'string' &&
		['low', 'medium', 'high'].includes(obj['confidence'] as string)
	);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for API calls with exponential backoff
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: { maxRetries?: number; initialDelayMs?: number } = {}
): Promise<T> {
	const maxRetries = options.maxRetries ?? 2;
	const initialDelay = options.initialDelayMs ?? 1000;
	let lastError: AIServiceError | Error | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (e) {
			lastError = e instanceof Error ? e : new Error(String(e));

			// Don't retry non-retryable errors
			if (e instanceof AIServiceError && !e.retryable) {
				throw e;
			}

			// Wait before retry (exponential backoff)
			if (attempt < maxRetries) {
				const delay = initialDelay * Math.pow(2, attempt);
				await sleep(delay);
			}
		}
	}

	throw lastError;
}

/**
 * Extract partial content from a failed response (graceful degradation)
 */
export function extractPartialContent(rawText: string): Partial<AIProposalOutput> {
	try {
		return parseAIResponse(rawText, { allowPartial: true });
	} catch {
		// Last resort: try to extract any recognisable sections
		const result: Partial<AIProposalOutput> = {};

		// Try to extract executive summary
		const summaryMatch = rawText.match(/"executiveSummary"\s*:\s*"([^"]+)"/);
		if (summaryMatch && summaryMatch[1]) {
			result.executiveSummary = summaryMatch[1];
		}

		// Try to extract closing content
		const closingMatch = rawText.match(/"closingContent"\s*:\s*"([^"]+)"/);
		if (closingMatch && closingMatch[1]) {
			result.closingContent = closingMatch[1];
		}

		return result;
	}
}

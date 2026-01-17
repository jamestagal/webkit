/**
 * Claude API Service
 *
 * Main service for interacting with Claude API for proposal generation.
 *
 * IMPORTANT: Requires @anthropic-ai/sdk package:
 * npm install @anthropic-ai/sdk
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { AIProposalOutput } from '$lib/types/ai-proposal';
import type { PromptContext } from '../prompts/prompt-builder';
import type { ProposalSection } from '../prompts/proposal-sections';
import { buildProposalPrompt } from '../prompts/prompt-builder';
import { parseAIResponse, withRetry, extractPartialContent } from './response-parser';
import { AIServiceError, AIErrorCode, fromAnthropicError } from './ai-errors';

/**
 * Default model - Claude Haiku 4.5 for speed and cost efficiency
 */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Maximum tokens for generation
 */
const MAX_TOKENS = 4096;

/**
 * Get configured Anthropic client
 */
function getClient(): Anthropic {
	const apiKey = env['ANTHROPIC_API_KEY'];
	if (!apiKey) {
		throw new AIServiceError(
			'ANTHROPIC_API_KEY environment variable is not set',
			AIErrorCode.API_KEY_MISSING,
			false
		);
	}
	return new Anthropic({ apiKey });
}

/**
 * Generation options
 */
export interface GenerateOptions {
	/** Maximum retries on failure */
	maxRetries?: number;
	/** Allow partial results if some sections fail */
	allowPartial?: boolean;
	/** Model to use (defaults to Claude Haiku 4.5) */
	model?: string;
}

/**
 * Generation result
 */
export interface GenerationResult {
	/** Generated content */
	content: AIProposalOutput;
	/** Whether this is a partial result */
	isPartial: boolean;
	/** Sections that were successfully generated */
	generatedSections: string[];
	/** Sections that failed to generate */
	failedSections: string[];
	/** Token usage stats */
	usage?: {
		inputTokens: number;
		outputTokens: number;
	};
}

/**
 * Generate proposal content using Claude
 */
export async function generateProposalContent(
	context: PromptContext,
	sections: ProposalSection[],
	options: GenerateOptions = {}
): Promise<GenerationResult> {
	const { maxRetries = 2, allowPartial = true, model = DEFAULT_MODEL } = options;

	// Build the prompt
	const { system, user } = buildProposalPrompt({ context, sections });

	// Execute with retry logic
	const result = await withRetry(
		async () => {
			const client = getClient();

			try {
				const response = await client.messages.create({
					model,
					max_tokens: MAX_TOKENS,
					system,
					messages: [{ role: 'user', content: user }]
				});

				// Extract text content
				const textBlock = response.content.find((block) => block.type === 'text');
				if (!textBlock || textBlock.type !== 'text') {
					throw new AIServiceError(
						'No text content in response',
						AIErrorCode.RESPONSE_EMPTY,
						true
					);
				}

				// Parse the response
				const content = parseAIResponse(textBlock.text, {
					allowPartial,
					requiredSections: allowPartial ? undefined : sections
				});

				// Determine which sections were generated
				const generatedSections = sections.filter(
					(s) => content[s as keyof AIProposalOutput] !== undefined
				);
				const failedSections = sections.filter(
					(s) => content[s as keyof AIProposalOutput] === undefined
				);

				return {
					content,
					isPartial: failedSections.length > 0,
					generatedSections,
					failedSections,
					usage: {
						inputTokens: response.usage?.input_tokens || 0,
						outputTokens: response.usage?.output_tokens || 0
					}
				};
			} catch (error) {
				// Handle Anthropic-specific errors
				if (error instanceof Anthropic.APIError) {
					throw fromAnthropicError(error);
				}
				throw error;
			}
		},
		{ maxRetries }
	);

	return result;
}

/**
 * Validate that context has minimum required data for generation
 */
export function validateContext(context: PromptContext): {
	valid: boolean;
	missingFields: string[];
} {
	const missingFields: string[] = [];

	if (!context.businessName || context.businessName === 'Unknown Business') {
		missingFields.push('Business Name');
	}
	if (!context.industry || context.industry === 'General') {
		missingFields.push('Industry');
	}
	if (!context.primaryChallenges || context.primaryChallenges.length === 0) {
		missingFields.push('Primary Challenges');
	}
	if (!context.primaryGoals || context.primaryGoals.length === 0) {
		missingFields.push('Primary Goals');
	}

	return {
		valid: missingFields.length === 0,
		missingFields
	};
}

/**
 * Estimate token count for context (rough approximation)
 */
export function estimateTokenCount(context: PromptContext): number {
	const { user } = buildProposalPrompt({ context, sections: [] });
	// Rough estimate: 4 characters per token
	return Math.ceil(user.length / 4);
}

/**
 * Check if context might exceed token limits
 */
export function isContextTooLarge(context: PromptContext): boolean {
	const estimated = estimateTokenCount(context);
	// Leave room for output tokens - don't use more than 80k input
	return estimated > 80000;
}

/**
 * Generate a single section (for streaming or selective regeneration)
 */
export async function generateSingleSection(
	context: PromptContext,
	section: ProposalSection,
	options: GenerateOptions = {}
): Promise<AIProposalOutput[keyof AIProposalOutput] | undefined> {
	const result = await generateProposalContent(context, [section], {
		...options,
		allowPartial: false
	});
	return result.content[section as keyof AIProposalOutput];
}

/**
 * Extract partial content from a raw response (for error recovery)
 */
export function tryExtractPartial(rawText: string): Partial<AIProposalOutput> {
	return extractPartialContent(rawText);
}

// =============================================================================
// Streaming Support
// =============================================================================

/**
 * SSE event types for streaming
 */
export type StreamEvent =
	| { type: 'chunk'; text: string }
	| { type: 'done'; content: AIProposalOutput; generatedSections: string[]; failedSections: string[] }
	| { type: 'error'; code: AIErrorCode; message: string };

/**
 * Generate proposal content with streaming.
 * Yields SSE-compatible events as content is generated.
 */
export async function* streamProposalContent(
	context: PromptContext,
	sections: ProposalSection[],
	options: GenerateOptions = {}
): AsyncGenerator<StreamEvent> {
	const { model = DEFAULT_MODEL } = options;

	// Build the prompt
	const { system, user } = buildProposalPrompt({ context, sections });

	const client = getClient();
	let fullText = '';

	try {
		const stream = client.messages.stream({
			model,
			max_tokens: MAX_TOKENS,
			system,
			messages: [{ role: 'user', content: user }]
		});

		// Yield text chunks as they arrive
		for await (const event of stream) {
			if (
				event.type === 'content_block_delta' &&
				event.delta.type === 'text_delta'
			) {
				const chunk = event.delta.text;
				fullText += chunk;
				yield { type: 'chunk', text: chunk };
			}
		}

		// DEBUG: Log raw AI response for troubleshooting
		console.log('[AI DEBUG] Raw response length:', fullText.length);
		console.log('[AI DEBUG] Raw response preview:', fullText.slice(0, 500));

		// Parse the complete response
		const content = parseAIResponse(fullText, {
			allowPartial: true,
			requiredSections: undefined
		});

		// DEBUG: Log parsed content keys
		console.log('[AI DEBUG] Parsed content keys:', Object.keys(content));
		console.log('[AI DEBUG] Parsed content sections:', {
			executiveSummary: !!content.executiveSummary,
			opportunityContent: !!content.opportunityContent,
			currentIssues: content.currentIssues?.length || 0,
			performanceStandards: content.performanceStandards?.length || 0,
			proposedPages: content.proposedPages?.length || 0,
			timeline: content.timeline?.length || 0,
			nextSteps: content.nextSteps?.length || 0,
			closingContent: !!content.closingContent
		});

		// Determine which sections were generated
		const generatedSections = sections.filter(
			(s) => content[s as keyof AIProposalOutput] !== undefined
		);
		const failedSections = sections.filter(
			(s) => content[s as keyof AIProposalOutput] === undefined
		);

		console.log('[AI DEBUG] Generated sections:', generatedSections);
		console.log('[AI DEBUG] Failed sections:', failedSections);

		yield {
			type: 'done',
			content,
			generatedSections,
			failedSections
		};
	} catch (error) {
		// Handle errors
		if (error instanceof Anthropic.APIError) {
			const aiError = fromAnthropicError(error);
			yield { type: 'error', code: aiError.code, message: aiError.message };
		} else if (error instanceof AIServiceError) {
			yield { type: 'error', code: error.code, message: error.message };
		} else {
			yield {
				type: 'error',
				code: AIErrorCode.API_TIMEOUT,
				message: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

/**
 * AI Proposal Generation Streaming Endpoint
 *
 * POST /api/proposals/[proposalId]/generate-stream
 *
 * Streams AI-generated proposal content using Server-Sent Events (SSE).
 * Returns chunks of text as they're generated, then a final parsed result.
 *
 * Request body:
 * { sections: string[] }
 *
 * SSE events:
 * - data: {"type":"chunk","text":"..."} - Text chunk
 * - data: {"type":"done","content":{...},"generatedSections":[],"failedSections":[]}
 * - data: {"type":"error","code":"...","message":"..."}
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
	proposals,
	consultations,
	agencies,
	agencyMemberships,
	type AgencyRole,
} from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { canModifyResource } from "$lib/server/permissions";
import { canGenerateWithAI, incrementAIGenerationCount } from "$lib/server/subscription";
import { streamProposalContent, validateContext } from "$lib/server/services/claude.service";
import {
	buildContextFromProposal,
	type PerformanceDataContext,
} from "$lib/server/prompts/prompt-builder";
import { ALL_SECTIONS, type ProposalSection } from "$lib/server/prompts/proposal-sections";
import { AIServiceError, AIErrorCode } from "$lib/server/services/ai-errors";
import { logActivity } from "$lib/server/db-helpers";

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { proposalId } = params;

	// Check authentication
	const userId = locals.user?.id;
	if (!userId) {
		return json({ error: "Not authenticated" }, { status: 401 });
	}

	// Parse request body
	let sections: string[];
	try {
		const body = await request.json();
		sections = body.sections;

		if (!Array.isArray(sections) || sections.length === 0) {
			return json({ error: "sections array required" }, { status: 400 });
		}

		// Validate sections are valid
		const invalidSections = sections.filter((s) => !ALL_SECTIONS.includes(s as ProposalSection));
		if (invalidSections.length > 0) {
			return json({ error: `Invalid sections: ${invalidSections.join(", ")}` }, { status: 400 });
		}
	} catch {
		return json({ error: "Invalid JSON body" }, { status: 400 });
	}

	// Get proposal
	const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);

	if (!proposal) {
		return json({ error: "Proposal not found" }, { status: 404 });
	}

	// Check user has access to this agency
	const [membership] = await db
		.select({
			role: agencyMemberships.role,
		})
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.userId, userId),
				eq(agencyMemberships.agencyId, proposal.agencyId),
				eq(agencyMemberships.status, "active"),
			),
		)
		.limit(1);

	if (!membership) {
		return json({ error: "Access denied" }, { status: 403 });
	}

	// Check modify permission
	if (
		!canModifyResource(membership.role as AgencyRole, proposal.createdBy || "", userId, "proposal")
	) {
		return json({ error: "Permission denied" }, { status: 403 });
	}

	// Check rate limit
	const rateLimitResult = await canGenerateWithAI(proposal.agencyId);
	if (!rateLimitResult.allowed) {
		return json(
			{
				error: "Rate limit exceeded",
				code: AIErrorCode.RATE_LIMIT_EXCEEDED,
				current: rateLimitResult.current,
				limit: rateLimitResult.limit,
				resetsAt: rateLimitResult.resetsAt.toISOString(),
			},
			{ status: 429 },
		);
	}

	// Get consultation if linked (for additional context)
	let consultation = null;
	if (proposal.consultationId) {
		const [c] = await db
			.select()
			.from(consultations)
			.where(eq(consultations.id, proposal.consultationId))
			.limit(1);
		consultation = c || null;
	}

	// Get agency for branding context
	const [agency] = await db
		.select({ name: agencies.name })
		.from(agencies)
		.where(eq(agencies.id, proposal.agencyId))
		.limit(1);

	if (!agency) {
		return json({ error: "Agency not found" }, { status: 404 });
	}

	// Build prompt context
	const agencyContext = {
		businessName: agency.name,
		brandVoice: null as string | null,
		usps: null as string[] | null,
	};

	// Use fresh consultation performanceData if available, fall back to proposal's cached copy
	const performanceData = (consultation?.performanceData ||
		proposal.performanceData) as PerformanceDataContext | null;

	const promptContext = buildContextFromProposal(
		{
			clientBusinessName: proposal.clientBusinessName,
			clientContactName: proposal.clientContactName,
			clientWebsite: proposal.clientWebsite,
			consultationChallenges: proposal.consultationChallenges as string[] | null,
			consultationGoals: proposal.consultationGoals as {
				primary_goals?: string[];
				conversion_goal?: string;
				budget_range?: string;
			} | null,
			consultationPainPoints: proposal.consultationPainPoints as {
				urgency_level?: string;
			} | null,
			performanceData,
		},
		consultation
			? {
					industry: consultation.industry,
					businessType: consultation.businessType,
					websiteStatus: consultation.websiteStatus,
					timeline: consultation.timeline,
					designStyles: consultation.designStyles,
					admiredWebsites: consultation.admiredWebsites,
					consultationNotes: consultation.consultationNotes,
				}
			: null,
		agencyContext,
	);

	// Validate context
	const validation = validateContext(promptContext);
	if (!validation.valid) {
		return json(
			{
				error: `Missing required fields: ${validation.missingFields.join(", ")}`,
				code: AIErrorCode.CONTEXT_INSUFFICIENT,
				missingFields: validation.missingFields,
			},
			{ status: 400 },
		);
	}

	// Create SSE stream
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: unknown) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			};

			try {
				// Stream from Claude
				for await (const event of streamProposalContent(
					promptContext,
					sections as ProposalSection[],
				)) {
					// On successful completion, transform content for frontend (but DON'T save to DB)
					// Content is only saved when user explicitly clicks "Apply" then "Save"
					if (event.type === "done") {
						const content = event.content;

						// Transform AI output to DB-compatible format for frontend
						// This transformed content will be applied to formData when user clicks Apply
						const transformed: Record<string, unknown> = {};

						if (content.executiveSummary) {
							transformed["executiveSummary"] = content.executiveSummary;
						}
						if (content.opportunityContent) {
							transformed["opportunityContent"] = content.opportunityContent;
						}
						if (content.currentIssues && content.currentIssues.length > 0) {
							transformed["currentIssues"] = content.currentIssues.map((issue) => ({
								text: `${issue.title}: ${issue.description}`,
								checked: false,
							}));
						}
						if (content.performanceStandards && content.performanceStandards.length > 0) {
							transformed["performanceStandards"] = content.performanceStandards.map((std) => ({
								label: std.metric,
								value: `${std.current} → ${std.target}`,
								icon: undefined,
							}));
						}
						if (content.proposedPages && content.proposedPages.length > 0) {
							transformed["proposedPages"] = content.proposedPages.map((page) => ({
								name: page.name,
								description: page.purpose,
								features: page.features || [],
							}));
						}
						if (content.timeline && content.timeline.length > 0) {
							transformed["timeline"] = content.timeline.map((phase) => ({
								week: phase.timing,
								title: phase.phase,
								description: phase.deliverables.join(", "),
							}));
						}
						if (content.nextSteps && content.nextSteps.length > 0) {
							transformed["nextSteps"] = content.nextSteps.map((step) => ({
								text: `${step.action}: ${step.description}`,
								completed: false,
							}));
						}
						if (content.closingContent) {
							transformed["closingContent"] = content.closingContent;
						}

						// Send modified done event with transformed content
						// The original event.content has raw AI format, transformed has DB format
						// Also include fresh performanceData so it can be synced to the proposal
						sendEvent({
							type: "done",
							content: event.content,
							transformed,
							generatedSections: event.generatedSections,
							failedSections: event.failedSections,
							performanceData: performanceData || null,
						});

						// Increment rate limit counter (generation counts even if not saved)
						await incrementAIGenerationCount(proposal.agencyId);

						// Log activity
						await logActivity("proposal.ai_generated", "proposal", proposalId, {
							metadata: {
								sections,
								generatedSections: event.generatedSections,
								failedSections: event.failedSections,
								streaming: true,
								autoSaved: false,
							},
						});
					} else {
						// For chunk events, send as-is
						sendEvent(event);
					}
				}
			} catch (err) {
				// Send error event
				const errorEvent = {
					type: "error",
					code: err instanceof AIServiceError ? err.code : AIErrorCode.UNKNOWN,
					message: err instanceof Error ? err.message : "Unknown error",
				};
				sendEvent(errorEvent);
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
};

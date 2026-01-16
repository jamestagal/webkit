/**
 * Proposals Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for proposal operations.
 * Handles CRUD for client proposals with support for consultation linking,
 * package selection, and public sharing.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import {
	proposals,
	agencyProfiles,
	agencyPackages,
	agencyAddons,
	consultations,
	contracts,
	users,
	agencyMemberships
} from '$lib/server/schema';
import { getAgencyContext } from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import {
	hasPermission,
	canAccessResource,
	canModifyResource,
	canDeleteResource
} from '$lib/server/permissions';
import { dataPipelineService } from '$lib/server/services/data-pipeline.service';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// =============================================================================
// Validation Schemas
// =============================================================================

const ChecklistItemSchema = v.object({
	text: v.string(),
	checked: v.boolean()
});

const PerformanceDataSchema = v.object({
	performance: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
	accessibility: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
	bestPractices: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
	seo: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
	loadTime: v.optional(v.string()),
	issues: v.optional(v.array(v.string()))
});

const RoiAnalysisSchema = v.object({
	currentVisitors: v.optional(v.number()),
	projectedVisitors: v.optional(v.number()),
	conversionRate: v.optional(v.number()),
	projectedLeads: v.optional(v.number()),
	averageProjectValue: v.optional(v.number()),
	projectedRevenue: v.optional(v.number())
});

const PerformanceStandardSchema = v.object({
	label: v.string(),
	value: v.string(),
	icon: v.optional(v.string())
});

const ProposedPageSchema = v.object({
	name: v.string(),
	description: v.optional(v.string()),
	features: v.optional(v.array(v.string()))
});

const TimelinePhaseSchema = v.object({
	week: v.string(),
	title: v.string(),
	description: v.string()
});

const CustomPricingSchema = v.object({
	setupFee: v.optional(v.string()),
	monthlyPrice: v.optional(v.string()),
	oneTimePrice: v.optional(v.string()),
	hostingFee: v.optional(v.string()),
	discountPercent: v.optional(v.number()),
	discountNote: v.optional(v.string())
});

// Next Step Item Schema (for editable checklist) - PART 2: Proposal Improvements
const NextStepItemSchema = v.object({
	text: v.string(),
	completed: v.boolean()
});

const CreateProposalSchema = v.object({
	consultationId: v.optional(v.pipe(v.string(), v.uuid())),
	selectedPackageId: v.optional(v.pipe(v.string(), v.uuid())),
	title: v.optional(v.string())
});

const UpdateProposalSchema = v.object({
	proposalId: v.pipe(v.string(), v.uuid()),

	// Client info
	clientBusinessName: v.optional(v.string()),
	clientContactName: v.optional(v.string()),
	clientEmail: v.optional(v.pipe(v.string(), v.email())),
	clientPhone: v.optional(v.string()),
	clientWebsite: v.optional(v.string()),

	// Cover
	title: v.optional(v.string()),
	coverImage: v.optional(v.nullable(v.string())),

	// Performance Analysis
	performanceData: v.optional(PerformanceDataSchema),

	// Content sections
	opportunityContent: v.optional(v.string()),
	currentIssues: v.optional(v.array(ChecklistItemSchema)),
	complianceIssues: v.optional(v.array(ChecklistItemSchema)),
	roiAnalysis: v.optional(RoiAnalysisSchema),
	performanceStandards: v.optional(v.array(PerformanceStandardSchema)),
	localAdvantageContent: v.optional(v.string()),
	proposedPages: v.optional(v.array(ProposedPageSchema)),
	timeline: v.optional(v.array(TimelinePhaseSchema)),
	closingContent: v.optional(v.string()),

	// New content sections (PART 2: Proposal Improvements)
	executiveSummary: v.optional(v.string()),
	nextSteps: v.optional(v.array(NextStepItemSchema)),

	// Package selection
	selectedPackageId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
	selectedAddons: v.optional(v.array(v.pipe(v.string(), v.uuid()))),
	customPricing: v.optional(v.nullable(CustomPricingSchema)),

	// Validity
	validUntil: v.optional(v.nullable(v.string()))
});

const ProposalStatusSchema = v.picklist([
	'draft',
	'sent',
	'viewed',
	'accepted',
	'declined',
	'revision_requested',
	'expired'
]);

// =============================================================================
// Public Response Schemas (PART 2: Proposal Improvements)
// =============================================================================

const AcceptProposalSchema = v.object({
	slug: v.pipe(v.string(), v.minLength(1)),
	comments: v.optional(v.pipe(v.string(), v.maxLength(2000)))
});

const DeclineProposalSchema = v.object({
	slug: v.pipe(v.string(), v.minLength(1)),
	reason: v.optional(v.pipe(v.string(), v.maxLength(2000)))
});

const RequestRevisionSchema = v.object({
	slug: v.pipe(v.string(), v.minLength(1)),
	notes: v.pipe(v.string(), v.minLength(10), v.maxLength(2000))
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique public slug for the proposal.
 * Uses nanoid for cryptographically random slugs.
 */
async function generateUniqueSlug(): Promise<string> {
	let slug = nanoid(12);
	let attempts = 0;

	while (attempts < 10) {
		const [existing] = await db
			.select({ id: proposals.id })
			.from(proposals)
			.where(eq(proposals.slug, slug))
			.limit(1);

		if (!existing) return slug;

		slug = nanoid(12);
		attempts++;
	}

	throw new Error('Unable to generate unique slug');
}

/**
 * Get the next proposal number and increment it.
 */
async function getNextProposalNumber(agencyId: string): Promise<string> {
	// Get or create profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, agencyId))
		.limit(1);

	const prefix = profile?.proposalPrefix || 'PROP';
	const nextNumber = profile?.nextProposalNumber || 1;

	// Generate document number
	const proposalNumber = dataPipelineService.generateDocumentNumber(prefix, nextNumber);

	// Increment next number
	if (profile) {
		await db
			.update(agencyProfiles)
			.set({
				nextProposalNumber: nextNumber + 1,
				updatedAt: new Date()
			})
			.where(eq(agencyProfiles.id, profile.id));
	}

	return proposalNumber;
}

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all proposals for the current agency.
 * All roles can view all proposals (edit/delete restricted by ownership).
 */
export const getProposals = query(
	v.optional(
		v.object({
			status: v.optional(ProposalStatusSchema),
			limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
			offset: v.optional(v.pipe(v.number(), v.minValue(0)))
		})
	),
	async (filters) => {
		const context = await getAgencyContext();
		const { status, limit = 50, offset = 0 } = filters || {};

		// Build where conditions
		const conditions = [eq(proposals.agencyId, context.agencyId)];

		// Add status filter if provided
		if (status) {
			conditions.push(eq(proposals.status, status));
		}

		// All roles can view all agency proposals (edit/delete still restricted by ownership)

		const results = await db
			.select({
				id: proposals.id,
				agencyId: proposals.agencyId,
				consultationId: proposals.consultationId,
				selectedPackageId: proposals.selectedPackageId,
				selectedAddons: proposals.selectedAddons,
				proposalNumber: proposals.proposalNumber,
				slug: proposals.slug,
				title: proposals.title,
				clientBusinessName: proposals.clientBusinessName,
				clientContactName: proposals.clientContactName,
				clientEmail: proposals.clientEmail,
				clientPhone: proposals.clientPhone,
				executiveSummary: proposals.executiveSummary,
				customPricing: proposals.customPricing,
				validUntil: proposals.validUntil,
				status: proposals.status,
				sentAt: proposals.sentAt,
				viewCount: proposals.viewCount,
				createdBy: proposals.createdBy,
				createdAt: proposals.createdAt,
				updatedAt: proposals.updatedAt,
				// Join to get creator name
				creatorName: sql<string | null>`COALESCE(${agencyMemberships.displayName}, ${users.email})`.as('creator_name')
			})
			.from(proposals)
			.leftJoin(users, eq(proposals.createdBy, users.id))
			.leftJoin(
				agencyMemberships,
				and(
					eq(proposals.createdBy, agencyMemberships.userId),
					eq(proposals.agencyId, agencyMemberships.agencyId)
				)
			)
			.where(and(...conditions))
			.orderBy(desc(proposals.createdAt))
			.limit(limit)
			.offset(offset);

		return results;
	}
);

/**
 * Get a single proposal by ID.
 */
export const getProposal = query(v.pipe(v.string(), v.uuid()), async (proposalId: string) => {
	const context = await getAgencyContext();

	const [proposal] = await db
		.select()
		.from(proposals)
		.where(and(eq(proposals.id, proposalId), eq(proposals.agencyId, context.agencyId)))
		.limit(1);

	if (!proposal) {
		throw new Error('Proposal not found');
	}

	// Check access permission
	if (
		!canAccessResource(context.role, proposal.createdBy || '', context.userId, 'proposal')
	) {
		throw new Error('Permission denied');
	}

	return proposal;
});

/**
 * Get a proposal by public slug (for public view).
 * No authentication required.
 */
export const getProposalBySlug = query(
	v.pipe(v.string(), v.minLength(1)),
	async (slug: string) => {
		const [proposal] = await db
			.select()
			.from(proposals)
			.where(eq(proposals.slug, slug))
			.limit(1);

		if (!proposal) {
			return null;
		}

		// Check if expired
		if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
			// Still return but with expired status
			return { ...proposal, status: 'expired' as const };
		}

		return proposal;
	}
);

/**
 * Get proposal with related data (package, addons, consultation).
 */
export const getProposalWithRelations = query(
	v.pipe(v.string(), v.uuid()),
	async (proposalId: string) => {
		const context = await getAgencyContext();

		const [proposal] = await db
			.select()
			.from(proposals)
			.where(and(eq(proposals.id, proposalId), eq(proposals.agencyId, context.agencyId)))
			.limit(1);

		if (!proposal) {
			throw new Error('Proposal not found');
		}

		// Check access permission
		if (
			!canAccessResource(context.role, proposal.createdBy || '', context.userId, 'proposal')
		) {
			throw new Error('Permission denied');
		}

		// Fetch related data
		let selectedPackage = null;
		if (proposal.selectedPackageId) {
			const [pkg] = await db
				.select()
				.from(agencyPackages)
				.where(eq(agencyPackages.id, proposal.selectedPackageId))
				.limit(1);
			selectedPackage = pkg || null;
		}

		// Fetch selected addons
		const addonIds = (proposal.selectedAddons as string[]) || [];
		let selectedAddons: (typeof agencyAddons.$inferSelect)[] = [];
		if (addonIds.length > 0) {
			selectedAddons = await db
				.select()
				.from(agencyAddons)
				.where(
					and(
						eq(agencyAddons.agencyId, context.agencyId),
						sql`${agencyAddons.id} = ANY(${addonIds})`
					)
				);
		}

		// Fetch consultation if linked
		let consultation = null;
		if (proposal.consultationId) {
			const [c] = await db
				.select()
				.from(consultations)
				.where(eq(consultations.id, proposal.consultationId))
				.limit(1);
			consultation = c || null;
		}

		return {
			proposal,
			selectedPackage,
			selectedAddons,
			consultation
		};
	}
);

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Create a new proposal.
 * Can optionally link to a consultation to pre-fill client data.
 */
export const createProposal = command(CreateProposalSchema, async (data) => {
	const context = await getAgencyContext();

	// Generate proposal number
	const proposalNumber = await getNextProposalNumber(context.agencyId);

	// Generate unique slug
	const slug = await generateUniqueSlug();

	// Pre-fill client data and cache consultation insights if provided
	let clientData: Partial<typeof proposals.$inferInsert> = {};
	if (data.consultationId) {
		const [consultation] = await db
			.select()
			.from(consultations)
			.where(
				and(
					eq(consultations.id, data.consultationId),
					eq(consultations.agencyId, context.agencyId)
				)
			)
			.limit(1);

		if (consultation) {
			// v2 flat columns - extract client data directly
			clientData = {
				clientBusinessName: consultation.businessName || '',
				clientContactName: consultation.contactPerson || '',
				clientEmail: consultation.email || '',
				clientPhone: consultation.phone || '',
				clientWebsite: consultation.website || '',
				// Cache consultation insights for display in proposal editor (PART 2)
				consultationPainPoints: {
					primary_challenges: consultation.primaryChallenges || [],
					urgency_level: consultation.urgencyLevel || ''
				},
				consultationGoals: {
					primary_goals: consultation.primaryGoals || [],
					conversion_goal: consultation.conversionGoal || '',
					budget_range: consultation.budgetRange || ''
				},
				consultationChallenges: consultation.primaryChallenges || []
			};
		}
	}

	// Create proposal
	const [proposal] = await db
		.insert(proposals)
		.values({
			agencyId: context.agencyId,
			consultationId: data.consultationId,
			proposalNumber,
			slug,
			title: data.title || 'Website Proposal',
			selectedPackageId: data.selectedPackageId,
			createdBy: context.userId,
			...clientData
		})
		.returning();

	// Log activity
	await logActivity('proposal.created', 'proposal', proposal?.id, {
		newValues: {
			proposalNumber,
			consultationId: data.consultationId,
			selectedPackageId: data.selectedPackageId
		}
	});

	return proposal;
});

/**
 * Update a proposal.
 */
export const updateProposal = command(UpdateProposalSchema, async (data) => {
	const context = await getAgencyContext();

	// Verify proposal exists and belongs to agency
	const [existing] = await db
		.select()
		.from(proposals)
		.where(
			and(eq(proposals.id, data.proposalId), eq(proposals.agencyId, context.agencyId))
		)
		.limit(1);

	if (!existing) {
		throw new Error('Proposal not found');
	}

	// Check modify permission
	if (!canModifyResource(context.role, existing.createdBy || '', context.userId, 'proposal')) {
		throw new Error('Permission denied');
	}

	// Build update object
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	// Client info
	if (data.clientBusinessName !== undefined) updates['clientBusinessName'] = data.clientBusinessName;
	if (data.clientContactName !== undefined) updates['clientContactName'] = data.clientContactName;
	if (data.clientEmail !== undefined) updates['clientEmail'] = data.clientEmail;
	if (data.clientPhone !== undefined) updates['clientPhone'] = data.clientPhone;
	if (data.clientWebsite !== undefined) updates['clientWebsite'] = data.clientWebsite;

	// Cover
	if (data.title !== undefined) updates['title'] = data.title;
	if (data.coverImage !== undefined) updates['coverImage'] = data.coverImage;

	// Content sections
	if (data.performanceData !== undefined) updates['performanceData'] = data.performanceData;
	if (data.opportunityContent !== undefined) updates['opportunityContent'] = data.opportunityContent;
	if (data.currentIssues !== undefined) updates['currentIssues'] = data.currentIssues;
	if (data.complianceIssues !== undefined) updates['complianceIssues'] = data.complianceIssues;
	if (data.roiAnalysis !== undefined) updates['roiAnalysis'] = data.roiAnalysis;
	if (data.performanceStandards !== undefined)
		updates['performanceStandards'] = data.performanceStandards;
	if (data.localAdvantageContent !== undefined)
		updates['localAdvantageContent'] = data.localAdvantageContent;
	if (data.proposedPages !== undefined) updates['proposedPages'] = data.proposedPages;
	if (data.timeline !== undefined) updates['timeline'] = data.timeline;
	if (data.closingContent !== undefined) updates['closingContent'] = data.closingContent;

	// New content sections (PART 2: Proposal Improvements)
	if (data.executiveSummary !== undefined) updates['executiveSummary'] = data.executiveSummary;
	if (data.nextSteps !== undefined) updates['nextSteps'] = data.nextSteps;

	// Package selection
	if (data.selectedPackageId !== undefined) updates['selectedPackageId'] = data.selectedPackageId;
	if (data.selectedAddons !== undefined) updates['selectedAddons'] = data.selectedAddons;
	if (data.customPricing !== undefined) updates['customPricing'] = data.customPricing;

	// Validity
	if (data.validUntil !== undefined) {
		updates['validUntil'] = data.validUntil ? new Date(data.validUntil) : null;
	}

	const [proposal] = await db
		.update(proposals)
		.set(updates)
		.where(eq(proposals.id, data.proposalId))
		.returning();

	// Log activity
	await logActivity('proposal.updated', 'proposal', data.proposalId, {
		oldValues: { title: existing.title },
		newValues: updates
	});

	return proposal;
});

/**
 * Delete a proposal.
 */
export const deleteProposal = command(
	v.pipe(v.string(), v.uuid()),
	async (proposalId: string) => {
		const context = await getAgencyContext();

		// Verify proposal exists and belongs to agency
		const [existing] = await db
			.select()
			.from(proposals)
			.where(and(eq(proposals.id, proposalId), eq(proposals.agencyId, context.agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error('Proposal not found');
		}

		// Check delete permission
		if (!canDeleteResource(context.role, existing.createdBy || '', context.userId, 'proposal')) {
			throw new Error('Permission denied');
		}

		// Delete proposal
		await db.delete(proposals).where(eq(proposals.id, proposalId));

		// Log activity
		await logActivity('proposal.deleted', 'proposal', proposalId, {
			oldValues: { proposalNumber: existing.proposalNumber, title: existing.title }
		});
	}
);

/**
 * Duplicate a proposal.
 */
export const duplicateProposal = command(
	v.pipe(v.string(), v.uuid()),
	async (proposalId: string) => {
		const context = await getAgencyContext();

		// Get existing proposal
		const [existing] = await db
			.select()
			.from(proposals)
			.where(and(eq(proposals.id, proposalId), eq(proposals.agencyId, context.agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error('Proposal not found');
		}

		// Check access permission
		if (
			!canAccessResource(context.role, existing.createdBy || '', context.userId, 'proposal')
		) {
			throw new Error('Permission denied');
		}

		// Generate new number and slug
		const proposalNumber = await getNextProposalNumber(context.agencyId);
		const slug = await generateUniqueSlug();

		// Create duplicate
		const [proposal] = await db
			.insert(proposals)
			.values({
				agencyId: context.agencyId,
				consultationId: existing.consultationId,
				proposalNumber,
				slug,
				status: 'draft',
				clientBusinessName: existing.clientBusinessName,
				clientContactName: existing.clientContactName,
				clientEmail: existing.clientEmail,
				clientPhone: existing.clientPhone,
				clientWebsite: existing.clientWebsite,
				title: `${existing.title} (Copy)`,
				coverImage: existing.coverImage,
				performanceData: existing.performanceData,
				opportunityContent: existing.opportunityContent,
				currentIssues: existing.currentIssues,
				complianceIssues: existing.complianceIssues,
				roiAnalysis: existing.roiAnalysis,
				performanceStandards: existing.performanceStandards,
				localAdvantageContent: existing.localAdvantageContent,
				proposedPages: existing.proposedPages,
				timeline: existing.timeline,
				closingContent: existing.closingContent,
				selectedPackageId: existing.selectedPackageId,
				selectedAddons: existing.selectedAddons,
				customPricing: existing.customPricing,
				createdBy: context.userId
			})
			.returning();

		// Log activity
		await logActivity('proposal.duplicated', 'proposal', proposal?.id, {
			metadata: { sourceProposalId: proposalId }
		});

		return proposal;
	}
);

/**
 * Mark a proposal as ready (intermediate step before sending).
 */
export const markProposalReady = command(v.pipe(v.string(), v.uuid()), async (proposalId: string) => {
	const context = await getAgencyContext();

	// Verify proposal exists and belongs to agency
	const [existing] = await db
		.select()
		.from(proposals)
		.where(and(eq(proposals.id, proposalId), eq(proposals.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error('Proposal not found');
	}

	// Check modify permission
	if (!canModifyResource(context.role, existing.createdBy || '', context.userId, 'proposal')) {
		throw new Error('Permission denied');
	}

	// Only draft proposals can be marked as ready
	if (existing.status !== 'draft') {
		throw new Error('Only draft proposals can be marked as ready');
	}

	// Update status to ready
	const [proposal] = await db
		.update(proposals)
		.set({
			status: 'ready',
			updatedAt: new Date()
		})
		.where(eq(proposals.id, proposalId))
		.returning();

	// Log activity
	await logActivity('proposal.ready', 'proposal', proposalId, {
		newValues: { status: 'ready' }
	});

	return proposal;
});

/**
 * Send a proposal (mark as sent).
 */
export const sendProposal = command(v.pipe(v.string(), v.uuid()), async (proposalId: string) => {
	const context = await getAgencyContext();

	// Verify proposal exists and belongs to agency
	const [existing] = await db
		.select()
		.from(proposals)
		.where(and(eq(proposals.id, proposalId), eq(proposals.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error('Proposal not found');
	}

	// Check modify permission
	if (!canModifyResource(context.role, existing.createdBy || '', context.userId, 'proposal')) {
		throw new Error('Permission denied');
	}

	// Update status to sent
	const [proposal] = await db
		.update(proposals)
		.set({
			status: 'sent',
			sentAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(proposals.id, proposalId))
		.returning();

	// Log activity
	await logActivity('proposal.sent', 'proposal', proposalId, {
		newValues: { status: 'sent', sentAt: new Date().toISOString() }
	});

	return proposal;
});

/**
 * Record a proposal view (public, no auth required).
 * Fire-and-forget - doesn't need to return anything meaningful.
 */
export const recordProposalView = command(
	v.pipe(v.string(), v.minLength(1)),
	async (slug: string) => {
		// Find proposal by slug
		const [proposal] = await db
			.select({ id: proposals.id, status: proposals.status })
			.from(proposals)
			.where(eq(proposals.slug, slug))
			.limit(1);

		if (!proposal) {
			return; // Silently ignore if not found
		}

		// Update view count and potentially status
		const updates: Record<string, unknown> = {
			viewCount: sql`${proposals.viewCount} + 1`,
			lastViewedAt: new Date()
		};

		// If status is 'sent', change to 'viewed'
		if (proposal.status === 'sent') {
			updates['status'] = 'viewed';
		}

		await db.update(proposals).set(updates).where(eq(proposals.id, proposal.id));
	}
);

/**
 * Update proposal status.
 */
export const updateProposalStatus = command(
	v.object({
		proposalId: v.pipe(v.string(), v.uuid()),
		status: ProposalStatusSchema
	}),
	async (data) => {
		const context = await getAgencyContext();

		// Verify proposal exists and belongs to agency
		const [existing] = await db
			.select()
			.from(proposals)
			.where(and(eq(proposals.id, data.proposalId), eq(proposals.agencyId, context.agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error('Proposal not found');
		}

		// Check modify permission
		if (!canModifyResource(context.role, existing.createdBy || '', context.userId, 'proposal')) {
			throw new Error('Permission denied');
		}

		// Update status with timestamp
		const updates: Record<string, unknown> = {
			status: data.status,
			updatedAt: new Date()
		};

		if (data.status === 'accepted') {
			updates['acceptedAt'] = new Date();
		} else if (data.status === 'declined') {
			updates['declinedAt'] = new Date();
		}

		const [proposal] = await db
			.update(proposals)
			.set(updates)
			.where(eq(proposals.id, data.proposalId))
			.returning();

		// Log activity
		await logActivity('proposal.status_changed', 'proposal', data.proposalId, {
			oldValues: { status: existing.status },
			newValues: { status: data.status }
		});

		return proposal;
	}
);

// =============================================================================
// Public Response Commands (PART 2: Proposal Improvements)
// No authentication required - operates by slug
// =============================================================================

/**
 * Generate a unique contract slug.
 */
async function generateUniqueContractSlug(): Promise<string> {
	let slug = nanoid(12);
	let attempts = 0;

	while (attempts < 10) {
		const [existing] = await db
			.select({ id: contracts.id })
			.from(contracts)
			.where(eq(contracts.slug, slug))
			.limit(1);

		if (!existing) return slug;

		slug = nanoid(12);
		attempts++;
	}

	throw new Error('Unable to generate unique contract slug');
}

/**
 * Get the next contract number for an agency.
 */
async function getNextContractNumber(agencyId: string): Promise<string> {
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, agencyId))
		.limit(1);

	const prefix = profile?.contractPrefix || 'CON';
	const nextNumber = profile?.nextContractNumber || 1;

	// Generate document number
	const contractNumber = dataPipelineService.generateDocumentNumber(prefix, nextNumber);

	// Increment next number
	if (profile) {
		await db
			.update(agencyProfiles)
			.set({
				nextContractNumber: nextNumber + 1,
				updatedAt: new Date()
			})
			.where(eq(agencyProfiles.id, profile.id));
	}

	return contractNumber;
}

/**
 * Client accepts a proposal with optional comments.
 * Creates a draft contract automatically.
 * Public command - no authentication required.
 */
export const acceptProposal = command(AcceptProposalSchema, async (data) => {
	// Find proposal by slug
	const [proposal] = await db
		.select()
		.from(proposals)
		.where(eq(proposals.slug, data.slug))
		.limit(1);

	if (!proposal) {
		throw new Error('Proposal not found');
	}

	// Validate status - only sent or viewed proposals can be accepted
	if (proposal.status !== 'sent' && proposal.status !== 'viewed') {
		throw new Error('Proposal cannot be accepted');
	}

	// Update proposal status
	await db
		.update(proposals)
		.set({
			status: 'accepted',
			acceptedAt: new Date(),
			clientComments: data.comments || '',
			updatedAt: new Date()
		})
		.where(eq(proposals.id, proposal.id));

	// Auto-create draft contract from proposal
	let contractSlug: string | undefined;
	try {
		const contractNumber = await getNextContractNumber(proposal.agencyId);
		contractSlug = await generateUniqueContractSlug();

		// Calculate total price from custom pricing or package
		let totalPrice = '0';
		const customPricing = proposal.customPricing as {
			setupFee?: string;
			monthlyPrice?: string;
			oneTimePrice?: string;
		} | null;

		if (customPricing?.setupFee) {
			totalPrice = customPricing.setupFee;
		} else if (customPricing?.oneTimePrice) {
			totalPrice = customPricing.oneTimePrice;
		}

		await db.insert(contracts).values({
			agencyId: proposal.agencyId,
			proposalId: proposal.id,
			contractNumber,
			slug: contractSlug,
			status: 'draft',
			clientBusinessName: proposal.clientBusinessName,
			clientContactName: proposal.clientContactName,
			clientEmail: proposal.clientEmail,
			clientPhone: proposal.clientPhone,
			totalPrice,
			createdBy: proposal.createdBy
		});
	} catch (err) {
		// Log error but don't fail the accept - contract can be created manually
		console.error('Failed to auto-create contract:', err);
	}

	return { success: true, contractSlug };
});

/**
 * Client declines a proposal with optional reason.
 * Public command - no authentication required.
 */
export const declineProposal = command(DeclineProposalSchema, async (data) => {
	// Find proposal by slug
	const [proposal] = await db
		.select()
		.from(proposals)
		.where(eq(proposals.slug, data.slug))
		.limit(1);

	if (!proposal) {
		throw new Error('Proposal not found');
	}

	// Validate status - only sent or viewed proposals can be declined
	if (proposal.status !== 'sent' && proposal.status !== 'viewed') {
		throw new Error('Proposal cannot be declined');
	}

	// Update proposal status
	await db
		.update(proposals)
		.set({
			status: 'declined',
			declinedAt: new Date(),
			declineReason: data.reason || '',
			updatedAt: new Date()
		})
		.where(eq(proposals.id, proposal.id));

	return { success: true };
});

/**
 * Client requests revisions to a proposal with required notes.
 * Public command - no authentication required.
 */
export const requestProposalRevision = command(RequestRevisionSchema, async (data) => {
	// Find proposal by slug
	const [proposal] = await db
		.select()
		.from(proposals)
		.where(eq(proposals.slug, data.slug))
		.limit(1);

	if (!proposal) {
		throw new Error('Proposal not found');
	}

	// Validate status - only sent or viewed proposals can request revision
	if (proposal.status !== 'sent' && proposal.status !== 'viewed') {
		throw new Error('Proposal cannot request revision');
	}

	// Update proposal status
	await db
		.update(proposals)
		.set({
			status: 'revision_requested',
			revisionRequestedAt: new Date(),
			revisionRequestNotes: data.notes,
			updatedAt: new Date()
		})
		.where(eq(proposals.id, proposal.id));

	return { success: true };
});


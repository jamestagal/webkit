/**
 * Contracts Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for contract operations.
 * Handles contract generation from proposals, client signing, and status tracking.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	contracts,
	contractTemplates,
	contractSchedules,
	proposals,
	consultations,
	agencies,
	agencyProfiles,
	agencyPackages,
	agencyAddons,
	users,
	agencyMemberships,
	type SignatureConfig,
} from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { getOrCreateClient } from "$lib/api/clients.remote";
import { logActivity } from "$lib/server/db-helpers";
import { sendContractEmailToClient, sendContractSignedEmails } from "$lib/server/contract-emails";
import {
	hasPermission,
	canAccessResource,
	canModifyResource,
	canDeleteResource,
} from "$lib/server/permissions";
import {
	dataPipelineService,
	type MergeFieldData,
} from "$lib/server/services/data-pipeline.service";
import { sanitizeHtml } from "$lib/utils/sanitize";
import { formatCurrency, formatDate } from "$lib/utils/formatting";
import { getNextDocumentNumber } from "$lib/server/document-numbers";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

// =============================================================================
// Validation Schemas
// =============================================================================

const ContractStatusSchema = v.picklist([
	"draft",
	"sent",
	"viewed",
	"signed",
	"completed",
	"expired",
	"terminated",
]);

const CreateContractSchema = v.object({
	proposalId: v.pipe(v.string(), v.uuid()),
	templateId: v.optional(v.pipe(v.string(), v.uuid())),
});

const UpdateContractSchema = v.object({
	contractId: v.pipe(v.string(), v.uuid()),

	// Client info (editable before sending)
	clientBusinessName: v.optional(v.string()),
	clientContactName: v.optional(v.string()),
	clientEmail: v.optional(v.pipe(v.string(), v.email())),
	clientPhone: v.optional(v.string()),
	clientAddress: v.optional(v.string()),

	// Contract-specific fields
	servicesDescription: v.optional(v.string()),
	commencementDate: v.optional(v.nullable(v.string())),
	completionDate: v.optional(v.nullable(v.string())),
	specialConditions: v.optional(v.string()),

	// Pricing
	totalPrice: v.optional(v.string()),
	priceIncludesGst: v.optional(v.boolean()),
	paymentTerms: v.optional(v.string()),

	// Validity
	validUntil: v.optional(v.nullable(v.string())),

	// Agency signature
	agencySignatoryName: v.optional(v.string()),
	agencySignatoryTitle: v.optional(v.string()),

	// Field visibility (which fields to show on public view)
	visibleFields: v.optional(v.array(v.string())),

	// Schedule sections to include
	includedScheduleIds: v.optional(v.array(v.string())),
});

const SignContractSchema = v.object({
	contractSlug: v.pipe(v.string(), v.minLength(1)),
	signatoryName: v.pipe(v.string(), v.minLength(1)),
	signatoryTitle: v.optional(v.string()),
	agreedToTerms: v.literal(true),
});

const ContractFiltersSchema = v.optional(
	v.object({
		status: v.optional(ContractStatusSchema),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique public slug for the contract.
 */
async function generateUniqueSlug(): Promise<string> {
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

	throw new Error("Unable to generate unique slug");
}

/**
 * Get the next contract number and increment it atomically.
 */
async function getNextContractNumber(agencyId: string): Promise<string> {
	return getNextDocumentNumber(agencyId, "contract");
}

/**
 * Calculate total price from proposal.
 */
function calculateTotalFromProposal(
	proposal: typeof proposals.$inferSelect,
	selectedPackage: typeof agencyPackages.$inferSelect | null,
	selectedAddons: (typeof agencyAddons.$inferSelect)[],
): string {
	// Use custom pricing if set
	const customPricing = proposal.customPricing as {
		setupFee?: string;
		monthlyPrice?: string;
		oneTimePrice?: string;
		discountPercent?: number;
	} | null;

	const setupFee = parseFloat(customPricing?.setupFee ?? selectedPackage?.setupFee ?? "0");
	const oneTimePrice = parseFloat(
		customPricing?.oneTimePrice ?? selectedPackage?.oneTimePrice ?? "0",
	);
	const addonsTotal = selectedAddons.reduce(
		(sum, addon) => sum + parseFloat(addon.price || "0"),
		0,
	);

	let subtotal = setupFee + oneTimePrice + addonsTotal;

	// Apply discount if present
	const discountPercent = customPricing?.discountPercent ?? 0;
	subtotal = subtotal * (1 - discountPercent / 100);

	// Add GST (10%)
	const total = subtotal * 1.1;

	return total.toFixed(2);
}

/**
 * Build payment terms string from proposal data.
 */
function buildPaymentTerms(
	proposal: typeof proposals.$inferSelect,
	selectedPackage: typeof agencyPackages.$inferSelect | null,
): string {
	const customPricing = proposal.customPricing as {
		setupFee?: string;
		monthlyPrice?: string;
	} | null;

	const setupFee = customPricing?.setupFee ?? selectedPackage?.setupFee ?? "0";
	const monthlyPrice = customPricing?.monthlyPrice ?? selectedPackage?.monthlyPrice ?? "0";

	const terms: string[] = [];

	if (parseFloat(setupFee) > 0) {
		terms.push(
			`Setup fee of ${dataPipelineService.formatCurrency(parseFloat(setupFee))} due on contract signing`,
		);
	}

	if (parseFloat(monthlyPrice) > 0) {
		terms.push(
			`Monthly hosting/maintenance of ${dataPipelineService.formatCurrency(parseFloat(monthlyPrice))} billed in advance`,
		);
	}

	return terms.join(". ") || "Payment terms to be agreed upon signing.";
}

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all contracts for the current agency.
 * All roles can view all contracts (edit/delete restricted by ownership).
 */
export const getContracts = query(ContractFiltersSchema, async (filters) => {
	const context = await getAgencyContext();
	const { status, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [eq(contracts.agencyId, context.agencyId)];

	// Add status filter if provided
	if (status) {
		conditions.push(eq(contracts.status, status));
	}

	// All roles can view all agency contracts (edit/delete still restricted by ownership)

	const results = await db
		.select({
			id: contracts.id,
			agencyId: contracts.agencyId,
			proposalId: contracts.proposalId,
			clientId: contracts.clientId,
			contractNumber: contracts.contractNumber,
			slug: contracts.slug,
			version: contracts.version,
			clientBusinessName: contracts.clientBusinessName,
			clientContactName: contracts.clientContactName,
			clientEmail: contracts.clientEmail,
			clientPhone: contracts.clientPhone,
			clientAddress: contracts.clientAddress,
			totalPrice: contracts.totalPrice,
			status: contracts.status,
			sentAt: contracts.sentAt,
			lastViewedAt: contracts.lastViewedAt,
			clientSignedAt: contracts.clientSignedAt,
			viewCount: contracts.viewCount,
			createdBy: contracts.createdBy,
			createdAt: contracts.createdAt,
			updatedAt: contracts.updatedAt,
			// Join to get creator name
			creatorName: sql<
				string | null
			>`COALESCE(${agencyMemberships.displayName}, ${users.email})`.as("creator_name"),
		})
		.from(contracts)
		.leftJoin(users, eq(contracts.createdBy, users.id))
		.leftJoin(
			agencyMemberships,
			and(
				eq(contracts.createdBy, agencyMemberships.userId),
				eq(contracts.agencyId, agencyMemberships.agencyId),
			),
		)
		.where(and(...conditions))
		.orderBy(desc(contracts.createdAt))
		.limit(limit)
		.offset(offset);

	return results;
});

/**
 * Get a single contract by ID.
 */
export const getContract = query(v.pipe(v.string(), v.uuid()), async (contractId: string) => {
	const context = await getAgencyContext();

	const [contract] = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
		.limit(1);

	if (!contract) {
		throw new Error("Contract not found");
	}

	// Check access permission
	if (!canAccessResource(context.role, contract.createdBy || "", context.userId, "contract")) {
		throw new Error("Permission denied");
	}

	return contract;
});

/**
 * Get a contract by public slug (for public view).
 * No authentication required.
 */
export const getContractBySlug = query(v.pipe(v.string(), v.minLength(1)), async (slug: string) => {
	const [contract] = await db.select().from(contracts).where(eq(contracts.slug, slug)).limit(1);

	if (!contract) {
		return null;
	}

	// Check if expired
	if (contract.validUntil && new Date(contract.validUntil) < new Date()) {
		// Mark as expired if not already signed
		if (contract.status !== "signed" && contract.status !== "completed") {
			return { ...contract, status: "expired" as const };
		}
	}

	// Fetch agency info for display
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, contract.agencyId))
		.limit(1);

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, contract.agencyId))
		.limit(1);

	return {
		contract,
		agency: agency || null,
		agencyProfile: profile || null,
	};
});

/**
 * Get contract with related data (proposal, template).
 */
export const getContractWithRelations = query(
	v.pipe(v.string(), v.uuid()),
	async (contractId: string) => {
		const context = await getAgencyContext();

		const [contract] = await db
			.select()
			.from(contracts)
			.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
			.limit(1);

		if (!contract) {
			throw new Error("Contract not found");
		}

		// Check access permission
		if (!canAccessResource(context.role, contract.createdBy || "", context.userId, "contract")) {
			throw new Error("Permission denied");
		}

		// Fetch related data
		let proposal = null;
		if (contract.proposalId) {
			const [p] = await db
				.select()
				.from(proposals)
				.where(eq(proposals.id, contract.proposalId))
				.limit(1);
			proposal = p || null;
		}

		let template = null;
		if (contract.templateId) {
			const [t] = await db
				.select()
				.from(contractTemplates)
				.where(eq(contractTemplates.id, contract.templateId))
				.limit(1);
			template = t || null;
		}

		return {
			contract,
			proposal,
			template,
		};
	},
);

// =============================================================================
// Command Functions (Mutations)
// =============================================================================

/**
 * Create a new contract from a proposal.
 * Auto-populates data from proposal and resolves merge fields.
 */
export const createContractFromProposal = command(CreateContractSchema, async (data) => {
	const context = await getAgencyContext();

	// Check permission
	if (!hasPermission(context.role, "contract:create")) {
		throw new Error("Permission denied");
	}

	// Load proposal with verification
	const [proposal] = await db
		.select()
		.from(proposals)
		.where(and(eq(proposals.id, data.proposalId), eq(proposals.agencyId, context.agencyId)))
		.limit(1);

	if (!proposal) {
		throw new Error("Proposal not found");
	}

	// Get template (specified or default)
	let template = null;
	if (data.templateId) {
		const [t] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, data.templateId),
					eq(contractTemplates.agencyId, context.agencyId),
					eq(contractTemplates.isActive, true),
				),
			)
			.limit(1);
		template = t;
	} else {
		// Get default template
		const [t] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.agencyId, context.agencyId),
					eq(contractTemplates.isDefault, true),
					eq(contractTemplates.isActive, true),
				),
			)
			.limit(1);
		template = t;
	}

	// Fetch related data for merge fields
	let selectedPackage = null;
	if (proposal.selectedPackageId) {
		const [pkg] = await db
			.select()
			.from(agencyPackages)
			.where(eq(agencyPackages.id, proposal.selectedPackageId))
			.limit(1);
		selectedPackage = pkg || null;
	}

	const addonIds = (proposal.selectedAddons as string[]) || [];
	let selectedAddons: (typeof agencyAddons.$inferSelect)[] = [];
	if (addonIds.length > 0) {
		selectedAddons = await db
			.select()
			.from(agencyAddons)
			.where(and(eq(agencyAddons.agencyId, context.agencyId), inArray(agencyAddons.id, addonIds)));
	}

	// Get schedule for this package (if template has one)
	let schedule = null;
	if (template && selectedPackage) {
		const [s] = await db
			.select()
			.from(contractSchedules)
			.where(
				and(
					eq(contractSchedules.templateId, template.id),
					eq(contractSchedules.packageId, selectedPackage.id),
					eq(contractSchedules.isActive, true),
				),
			)
			.limit(1);
		schedule = s;
	}

	// If no package-specific schedule, get the first active schedule
	if (template && !schedule) {
		const [s] = await db
			.select()
			.from(contractSchedules)
			.where(
				and(eq(contractSchedules.templateId, template.id), eq(contractSchedules.isActive, true)),
			)
			.orderBy(sql`${contractSchedules.displayOrder} ASC`)
			.limit(1);
		schedule = s;
	}

	// Get agency and profile for merge fields
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, context.agencyId))
		.limit(1);

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Get consultation for client merge fields
	let consultation = null;
	if (proposal.consultationId) {
		const [c] = await db
			.select()
			.from(consultations)
			.where(eq(consultations.id, proposal.consultationId))
			.limit(1);
		consultation = c || null;
	}

	// Generate contract number and slug
	const contractNumber = await getNextContractNumber(context.agencyId);
	const slug = await generateUniqueSlug();

	// Get or create unified client - inherit from proposal or create new
	let clientId: string | null = proposal.clientId;
	if (!clientId && proposal.clientEmail) {
		const result = await getOrCreateClient({
			businessName: proposal.clientBusinessName || proposal.clientContactName || "Unknown",
			email: proposal.clientEmail,
			contactName: proposal.clientContactName || null,
		});
		if (result.client) {
			clientId = result.client.id;
		}
	}

	// Calculate total price
	const totalPrice = calculateTotalFromProposal(proposal, selectedPackage, selectedAddons);
	const paymentTerms = buildPaymentTerms(proposal, selectedPackage);

	// Build merge field data (only include defined properties)
	const mergeData: MergeFieldData = {
		proposal: dataPipelineService.buildProposalMergeFields(
			{
				proposalNumber: proposal.proposalNumber,
				title: proposal.title,
				createdAt: proposal.createdAt,
				validUntil: proposal.validUntil,
				customPricing: proposal.customPricing as {
					setupFee?: string;
					monthlyPrice?: string;
					oneTimePrice?: string;
					hostingFee?: string;
					discountPercent?: number;
					discountNote?: string;
				} | null,
			},
			selectedPackage
				? {
						name: selectedPackage.name,
						description: selectedPackage.description,
						setupFee: selectedPackage.setupFee,
						monthlyPrice: selectedPackage.monthlyPrice,
						oneTimePrice: selectedPackage.oneTimePrice,
						hostingFee: selectedPackage.hostingFee,
					}
				: null,
			selectedAddons.map((a) => ({ name: a.name, price: a.price })),
		),
		computed: dataPipelineService.buildComputedMergeFields(),
	};

	// Add optional properties only if they have values
	if (agency && profile) {
		mergeData.agency = dataPipelineService.buildAgencyMergeFields(agency, profile);
	}
	if (consultation) {
		mergeData.client = dataPipelineService.buildClientMergeFields(consultation);
	}

	// Resolve merge fields in template content and sanitize (defense in depth)
	const generatedTermsHtml = template
		? sanitizeHtml(dataPipelineService.resolveMergeFields(template.termsContent, mergeData))
		: "";

	const generatedScheduleHtml = schedule
		? sanitizeHtml(dataPipelineService.resolveMergeFields(schedule.content, mergeData))
		: "";

	// Get signature config from template
	const signatureConfig = (template?.signatureConfig || {}) as SignatureConfig;

	// Create contract
	const [contract] = await db
		.insert(contracts)
		.values({
			agencyId: context.agencyId,
			proposalId: proposal.id,
			templateId: template?.id,
			clientId, // Link to unified client
			contractNumber,
			slug,
			// Client info snapshot
			clientBusinessName: proposal.clientBusinessName || "",
			clientContactName: proposal.clientContactName || "",
			clientEmail: proposal.clientEmail || "",
			clientPhone: proposal.clientPhone || "",
			clientAddress: "", // Not on proposal, can be filled in
			// Price snapshot
			totalPrice,
			priceIncludesGst: true,
			paymentTerms,
			// Generated content
			generatedTermsHtml,
			generatedScheduleHtml,
			// Agency signature from template config
			agencySignatoryName: signatureConfig.agencySignatory || null,
			agencySignatoryTitle: signatureConfig.agencyTitle || null,
			// Validity (30 days default)
			validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			createdBy: context.userId,
		})
		.returning();

	// Log activity
	await logActivity("contract.created", "contract", contract?.id, {
		newValues: {
			contractNumber,
			proposalId: proposal.id,
			templateId: template?.id,
		},
	});

	return contract;
});

/**
 * Update a contract.
 */
export const updateContract = command(UpdateContractSchema, async (data) => {
	const context = await getAgencyContext();

	// Verify contract exists and belongs to agency
	const [existing] = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, data.contractId), eq(contracts.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Contract not found");
	}

	// Check modify permission
	if (!canModifyResource(context.role, existing.createdBy || "", context.userId, "contract")) {
		throw new Error("Permission denied");
	}

	// Only lock after signing - allow edits to sent/viewed contracts
	if (["signed", "completed"].includes(existing.status)) {
		throw new Error("Cannot modify signed contract");
	}

	// Build update object
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	// Client info
	if (data.clientBusinessName !== undefined)
		updates["clientBusinessName"] = data.clientBusinessName;
	if (data.clientContactName !== undefined) updates["clientContactName"] = data.clientContactName;
	if (data.clientEmail !== undefined) updates["clientEmail"] = data.clientEmail;
	if (data.clientPhone !== undefined) updates["clientPhone"] = data.clientPhone;
	if (data.clientAddress !== undefined) updates["clientAddress"] = data.clientAddress;

	// Contract fields
	if (data.servicesDescription !== undefined)
		updates["servicesDescription"] = data.servicesDescription;
	if (data.commencementDate !== undefined) {
		updates["commencementDate"] = data.commencementDate ? new Date(data.commencementDate) : null;
	}
	if (data.completionDate !== undefined) {
		updates["completionDate"] = data.completionDate ? new Date(data.completionDate) : null;
	}
	if (data.specialConditions !== undefined) updates["specialConditions"] = data.specialConditions;

	// Pricing
	if (data.totalPrice !== undefined) updates["totalPrice"] = data.totalPrice;
	if (data.priceIncludesGst !== undefined) updates["priceIncludesGst"] = data.priceIncludesGst;
	if (data.paymentTerms !== undefined) updates["paymentTerms"] = data.paymentTerms;

	// Validity
	if (data.validUntil !== undefined) {
		updates["validUntil"] = data.validUntil ? new Date(data.validUntil) : null;
	}

	// Agency signature
	if (data.agencySignatoryName !== undefined)
		updates["agencySignatoryName"] = data.agencySignatoryName;
	if (data.agencySignatoryTitle !== undefined)
		updates["agencySignatoryTitle"] = data.agencySignatoryTitle;

	// Field visibility and schedule sections
	if (data.visibleFields !== undefined) updates["visibleFields"] = data.visibleFields;
	if (data.includedScheduleIds !== undefined)
		updates["includedScheduleIds"] = data.includedScheduleIds;

	const [contract] = await db
		.update(contracts)
		.set(updates)
		.where(eq(contracts.id, data.contractId))
		.returning();

	// Log activity
	await logActivity("contract.updated", "contract", data.contractId, {
		oldValues: { clientBusinessName: existing.clientBusinessName },
		newValues: updates,
	});

	return contract;
});

/**
 * Delete a contract.
 */
export const deleteContract = command(v.pipe(v.string(), v.uuid()), async (contractId: string) => {
	const context = await getAgencyContext();

	// Verify contract exists and belongs to agency
	const [existing] = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Contract not found");
	}

	// Check delete permission
	if (!canDeleteResource(context.role, existing.createdBy || "", context.userId, "contract")) {
		throw new Error("Permission denied");
	}

	// Cannot delete signed contracts
	if (["signed", "completed"].includes(existing.status)) {
		throw new Error("Cannot delete signed contract");
	}

	// Delete contract
	await db.delete(contracts).where(eq(contracts.id, contractId));

	// Log activity
	await logActivity("contract.deleted", "contract", contractId, {
		oldValues: { contractNumber: existing.contractNumber },
	});
});

/**
 * Send a contract (mark as sent and email to client).
 */
export const sendContract = command(v.pipe(v.string(), v.uuid()), async (contractId: string) => {
	const context = await getAgencyContext();

	// Verify contract exists and belongs to agency
	const [existing] = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Contract not found");
	}

	// Check permission
	if (!hasPermission(context.role, "contract:send")) {
		throw new Error("Permission denied");
	}

	// Validate required fields before sending
	if (!existing.clientEmail) {
		throw new Error("Client email is required to send contract");
	}

	// Update status to sent
	const [contract] = await db
		.update(contracts)
		.set({
			status: "sent",
			sentAt: new Date(),
			agencySignedAt: new Date(), // Agency signs when sending
			updatedAt: new Date(),
		})
		.where(eq(contracts.id, contractId))
		.returning();

	// Send email notification to client (non-blocking, don't fail the request)
	if (contract) {
		sendContractEmailToClient(contract, context.userId).catch((err) =>
			console.error("Failed to send contract email:", err),
		);
	}

	// Log activity
	await logActivity("contract.sent", "contract", contractId, {
		newValues: { status: "sent", sentAt: new Date().toISOString() },
	});

	return contract;
});

/**
 * Resend a contract email.
 */
export const resendContract = command(v.pipe(v.string(), v.uuid()), async (contractId: string) => {
	const context = await getAgencyContext();

	// Verify contract exists and belongs to agency
	const [existing] = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
		.limit(1);

	if (!existing) {
		throw new Error("Contract not found");
	}

	// Check permission
	if (!hasPermission(context.role, "contract:send")) {
		throw new Error("Permission denied");
	}

	// Must be in sent or viewed status
	if (!["sent", "viewed"].includes(existing.status)) {
		throw new Error("Contract must be sent before resending");
	}

	// Resend email notification to client (non-blocking)
	sendContractEmailToClient(existing, context.userId).catch((err) =>
		console.error("Failed to resend contract email:", err),
	);

	// Log activity
	await logActivity("contract.resent", "contract", contractId, {
		metadata: { resentAt: new Date().toISOString() },
	});

	return existing;
});

/**
 * Regenerate contract terms from template.
 * Use this to update a contract with the latest template content.
 */
export const regenerateContractTerms = command(
	v.pipe(v.string(), v.uuid()),
	async (contractId: string) => {
		const context = await getAgencyContext();

		// Get contract with template
		const [existing] = await db
			.select()
			.from(contracts)
			.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error("Contract not found");
		}

		// Check permission
		if (!canModifyResource(context.role, existing.createdBy || "", context.userId, "contract")) {
			throw new Error("Permission denied");
		}

		// Cannot modify signed contracts
		if (["signed", "completed"].includes(existing.status)) {
			throw new Error("Cannot modify signed contract");
		}

		// Get template
		if (!existing.templateId) {
			throw new Error("Contract has no linked template");
		}

		const [template] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, existing.templateId),
					eq(contractTemplates.agencyId, context.agencyId),
				),
			)
			.limit(1);

		if (!template) {
			throw new Error("Template not found");
		}

		if (!template.termsContent) {
			throw new Error("Template has no terms content");
		}

		// Get proposal for merge fields
		let proposal = null;
		if (existing.proposalId) {
			const [p] = await db
				.select()
				.from(proposals)
				.where(eq(proposals.id, existing.proposalId))
				.limit(1);
			proposal = p || null;
		}

		// Get related data for merge fields
		let selectedPackage = null;
		if (proposal?.selectedPackageId) {
			const [pkg] = await db
				.select()
				.from(agencyPackages)
				.where(eq(agencyPackages.id, proposal.selectedPackageId))
				.limit(1);
			selectedPackage = pkg || null;
		}

		const addonIds = (proposal?.selectedAddons as string[]) || [];
		let selectedAddons: (typeof agencyAddons.$inferSelect)[] = [];
		if (addonIds.length > 0) {
			selectedAddons = await db
				.select()
				.from(agencyAddons)
				.where(inArray(agencyAddons.id, addonIds));
		}

		const [agency] = await db
			.select()
			.from(agencies)
			.where(eq(agencies.id, context.agencyId))
			.limit(1);

		const [profile] = await db
			.select()
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, context.agencyId))
			.limit(1);

		// Get consultation for client merge fields
		let consultation = null;
		if (proposal?.consultationId) {
			const [c] = await db
				.select()
				.from(consultations)
				.where(eq(consultations.id, proposal.consultationId))
				.limit(1);
			consultation = c || null;
		}

		// Build merge field data
		const mergeData: MergeFieldData = {
			proposal: proposal
				? dataPipelineService.buildProposalMergeFields(
						{
							proposalNumber: proposal.proposalNumber,
							title: proposal.title,
							createdAt: proposal.createdAt,
							validUntil: proposal.validUntil,
							customPricing: proposal.customPricing as {
								setupFee?: string;
								monthlyPrice?: string;
								oneTimePrice?: string;
								hostingFee?: string;
								discountPercent?: number;
								discountNote?: string;
							} | null,
						},
						selectedPackage
							? {
									name: selectedPackage.name,
									description: selectedPackage.description,
									setupFee: selectedPackage.setupFee,
									monthlyPrice: selectedPackage.monthlyPrice,
									oneTimePrice: selectedPackage.oneTimePrice,
									hostingFee: selectedPackage.hostingFee,
								}
							: null,
						selectedAddons.map((a) => ({ name: a.name, price: a.price })),
					)
				: dataPipelineService.buildProposalMergeFields(
						{ proposalNumber: "", title: "", createdAt: new Date() },
						null,
						[],
					),
			contract: {
				number: existing.contractNumber || "",
				date: existing.createdAt ? formatDate(existing.createdAt, "long") : "",
				valid_until: existing.validUntil ? formatDate(existing.validUntil, "long") : "",
				total_price: existing.totalPrice ? formatCurrency(existing.totalPrice) : "",
				payment_terms: existing.paymentTerms || "",
				minimum_term: "",
				cancellation_terms: "",
				start_date: existing.commencementDate ? formatDate(existing.commencementDate, "long") : "",
				end_date: existing.completionDate ? formatDate(existing.completionDate, "long") : "",
				commencement_date: existing.commencementDate ? formatDate(existing.commencementDate, "long") : "",
				completion_date: existing.completionDate ? formatDate(existing.completionDate, "long") : "",
				services_description: existing.servicesDescription || "",
				special_conditions: existing.specialConditions || "",
				agency_signatory_name: "",
				agency_signatory_title: "",
			},
			computed: dataPipelineService.buildComputedMergeFields(),
		};

		if (agency && profile) {
			mergeData.agency = dataPipelineService.buildAgencyMergeFields(agency, profile);
		}
		if (consultation) {
			mergeData.client = dataPipelineService.buildClientMergeFields(consultation);
		}

		// Resolve merge fields in template content and sanitize (defense in depth)
		const generatedTermsHtml = sanitizeHtml(dataPipelineService.resolveMergeFields(
			template.termsContent,
			mergeData,
		));

		// Update contract with regenerated terms
		const [contract] = await db
			.update(contracts)
			.set({
				generatedTermsHtml,
				updatedAt: new Date(),
			})
			.where(eq(contracts.id, contractId))
			.returning();

		// Log activity
		await logActivity("contract.terms_regenerated", "contract", contractId, {
			metadata: { templateId: template.id },
		});

		return contract;
	},
);

/**
 * Link a template to an existing contract and regenerate terms.
 * Use this for contracts created before templates were properly linked.
 */
export const linkTemplateToContract = command(
	v.object({
		contractId: v.pipe(v.string(), v.uuid()),
		templateId: v.pipe(v.string(), v.uuid()),
	}),
	async (data) => {
		const context = await getAgencyContext();

		// Get contract
		const [existing] = await db
			.select()
			.from(contracts)
			.where(and(eq(contracts.id, data.contractId), eq(contracts.agencyId, context.agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error("Contract not found");
		}

		// Check permission
		if (!canModifyResource(context.role, existing.createdBy || "", context.userId, "contract")) {
			throw new Error("Permission denied");
		}

		// Cannot modify signed contracts
		if (["signed", "completed"].includes(existing.status)) {
			throw new Error("Cannot modify signed contract");
		}

		// Get template
		const [template] = await db
			.select()
			.from(contractTemplates)
			.where(
				and(
					eq(contractTemplates.id, data.templateId),
					eq(contractTemplates.agencyId, context.agencyId),
					eq(contractTemplates.isActive, true),
				),
			)
			.limit(1);

		if (!template) {
			throw new Error("Template not found");
		}

		// Link template to contract
		await db
			.update(contracts)
			.set({
				templateId: template.id,
				updatedAt: new Date(),
			})
			.where(eq(contracts.id, data.contractId));

		// Log activity
		await logActivity("contract.template_linked", "contract", data.contractId, {
			metadata: { templateId: template.id, templateName: template.name },
		});

		// Now regenerate terms if template has terms content
		if (template.termsContent) {
			// Get proposal for merge fields
			let proposal = null;
			if (existing.proposalId) {
				const [p] = await db
					.select()
					.from(proposals)
					.where(eq(proposals.id, existing.proposalId))
					.limit(1);
				proposal = p || null;
			}

			// Get related data for merge fields
			let selectedPackage = null;
			if (proposal?.selectedPackageId) {
				const [pkg] = await db
					.select()
					.from(agencyPackages)
					.where(eq(agencyPackages.id, proposal.selectedPackageId))
					.limit(1);
				selectedPackage = pkg || null;
			}

			const addonIds = (proposal?.selectedAddons as string[]) || [];
			let selectedAddons: (typeof agencyAddons.$inferSelect)[] = [];
			if (addonIds.length > 0) {
				selectedAddons = await db
					.select()
					.from(agencyAddons)
					.where(inArray(agencyAddons.id, addonIds));
			}

			const [agency] = await db
				.select()
				.from(agencies)
				.where(eq(agencies.id, context.agencyId))
				.limit(1);

			const [profile] = await db
				.select()
				.from(agencyProfiles)
				.where(eq(agencyProfiles.agencyId, context.agencyId))
				.limit(1);

			// Get consultation for client merge fields
			let consultation = null;
			if (proposal?.consultationId) {
				const [c] = await db
					.select()
					.from(consultations)
					.where(eq(consultations.id, proposal.consultationId))
					.limit(1);
				consultation = c || null;
			}

			// Build merge field data using helper functions
			const mergeData: MergeFieldData = {
				...(proposal && {
					proposal: dataPipelineService.buildProposalMergeFields(
						{
							proposalNumber: proposal.proposalNumber,
							title: proposal.title,
							createdAt: proposal.createdAt,
							validUntil: proposal.validUntil,
							customPricing: proposal.customPricing as {
								setupFee?: string;
								monthlyPrice?: string;
								total?: string;
							},
						},
						selectedPackage,
						selectedAddons,
					),
				}),
				...(agency && {
					agency: dataPipelineService.buildAgencyMergeFields(agency, profile || null),
				}),
				...(proposal && {
					client: dataPipelineService.buildClientMergeFields({
						businessName: proposal.clientBusinessName || consultation?.businessName || null,
						contactPerson: proposal.clientContactName || consultation?.contactPerson || null,
						email: proposal.clientEmail || consultation?.email || "",
						phone: proposal.clientPhone || consultation?.phone || "",
						industry: consultation?.industry || null,
					} as Parameters<typeof dataPipelineService.buildClientMergeFields>[0]),
				}),
				contract: dataPipelineService.buildContractMergeFields({
					contractNumber: existing.contractNumber,
					createdAt: existing.createdAt,
					validUntil: existing.validUntil,
					totalPrice: existing.totalPrice,
					paymentTerms: existing.paymentTerms,
					commencementDate: existing.commencementDate,
					completionDate: existing.completionDate,
					servicesDescription: existing.servicesDescription,
					specialConditions: existing.specialConditions,
				}),
				computed: dataPipelineService.buildComputedMergeFields(),
			};

			// Resolve merge fields and sanitize (defense in depth)
			const generatedTermsHtml = sanitizeHtml(dataPipelineService.resolveMergeFields(
				template.termsContent,
				mergeData,
			));

			// Update contract with linked template and regenerated terms
			const [contract] = await db
				.update(contracts)
				.set({
					generatedTermsHtml,
					updatedAt: new Date(),
				})
				.where(eq(contracts.id, data.contractId))
				.returning();

			return contract;
		}

		// Return contract without terms regeneration
		const [contract] = await db
			.select()
			.from(contracts)
			.where(eq(contracts.id, data.contractId))
			.limit(1);

		return contract;
	},
);

/**
 * Record a contract view (public, no auth required).
 */
export const recordContractView = command(
	v.pipe(v.string(), v.minLength(1)),
	async (slug: string) => {
		// Find contract by slug
		const [contract] = await db
			.select({ id: contracts.id, status: contracts.status })
			.from(contracts)
			.where(eq(contracts.slug, slug))
			.limit(1);

		if (!contract) {
			return; // Silently ignore if not found
		}

		// Update view count and potentially status
		const updates: Record<string, unknown> = {
			viewCount: sql`${contracts.viewCount} + 1`,
			lastViewedAt: new Date(),
		};

		// If status is 'sent', change to 'viewed'
		if (contract.status === "sent") {
			updates["status"] = "viewed";
		}

		await db.update(contracts).set(updates).where(eq(contracts.id, contract.id));
	},
);

/**
 * Sign a contract (public, client signing).
 */
export const signContract = command(SignContractSchema, async (data) => {
	// Find contract by slug
	const [contract] = await db
		.select()
		.from(contracts)
		.where(eq(contracts.slug, data.contractSlug))
		.limit(1);

	if (!contract) {
		throw new Error("Contract not found");
	}

	// Verify contract can be signed
	if (!["sent", "viewed"].includes(contract.status)) {
		throw new Error("Contract cannot be signed in current state");
	}

	// Check if expired
	if (contract.validUntil && new Date(contract.validUntil) < new Date()) {
		throw new Error("Contract has expired");
	}

	// Record signature
	const [signedContract] = await db
		.update(contracts)
		.set({
			status: "signed",
			clientSignatoryName: data.signatoryName,
			clientSignatoryTitle: data.signatoryTitle || null,
			clientSignedAt: new Date(),
			// Note: IP and user agent should be captured from request context
			// clientSignatureIp: request.ip,
			// clientSignatureUserAgent: request.headers['user-agent'],
			updatedAt: new Date(),
		})
		.where(eq(contracts.id, contract.id))
		.returning();

	// Send signature confirmation and agency notification (non-blocking)
	if (signedContract) {
		sendContractSignedEmails(signedContract, data.signatoryName).catch((err) =>
			console.error("Failed to send contract signed emails:", err),
		);
	}

	// Log activity (without user context since this is public)
	await logActivity("contract.signed", "contract", contract.id, {
		newValues: {
			status: "signed",
			clientSignatoryName: data.signatoryName,
			clientSignedAt: new Date().toISOString(),
		},
	});

	return signedContract;
});

/**
 * Update contract status.
 */
export const updateContractStatus = command(
	v.object({
		contractId: v.pipe(v.string(), v.uuid()),
		status: ContractStatusSchema,
	}),
	async (data) => {
		const context = await getAgencyContext();

		// Verify contract exists and belongs to agency
		const [existing] = await db
			.select()
			.from(contracts)
			.where(and(eq(contracts.id, data.contractId), eq(contracts.agencyId, context.agencyId)))
			.limit(1);

		if (!existing) {
			throw new Error("Contract not found");
		}

		// Check modify permission
		if (!canModifyResource(context.role, existing.createdBy || "", context.userId, "contract")) {
			throw new Error("Permission denied");
		}

		// Update status
		const [contract] = await db
			.update(contracts)
			.set({
				status: data.status,
				updatedAt: new Date(),
			})
			.where(eq(contracts.id, data.contractId))
			.returning();

		// Log activity
		await logActivity("contract.status_changed", "contract", data.contractId, {
			oldValues: { status: existing.status },
			newValues: { status: data.status },
		});

		return contract;
	},
);

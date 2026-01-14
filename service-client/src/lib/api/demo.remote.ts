/**
 * Demo Data Remote Functions
 *
 * Provides functions to load, check, and clear demo data for agency onboarding.
 * Creates a complete Murray's Plumbing demo flow:
 * Consultation → Proposal → Contract → Questionnaire → Invoice
 *
 * All demo entities are prefixed with "Demo:" for easy identification and cleanup.
 */

import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import {
	consultations,
	proposals,
	contracts,
	questionnaireResponses,
	invoices,
	invoiceLineItems,
	agencyPackages,
	agencyAddons
} from '$lib/server/schema';
import { getAgencyContext } from '$lib/server/agency';
import { eq, and, inArray, like, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
	DEMO_CONSULTATION,
	DEMO_PROPOSAL,
	DEMO_CONTRACT,
	DEMO_QUESTIONNAIRE,
	DEMO_INVOICE
} from './demo-data';

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Check if demo data exists for the current agency.
 * Looks for consultations with "Demo:" prefix in business name.
 */
export const getDemoDataStatus = query(async () => {
	const { agencyId } = await getAgencyContext();

	const [demo] = await db
		.select({ id: consultations.id })
		.from(consultations)
		.where(
			and(
				eq(consultations.agencyId, agencyId),
				like(consultations.businessName, 'Demo:%')
			)
		)
		.limit(1);

	return { hasDemoData: !!demo };
});

// =============================================================================
// Command Functions (Write Operations)
// =============================================================================

/**
 * Load demo data for the current agency.
 * Creates a complete client journey: Consultation → Proposal → Contract → Questionnaire → Invoice
 *
 * All entities are prefixed with "Demo:" for easy identification and cleanup.
 */
export const loadDemoData = command(async () => {
	const { agencyId, userId } = await getAgencyContext();

	// Check if demo data already exists
	const [existing] = await db
		.select({ id: consultations.id })
		.from(consultations)
		.where(
			and(
				eq(consultations.agencyId, agencyId),
				like(consultations.businessName, 'Demo:%')
			)
		)
		.limit(1);

	if (existing) {
		return { success: false, error: 'Demo data already exists' };
	}

	// Generate unique IDs for all entities
	const consultationId = crypto.randomUUID();
	const proposalId = crypto.randomUUID();
	const contractId = crypto.randomUUID();
	const questionnaireId = crypto.randomUUID();
	const invoiceId = crypto.randomUUID();

	// Generate unique slugs
	const proposalSlug = `demo-murrays-${nanoid(8)}`;
	const contractSlug = `demo-contract-${nanoid(8)}`;
	const questionnaireSlug = `demo-questionnaire-${nanoid(8)}`;
	const invoiceSlug = `demo-invoice-${nanoid(8)}`;

	// Query for agency's packages (prefer featured, then by display order)
	const availablePackages = await db
		.select()
		.from(agencyPackages)
		.where(and(eq(agencyPackages.agencyId, agencyId), eq(agencyPackages.isActive, true)))
		.orderBy(desc(agencyPackages.isFeatured), agencyPackages.displayOrder)
		.limit(1);

	const selectedPackage = availablePackages[0] ?? null;

	// Query for agency's addons (first 2-3 active addons)
	const availableAddons = await db
		.select()
		.from(agencyAddons)
		.where(and(eq(agencyAddons.agencyId, agencyId), eq(agencyAddons.isActive, true)))
		.orderBy(agencyAddons.displayOrder)
		.limit(3);

	const selectedAddonIds = availableAddons.map((addon) => addon.id);

	// 1. Create consultation (v2 flat columns)
	await db.insert(consultations).values({
		id: consultationId,
		agencyId,
		// Step 1: Contact & Business
		businessName: DEMO_CONSULTATION.businessName,
		contactPerson: DEMO_CONSULTATION.contactPerson,
		email: DEMO_CONSULTATION.email,
		phone: DEMO_CONSULTATION.phone,
		website: DEMO_CONSULTATION.website,
		socialLinkedin: DEMO_CONSULTATION.socialLinkedin,
		socialFacebook: DEMO_CONSULTATION.socialFacebook,
		socialInstagram: DEMO_CONSULTATION.socialInstagram,
		industry: DEMO_CONSULTATION.industry,
		businessType: DEMO_CONSULTATION.businessType,
		// Step 2: Situation & Challenges
		websiteStatus: DEMO_CONSULTATION.websiteStatus,
		primaryChallenges: DEMO_CONSULTATION.primaryChallenges,
		urgencyLevel: DEMO_CONSULTATION.urgencyLevel,
		// Step 3: Goals & Budget
		primaryGoals: DEMO_CONSULTATION.primaryGoals,
		conversionGoal: DEMO_CONSULTATION.conversionGoal,
		budgetRange: DEMO_CONSULTATION.budgetRange,
		timeline: DEMO_CONSULTATION.timeline,
		// Step 4: Preferences & Notes
		designStyles: DEMO_CONSULTATION.designStyles,
		admiredWebsites: DEMO_CONSULTATION.admiredWebsites,
		consultationNotes: DEMO_CONSULTATION.consultationNotes,
		// Metadata
		status: 'completed'
	});

	// 2. Create proposal linked to consultation
	// Build custom pricing if package is selected (shows 10% demo discount)
	const customPricing = selectedPackage
		? {
				setupFee: selectedPackage.setupFee,
				monthlyPrice: selectedPackage.monthlyPrice,
				oneTimePrice: selectedPackage.oneTimePrice,
				hostingFee: selectedPackage.hostingFee,
				discountPercent: 10,
				discountNote: 'Demo: 10% new client discount'
			}
		: null;

	await db.insert(proposals).values({
		id: proposalId,
		agencyId,
		consultationId,
		proposalNumber: `DEMO-${Date.now().toString(36).toUpperCase()}`,
		slug: proposalSlug,
		title: DEMO_PROPOSAL.title,
		status: DEMO_PROPOSAL.status,
		coverImage: DEMO_PROPOSAL.coverImage,
		executiveSummary: DEMO_PROPOSAL.executiveSummary,
		performanceData: DEMO_PROPOSAL.performanceData,
		opportunityContent: DEMO_PROPOSAL.opportunityContent,
		currentIssues: DEMO_PROPOSAL.currentIssues,
		complianceIssues: DEMO_PROPOSAL.complianceIssues,
		roiAnalysis: DEMO_PROPOSAL.roiAnalysis,
		performanceStandards: DEMO_PROPOSAL.performanceStandards,
		localAdvantageContent: DEMO_PROPOSAL.localAdvantageContent,
		proposedPages: DEMO_PROPOSAL.proposedPages,
		timeline: DEMO_PROPOSAL.timeline,
		closingContent: DEMO_PROPOSAL.closingContent,
		nextSteps: DEMO_PROPOSAL.nextSteps,
		consultationPainPoints: DEMO_PROPOSAL.consultationPainPoints,
		consultationGoals: DEMO_PROPOSAL.consultationGoals,
		consultationChallenges: DEMO_PROPOSAL.consultationChallenges,
		clientBusinessName: DEMO_PROPOSAL.clientBusinessName,
		clientContactName: DEMO_PROPOSAL.clientContactName,
		clientEmail: DEMO_PROPOSAL.clientEmail,
		clientPhone: DEMO_PROPOSAL.clientPhone,
		clientWebsite: DEMO_PROPOSAL.clientWebsite,
		// Link to agency's package and addons (dynamically queried)
		selectedPackageId: selectedPackage?.id ?? null,
		selectedAddons: selectedAddonIds,
		customPricing,
		validUntil: DEMO_PROPOSAL.validUntil,
		viewCount: 0,
		createdBy: userId
	});

	// 3. Create contract linked to proposal
	await db.insert(contracts).values({
		id: contractId,
		agencyId,
		proposalId,
		contractNumber: `DEMO-CON-${Date.now().toString(36).toUpperCase()}`,
		slug: contractSlug,
		version: DEMO_CONTRACT.version,
		status: DEMO_CONTRACT.status,
		clientBusinessName: DEMO_CONTRACT.clientBusinessName,
		clientContactName: DEMO_CONTRACT.clientContactName,
		clientEmail: DEMO_CONTRACT.clientEmail,
		clientPhone: DEMO_CONTRACT.clientPhone,
		clientAddress: DEMO_CONTRACT.clientAddress,
		servicesDescription: DEMO_CONTRACT.servicesDescription,
		commencementDate: DEMO_CONTRACT.commencementDate,
		completionDate: DEMO_CONTRACT.completionDate,
		specialConditions: DEMO_CONTRACT.specialConditions,
		totalPrice: DEMO_CONTRACT.totalPrice,
		priceIncludesGst: DEMO_CONTRACT.priceIncludesGst,
		paymentTerms: DEMO_CONTRACT.paymentTerms,
		validUntil: DEMO_CONTRACT.validUntil,
		agencySignatoryName: DEMO_CONTRACT.agencySignatoryName,
		agencySignatoryTitle: DEMO_CONTRACT.agencySignatoryTitle,
		agencySignedAt: DEMO_CONTRACT.agencySignedAt,
		viewCount: 0,
		visibleFields: DEMO_CONTRACT.visibleFields,
		includedScheduleIds: DEMO_CONTRACT.includedScheduleIds,
		createdBy: userId
	});

	// 4. Create questionnaire linked to contract
	await db.insert(questionnaireResponses).values({
		id: questionnaireId,
		agencyId,
		contractId,
		proposalId,
		consultationId,
		slug: questionnaireSlug,
		clientBusinessName: DEMO_QUESTIONNAIRE.clientBusinessName,
		clientEmail: DEMO_QUESTIONNAIRE.clientEmail,
		responses: DEMO_QUESTIONNAIRE.responses,
		currentSection: DEMO_QUESTIONNAIRE.currentSection,
		completionPercentage: DEMO_QUESTIONNAIRE.completionPercentage,
		status: DEMO_QUESTIONNAIRE.status,
		startedAt: DEMO_QUESTIONNAIRE.startedAt,
		completedAt: DEMO_QUESTIONNAIRE.completedAt,
		lastActivityAt: DEMO_QUESTIONNAIRE.lastActivityAt
	});

	// 5. Create invoice linked to contract
	await db.insert(invoices).values({
		id: invoiceId,
		agencyId,
		proposalId,
		contractId,
		invoiceNumber: `DEMO-INV-${Date.now().toString(36).toUpperCase()}`,
		slug: invoiceSlug,
		status: DEMO_INVOICE.status,
		clientBusinessName: DEMO_INVOICE.clientBusinessName,
		clientContactName: DEMO_INVOICE.clientContactName,
		clientEmail: DEMO_INVOICE.clientEmail,
		clientPhone: DEMO_INVOICE.clientPhone,
		clientAddress: DEMO_INVOICE.clientAddress,
		clientAbn: DEMO_INVOICE.clientAbn,
		issueDate: DEMO_INVOICE.issueDate,
		dueDate: DEMO_INVOICE.dueDate,
		subtotal: DEMO_INVOICE.subtotal,
		discountAmount: DEMO_INVOICE.discountAmount,
		discountDescription: DEMO_INVOICE.discountDescription,
		gstAmount: DEMO_INVOICE.gstAmount,
		total: DEMO_INVOICE.total,
		gstRegistered: DEMO_INVOICE.gstRegistered,
		gstRate: DEMO_INVOICE.gstRate,
		paymentTerms: DEMO_INVOICE.paymentTerms,
		paymentTermsCustom: DEMO_INVOICE.paymentTermsCustom,
		notes: DEMO_INVOICE.notes,
		publicNotes: DEMO_INVOICE.publicNotes,
		viewCount: 0,
		onlinePaymentEnabled: DEMO_INVOICE.onlinePaymentEnabled,
		createdBy: userId
	});

	// 6. Create invoice line item
	await db.insert(invoiceLineItems).values({
		id: crypto.randomUUID(),
		invoiceId,
		description: 'Demo: Website Design Deposit (50%)',
		quantity: '1.00',
		unitPrice: '2227.27',
		amount: '2227.27',
		isTaxable: true,
		sortOrder: 0,
		category: 'setup'
	});

	return {
		success: true,
		created: {
			consultationId,
			proposalId,
			contractId,
			questionnaireId,
			invoiceId
		},
		// Include info about linked packages/addons (helps user understand if they need to create these first)
		linkedPackage: selectedPackage
			? { id: selectedPackage.id, name: selectedPackage.name }
			: null,
		linkedAddons: availableAddons.map((a) => ({ id: a.id, name: a.name })),
		note:
			!selectedPackage && selectedAddonIds.length === 0
				? 'No packages or addons found. Create packages in Settings > Packages to see them in the demo proposal.'
				: undefined
	};
});

/**
 * Clear all demo data for the current agency.
 * Deletes entities in reverse order to handle foreign key constraints:
 * Invoice Line Items → Invoices → Questionnaires → Contracts → Proposals → Consultations
 */
export const clearDemoData = command(async () => {
	const { agencyId } = await getAgencyContext();

	// Find all demo consultations (identified by "Demo:" prefix in business name)
	const demoConsultations = await db
		.select({ id: consultations.id })
		.from(consultations)
		.where(
			and(
				eq(consultations.agencyId, agencyId),
				like(consultations.businessName, 'Demo:%')
			)
		);

	if (demoConsultations.length === 0) {
		return { success: true, deleted: 0 };
	}

	const consultationIds = demoConsultations.map((c) => c.id);

	// Find all proposals linked to demo consultations
	const demoProposals = await db
		.select({ id: proposals.id })
		.from(proposals)
		.where(
			and(
				eq(proposals.agencyId, agencyId),
				inArray(proposals.consultationId, consultationIds)
			)
		);

	const proposalIds = demoProposals.map((p) => p.id);

	// Find all contracts linked to demo proposals
	let contractIds: string[] = [];
	if (proposalIds.length > 0) {
		const demoContracts = await db
			.select({ id: contracts.id })
			.from(contracts)
			.where(
				and(
					eq(contracts.agencyId, agencyId),
					inArray(contracts.proposalId, proposalIds)
				)
			);
		contractIds = demoContracts.map((c) => c.id);
	}

	// Find all invoices linked to demo proposals/contracts
	let invoiceIds: string[] = [];
	if (proposalIds.length > 0) {
		const demoInvoices = await db
			.select({ id: invoices.id })
			.from(invoices)
			.where(
				and(
					eq(invoices.agencyId, agencyId),
					inArray(invoices.proposalId, proposalIds)
				)
			);
		invoiceIds = demoInvoices.map((i) => i.id);
	}

	// Delete in reverse order of foreign key dependencies

	// 1. Delete invoice line items
	if (invoiceIds.length > 0) {
		await db
			.delete(invoiceLineItems)
			.where(inArray(invoiceLineItems.invoiceId, invoiceIds));
	}

	// 2. Delete invoices
	if (invoiceIds.length > 0) {
		await db.delete(invoices).where(inArray(invoices.id, invoiceIds));
	}

	// 3. Delete questionnaire responses
	if (consultationIds.length > 0) {
		await db
			.delete(questionnaireResponses)
			.where(
				and(
					eq(questionnaireResponses.agencyId, agencyId),
					inArray(questionnaireResponses.consultationId, consultationIds)
				)
			);
	}

	// 4. Delete contracts
	if (contractIds.length > 0) {
		await db.delete(contracts).where(inArray(contracts.id, contractIds));
	}

	// 5. Delete proposals
	if (proposalIds.length > 0) {
		await db.delete(proposals).where(inArray(proposals.id, proposalIds));
	}

	// 6. Delete consultations
	await db
		.delete(consultations)
		.where(inArray(consultations.id, consultationIds));

	return {
		success: true,
		deleted: {
			consultations: consultationIds.length,
			proposals: proposalIds.length,
			contracts: contractIds.length,
			invoices: invoiceIds.length
		}
	};
});

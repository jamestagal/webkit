/**
 * Demo Data Remote Functions
 *
 * Provides functions to load, check, and clear demo data for agency onboarding.
 * Creates a complete Murray's Plumbing demo flow:
 * Consultation → Proposal → Contract → Invoice → Quotation
 *
 * All demo entities are prefixed with "Demo:" for easy identification and cleanup.
 */

import { query, command } from "$app/server";
import { db } from "$lib/server/db";
import {
	consultations,
	proposals,
	contracts,
	invoices,
	invoiceLineItems,
	quotations,
	quotationScopeSections,
	agencyPackages,
	agencyAddons,
	clients,
	contentCrawlJobs,
	contentPages,
	contentChunks,
	brandProfiles,
	seoAudits,
	seoIssues,
	contentCopy,
} from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq, and, inArray, like, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
	DEMO_CONSULTATION,
	DEMO_PROPOSAL,
	DEMO_CONTRACT,
	DEMO_INVOICE,
	DEMO_QUOTATION,
	DEMO_QUOTATION_SECTIONS,
	DEMO_CRAWL_JOB,
	DEMO_CONTENT_PAGES,
	generateChunksForPage,
	DEMO_BRAND_PROFILE,
	DEMO_SEO_AUDIT,
	DEMO_SEO_ISSUES,
	DEMO_WEB_COPY,
	DEMO_SOCIAL_POSTS,
} from "./demo-data";

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
		.where(and(eq(consultations.agencyId, agencyId), like(consultations.businessName, "Demo:%")))
		.limit(1);

	return { hasDemoData: !!demo };
});

/**
 * Get the demo client ID for the current agency (for content intelligence explore link).
 */
export const getDemoClientId = query(async () => {
	const { agencyId } = await getAgencyContext();

	const [demo] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.agencyId, agencyId), like(clients.businessName, "Demo:%")))
		.limit(1);

	return demo?.id ?? null;
});

// =============================================================================
// Command Functions (Write Operations)
// =============================================================================

/**
 * Load demo data for the current agency.
 * Creates a complete client journey: Consultation → Proposal → Contract → Invoice → Quotation
 *
 * All entities are prefixed with "Demo:" for easy identification and cleanup.
 */
export const loadDemoData = command(async () => {
	const { agencyId, userId } = await getAgencyContext();

	// Check if demo data already exists
	const [existing] = await db
		.select({ id: consultations.id })
		.from(consultations)
		.where(and(eq(consultations.agencyId, agencyId), like(consultations.businessName, "Demo:%")))
		.limit(1);

	if (existing) {
		return { success: false, error: "Demo data already exists" };
	}

	// Generate unique IDs for all entities
	const clientId = crypto.randomUUID();
	const consultationId = crypto.randomUUID();
	const proposalId = crypto.randomUUID();
	const contractId = crypto.randomUUID();
	const invoiceId = crypto.randomUUID();
	const quotationId = crypto.randomUUID();

	// Generate unique slugs
	const proposalSlug = `demo-murrays-${nanoid(8)}`;
	const contractSlug = `demo-contract-${nanoid(8)}`;
	const invoiceSlug = `demo-invoice-${nanoid(8)}`;
	const quotationSlug = `demo-quotation-${nanoid(8)}`;

	// 0. Create unified client first (Unified Client Approach)
	await db.insert(clients).values({
		id: clientId,
		agencyId,
		businessName: DEMO_CONSULTATION.businessName,
		email: DEMO_CONSULTATION.email,
		phone: DEMO_CONSULTATION.phone,
		contactName: DEMO_CONSULTATION.contactPerson,
		website: DEMO_CONSULTATION.website,
		notes: "Demo client for Murray's Plumbing scenario",
	});

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
		userId, // Required for Go backend compatibility
		clientId, // Unified Client link
		createdBy: userId,
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
		status: "completed",
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
				discountNote: "Demo: 10% new client discount",
			}
		: null;

	await db.insert(proposals).values({
		id: proposalId,
		agencyId,
		clientId, // Unified Client link
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
		createdBy: userId,
	});

	// 3. Create contract linked to proposal
	await db.insert(contracts).values({
		id: contractId,
		agencyId,
		clientId, // Unified Client link
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
		createdBy: userId,
	});

	// 4. Create invoice linked to contract
	await db.insert(invoices).values({
		id: invoiceId,
		agencyId,
		clientId, // Unified Client link
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
		createdBy: userId,
	});

	// 5. Create invoice line item
	await db.insert(invoiceLineItems).values({
		id: crypto.randomUUID(),
		invoiceId,
		description: "Demo: Website Design Deposit (50%)",
		quantity: "1.00",
		unitPrice: "2227.27",
		amount: "2227.27",
		isTaxable: true,
		sortOrder: 0,
		category: "setup",
	});

	// 6. Create quotation with scope sections
	await db.insert(quotations).values({
		id: quotationId,
		agencyId,
		clientId,
		quotationNumber: `DEMO-QUO-${Date.now().toString(36).toUpperCase()}`,
		slug: quotationSlug,
		quotationName: DEMO_QUOTATION.quotationName,
		status: DEMO_QUOTATION.status,
		clientBusinessName: DEMO_QUOTATION.clientBusinessName,
		clientContactName: DEMO_QUOTATION.clientContactName,
		clientEmail: DEMO_QUOTATION.clientEmail,
		clientPhone: DEMO_QUOTATION.clientPhone,
		clientAddress: DEMO_QUOTATION.clientAddress,
		siteAddress: DEMO_QUOTATION.siteAddress,
		siteReference: DEMO_QUOTATION.siteReference,
		preparedDate: DEMO_QUOTATION.preparedDate,
		expiryDate: DEMO_QUOTATION.expiryDate,
		subtotal: DEMO_QUOTATION.subtotal,
		discountAmount: DEMO_QUOTATION.discountAmount,
		discountDescription: DEMO_QUOTATION.discountDescription,
		gstAmount: DEMO_QUOTATION.gstAmount,
		total: DEMO_QUOTATION.total,
		gstRegistered: DEMO_QUOTATION.gstRegistered,
		gstRate: DEMO_QUOTATION.gstRate,
		termsBlocks: DEMO_QUOTATION.termsBlocks,
		optionsNotes: DEMO_QUOTATION.optionsNotes,
		notes: DEMO_QUOTATION.notes,
		viewCount: 0,
		createdBy: userId,
	});

	// 7. Create quotation scope sections
	for (const section of DEMO_QUOTATION_SECTIONS) {
		await db.insert(quotationScopeSections).values({
			id: crypto.randomUUID(),
			quotationId,
			title: section.title,
			workItems: section.workItems,
			sectionPrice: section.sectionPrice,
			sectionGst: section.sectionGst,
			sectionTotal: section.sectionTotal,
			sortOrder: section.sortOrder,
		});
	}

	// =========================================================================
	// CONTENT INTELLIGENCE (Steps 8-15)
	// =========================================================================

	// 8. Create crawl job
	const [crawlJob] = await db
		.insert(contentCrawlJobs)
		.values({
			agencyId,
			clientId,
			status: DEMO_CRAWL_JOB.status,
			sourceUrl: DEMO_CRAWL_JOB.sourceUrl,
			crawlTarget: DEMO_CRAWL_JOB.crawlTarget,
			pagesDiscovered: DEMO_CRAWL_JOB.pagesDiscovered,
			pagesProcessed: DEMO_CRAWL_JOB.pagesProcessed,
			pagesChanged: DEMO_CRAWL_JOB.pagesChanged,
			maxDepth: DEMO_CRAWL_JOB.maxDepth,
			crawlType: DEMO_CRAWL_JOB.crawlType,
			startedAt: DEMO_CRAWL_JOB.startedAt,
			completedAt: DEMO_CRAWL_JOB.completedAt,
		})
		.returning({ id: contentCrawlJobs.id });
	const crawlJobId = crawlJob!.id;

	// 9. Insert 16 content pages
	const pageIdMap = new Map<string, string>(); // path → id
	for (const page of DEMO_CONTENT_PAGES) {
		const pageUrl = `https://www.murrayplumbinggroup.com.au${page.path}`;
		const [inserted] = await db
			.insert(contentPages)
			.values({
				clientId,
				crawlJobId,
				url: pageUrl,
				sourceType: "client",
				pageType: page.pageType,
				title: page.title,
				metaDescription: page.metaDescription,
				markdownContent: page.markdownContent,
				wordCount: page.wordCount,
				httpStatus: 200,
				contentHash: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
			})
			.returning({ id: contentPages.id });
		pageIdMap.set(page.path, inserted!.id);
	}

	// 10. Insert 48 chunks (3 per page)
	for (const page of DEMO_CONTENT_PAGES) {
		const pageId = pageIdMap.get(page.path)!;
		const chunks = generateChunksForPage(page.pageType, page.title);
		for (const chunk of chunks) {
			await db.insert(contentChunks).values({
				pageId,
				clientId,
				chunkIndex: chunk.chunkIndex,
				chunkText: chunk.chunkText,
				tokenCount: chunk.tokenCount,
				embedding: null,
				embeddingModel: "bge-base-en-v1.5",
				metadata: chunk.metadata,
			});
		}
	}

	// 11. Insert brand profile
	const [brandProfile] = await db
		.insert(brandProfiles)
		.values({
			clientId,
			agencyId,
			version: DEMO_BRAND_PROFILE.version,
			isActive: DEMO_BRAND_PROFILE.isActive,
			profile: DEMO_BRAND_PROFILE.profile,
			sourceType: DEMO_BRAND_PROFILE.sourceType,
			sourcePageCount: DEMO_BRAND_PROFILE.sourcePageCount,
			consultationId,
		})
		.returning({ id: brandProfiles.id });
	const brandProfileId = brandProfile!.id;

	// 12. Insert SEO audit
	const [audit] = await db
		.insert(seoAudits)
		.values({
			agencyId,
			clientId,
			crawlJobId,
			status: DEMO_SEO_AUDIT.status,
			overallScore: DEMO_SEO_AUDIT.overallScore,
			technicalScore: DEMO_SEO_AUDIT.technicalScore,
			contentScore: DEMO_SEO_AUDIT.contentScore,
			backlinkScore: DEMO_SEO_AUDIT.backlinkScore,
			keywordScore: DEMO_SEO_AUDIT.keywordScore,
			totalPages: DEMO_SEO_AUDIT.totalPages,
			criticalIssues: DEMO_SEO_AUDIT.criticalIssues,
			warningIssues: DEMO_SEO_AUDIT.warningIssues,
			passedChecks: DEMO_SEO_AUDIT.passedChecks,
			opportunities: DEMO_SEO_AUDIT.opportunities,
			startedAt: DEMO_SEO_AUDIT.startedAt,
			completedAt: DEMO_SEO_AUDIT.completedAt,
		})
		.returning({ id: seoAudits.id });
	const auditId = audit!.id;

	// 13. Insert 17 SEO issues
	for (const issue of DEMO_SEO_ISSUES) {
		const resolvedPageId = issue.pagePath ? (pageIdMap.get(issue.pagePath) ?? null) : null;
		await db.insert(seoIssues).values({
			auditId,
			clientId,
			...(resolvedPageId ? { pageId: resolvedPageId } : {}),
			category: issue.category,
			severity: issue.severity,
			checkName: issue.checkName,
			title: issue.title,
			description: issue.description,
			currentValue: issue.currentValue,
			recommendedValue: issue.recommendedValue,
			impact: issue.impact,
		});
	}

	// 14. Insert 6 web copy pieces
	for (const copy of DEMO_WEB_COPY) {
		await db.insert(contentCopy).values({
			clientId,
			agencyId,
			generatedBy: userId,
			copyType: copy.copyType,
			title: copy.title,
			content: copy.content,
			targetKeyword: copy.targetKeyword,
			targetWordCount: copy.targetWordCount,
			actualWordCount: copy.actualWordCount,
			status: copy.status,
			promptTokens: copy.promptTokens,
			completionTokens: copy.completionTokens,
			modelUsed: copy.modelUsed,
			generationConfig: copy.generationConfig,
			contextSources: { brand_profile_id: brandProfileId },
			createdAt: copy.createdAt,
		});
	}

	// 15. Insert 4 social posts
	for (const post of DEMO_SOCIAL_POSTS) {
		await db.insert(contentCopy).values({
			clientId,
			agencyId,
			generatedBy: userId,
			copyType: post.copyType,
			title: post.title,
			content: post.content,
			targetKeyword: post.targetKeyword,
			actualWordCount: post.actualWordCount,
			status: post.status,
			promptTokens: post.promptTokens,
			completionTokens: post.completionTokens,
			modelUsed: post.modelUsed,
			generationConfig: post.generationConfig,
			contextSources: { brand_profile_id: brandProfileId },
			createdAt: post.createdAt,
		});
	}

	return {
		success: true,
		created: {
			clientId,
			consultationId,
			proposalId,
			contractId,
			invoiceId,
			quotationId,
		},
		// Include info about linked packages/addons (helps user understand if they need to create these first)
		linkedPackage: selectedPackage ? { id: selectedPackage.id, name: selectedPackage.name } : null,
		linkedAddons: availableAddons.map((a) => ({ id: a.id, name: a.name })),
		note:
			!selectedPackage && selectedAddonIds.length === 0
				? "No packages or addons found. Create packages in Settings > Packages to see them in the demo proposal."
				: undefined,
	};
});

/**
 * Clear all demo data for the current agency.
 * Deletes entities in reverse order to handle foreign key constraints:
 * Quotation Scope Sections → Quotations → Invoice Line Items → Invoices → Contracts → Proposals → Consultations → Clients
 */
export const clearDemoData = command(async () => {
	const { agencyId } = await getAgencyContext();

	// Find all demo consultations (identified by "Demo:" prefix in business name)
	const demoConsultations = await db
		.select({ id: consultations.id })
		.from(consultations)
		.where(and(eq(consultations.agencyId, agencyId), like(consultations.businessName, "Demo:%")));

	if (demoConsultations.length === 0) {
		return { success: true, deleted: 0 };
	}

	const consultationIds = demoConsultations.map((c) => c.id);

	// Find all proposals linked to demo consultations
	const demoProposals = await db
		.select({ id: proposals.id })
		.from(proposals)
		.where(
			and(eq(proposals.agencyId, agencyId), inArray(proposals.consultationId, consultationIds)),
		);

	const proposalIds = demoProposals.map((p) => p.id);

	// Find all contracts linked to demo proposals
	let contractIds: string[] = [];
	if (proposalIds.length > 0) {
		const demoContracts = await db
			.select({ id: contracts.id })
			.from(contracts)
			.where(and(eq(contracts.agencyId, agencyId), inArray(contracts.proposalId, proposalIds)));
		contractIds = demoContracts.map((c) => c.id);
	}

	// Find all invoices linked to demo proposals/contracts
	let invoiceIds: string[] = [];
	if (proposalIds.length > 0) {
		const demoInvoices = await db
			.select({ id: invoices.id })
			.from(invoices)
			.where(and(eq(invoices.agencyId, agencyId), inArray(invoices.proposalId, proposalIds)));
		invoiceIds = demoInvoices.map((i) => i.id);
	}

	// Find all demo quotations (linked to demo clients)
	const demoClients = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.agencyId, agencyId), like(clients.businessName, "Demo:%")));
	const clientIds = demoClients.map((c) => c.id);

	let quotationIds: string[] = [];
	if (clientIds.length > 0) {
		const demoQuotations = await db
			.select({ id: quotations.id })
			.from(quotations)
			.where(and(eq(quotations.agencyId, agencyId), inArray(quotations.clientId, clientIds)));
		quotationIds = demoQuotations.map((q) => q.id);
	}

	// Delete in reverse order of foreign key dependencies

	// Content intelligence cleanup (before entity deletions)
	if (clientIds.length > 0) {
		await db.delete(contentCopy).where(inArray(contentCopy.clientId, clientIds));
		await db.delete(seoIssues).where(inArray(seoIssues.clientId, clientIds));
		await db.delete(seoAudits).where(inArray(seoAudits.clientId, clientIds));
		await db.delete(brandProfiles).where(inArray(brandProfiles.clientId, clientIds));
		await db.delete(contentChunks).where(inArray(contentChunks.clientId, clientIds));
		await db.delete(contentPages).where(inArray(contentPages.clientId, clientIds));
		await db.delete(contentCrawlJobs).where(inArray(contentCrawlJobs.clientId, clientIds));
	}

	// 1. Delete quotation scope sections (child of quotations)
	if (quotationIds.length > 0) {
		await db
			.delete(quotationScopeSections)
			.where(inArray(quotationScopeSections.quotationId, quotationIds));
	}

	// 2. Delete quotations
	if (quotationIds.length > 0) {
		await db.delete(quotations).where(inArray(quotations.id, quotationIds));
	}

	// 3. Delete invoice line items
	if (invoiceIds.length > 0) {
		await db.delete(invoiceLineItems).where(inArray(invoiceLineItems.invoiceId, invoiceIds));
	}

	// 4. Delete invoices
	if (invoiceIds.length > 0) {
		await db.delete(invoices).where(inArray(invoices.id, invoiceIds));
	}

	// 5. Delete contracts
	if (contractIds.length > 0) {
		await db.delete(contracts).where(inArray(contracts.id, contractIds));
	}

	// 6. Delete proposals
	if (proposalIds.length > 0) {
		await db.delete(proposals).where(inArray(proposals.id, proposalIds));
	}

	// 7. Delete consultations
	await db.delete(consultations).where(inArray(consultations.id, consultationIds));

	// 8. Delete demo clients (identified by "Demo:" prefix in business name)
	const deletedClients = await db
		.delete(clients)
		.where(and(eq(clients.agencyId, agencyId), like(clients.businessName, "Demo:%")))
		.returning({ id: clients.id });

	return {
		success: true,
		deleted: {
			clients: deletedClients.length,
			consultations: consultationIds.length,
			proposals: proposalIds.length,
			contracts: contractIds.length,
			invoices: invoiceIds.length,
			quotations: quotationIds.length,
		},
	};
});

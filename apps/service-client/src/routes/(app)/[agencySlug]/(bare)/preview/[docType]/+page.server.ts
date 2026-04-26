/**
 * Branding Preview Route — `/[agencySlug]/preview/[docType]`
 *
 * Renders a document of the chosen type with live branding so agency
 * members can see how their branding overrides will look before they
 * create real documents. This route is the target of the iframe embedded
 * under each branding tab (Phase 2.5) and will eventually receive
 * branding-override updates via postMessage (Phase 2.3).
 *
 * Data strategy (Phase 2.2): for each docType we try to fetch the
 * agency's most recent record of that type. If none exists, we fall
 * back to a sparse inline stub — the component renders "with holes"
 * (optional sections skipped by `{#if}` guards). Phase 2.4 introduces
 * a dedicated `ensureDemoData(agencyId)` helper that guarantees full-
 * fidelity demo rows. Until then, the route is deliberately tolerant
 * of missing demo data so it works end-to-end against any agency.
 *
 * Auth scoping: inherited from `[agencySlug]/+layout.server.ts`, which
 * enforces that `locals.user` has an active membership on the agency
 * identified by the slug. The `@(app)` layout reset in this sub-group
 * only skips the sidebar CHROME — it does not skip the AUTH load.
 */

import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import {
	proposals,
	contracts,
	invoices,
	invoiceLineItems,
	quotations,
	quotationScopeSections,
	formSubmissions,
	agencyForms,
	agencies,
	agencyProfiles,
	type DocumentType,
} from "$lib/server/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import {
	getEffectiveBranding,
	getEffectiveProposalBranding,
} from "$lib/server/document-branding";

const ALLOWED_DOC_TYPES: DocumentType[] = [
	"proposal",
	"contract",
	"invoice",
	"quotation",
	"questionnaire",
	"email",
];

export const load: PageServerLoad = async ({ params }) => {
	const { agencySlug, docType } = params;
	if (!ALLOWED_DOC_TYPES.includes(docType as DocumentType)) {
		throw error(404, `Unknown document type: ${docType}`);
	}

	// Fetch the agency by slug. The membership check in
	// [agencySlug]/+layout.server.ts has already enforced that the current
	// user is a member of this agency — this is a pure read-after-auth.
	const [agencyRow] = await db.select().from(agencies).where(eq(agencies.slug, agencySlug)).limit(1);
	if (!agencyRow) throw error(404, "Agency not found");

	const agencyId = agencyRow.id;

	// Strip branding fields from the returned `agency` to match the shape
	// the Document components consume — same contract as the public routes.
	const {
		logoUrl: _logoUrl,
		primaryColor: _primaryColor,
		secondaryColor: _secondaryColor,
		accentColor: _accentColor,
		accentGradient: _accentGradient,
		...agency
	} = agencyRow;

	// Resolve effective branding per doc type.
	const branding =
		docType === "proposal"
			? await getEffectiveProposalBranding(agencyId)
			: await getEffectiveBranding(agencyId, docType as DocumentType);

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, agencyId))
		.limit(1);

	// Per-doc-type data fetch. Each branch returns the shape the
	// corresponding Document component expects, minus the injected
	// `branding` (returned alongside below).
	switch (docType) {
		case "proposal": {
			const [proposal] = await db
				.select()
				.from(proposals)
				.where(eq(proposals.agencyId, agencyId))
				.orderBy(desc(proposals.createdAt))
				.limit(1);

			return {
				docType,
				branding,
				agency,
				profile,
				proposal: proposal ?? stubProposal(agencyId),
				selectedPackage: null,
				selectedAddons: [],
				isPreview: true,
			};
		}

		case "contract": {
			const [contract] = await db
				.select()
				.from(contracts)
				.where(eq(contracts.agencyId, agencyId))
				.orderBy(desc(contracts.createdAt))
				.limit(1);

			return {
				docType,
				branding,
				agency,
				profile,
				contract: contract ?? stubContract(agencyId),
				includedSchedules: [],
				isPreview: true,
			};
		}

		case "invoice": {
			const [invoice] = await db
				.select()
				.from(invoices)
				.where(eq(invoices.agencyId, agencyId))
				.orderBy(desc(invoices.createdAt))
				.limit(1);

			const lineItems = invoice
				? await db
						.select()
						.from(invoiceLineItems)
						.where(eq(invoiceLineItems.invoiceId, invoice.id))
						.orderBy(asc(invoiceLineItems.sortOrder))
				: [];

			return {
				docType,
				branding,
				agency,
				profile,
				invoice: invoice ?? stubInvoice(agencyId),
				lineItems,
			};
		}

		case "quotation": {
			const [quotation] = await db
				.select()
				.from(quotations)
				.where(eq(quotations.agencyId, agencyId))
				.orderBy(desc(quotations.createdAt))
				.limit(1);

			const sections = quotation
				? await db
						.select()
						.from(quotationScopeSections)
						.where(eq(quotationScopeSections.quotationId, quotation.id))
						.orderBy(asc(quotationScopeSections.sortOrder))
				: [];

			return {
				docType,
				branding,
				agency,
				profile,
				quotation: quotation ? { ...quotation, effectiveStatus: quotation.status } : stubQuotation(agencyId),
				sections,
			};
		}

		case "questionnaire": {
			// Find the agency's most recent form template.
			const [form] = await db
				.select()
				.from(agencyForms)
				.where(eq(agencyForms.agencyId, agencyId))
				.orderBy(desc(agencyForms.createdAt))
				.limit(1);

			// Find a submission for this form if one exists; otherwise stub.
			const [submission] = form
				? await db
						.select()
						.from(formSubmissions)
						.where(
							and(
								inArray(formSubmissions.formId, [form.id]),
								eq(formSubmissions.status, "draft"),
							),
						)
						.orderBy(desc(formSubmissions.createdAt))
						.limit(1)
				: [];

			return {
				docType,
				branding,
				agency,
				form: form ?? stubForm(agencyId),
				submission: submission ?? stubSubmission(),
			};
		}

		case "email": {
			// Phase 2.6 handles email via srcdoc — this branch is a no-op for 2.2
			// and will be filled in when the email preview component lands.
			return {
				docType,
				branding,
				agency,
				profile,
			};
		}
	}

	// Unreachable — DocumentType is exhaustive above, TypeScript narrows it.
	throw error(500, "Unreachable preview branch");
};

/* ------------------------------------------------------------------------- */
/* Sparse inline stubs — used only when the agency has no document of the    */
/* requested type yet. Phase 2.4 replaces with seeded demo rows. Each stub   */
/* is intentionally minimal: just enough shape for the component to mount    */
/* without throwing, with optional sections skipped by the component's own   */
/* {#if} guards.                                                             */
/* ------------------------------------------------------------------------- */

function stubProposal(agencyId: string) {
	return {
		id: "preview-stub",
		agencyId,
		consultationId: null,
		clientId: null,
		slug: "preview-stub",
		proposalNumber: "PREVIEW",
		title: "Preview: Website Redesign Proposal",
		clientBusinessName: "Demo Client",
		clientContactName: null,
		clientEmail: null,
		clientPhone: null,
		clientWebsite: null,
		status: "sent",
		coverImage: null,
		performanceData: null,
		currentIssues: [],
		roiAnalysis: null,
		performanceStandards: [],
		proposedPages: [],
		timeline: [],
		customPricing: null,
		selectedPackageId: null,
		selectedAddons: [],
		seoSummary: null,
		opportunityContent: null,
		localAdvantageContent: null,
		closingContent: null,
		executiveSummary: null,
		validUntil: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		sentAt: null,
		viewCount: 0,
		lastViewedAt: null,
		acceptedAt: null,
		declinedAt: null,
		revisionRequestedAt: null,
	} as unknown as typeof proposals.$inferSelect;
}

function stubContract(agencyId: string) {
	return {
		id: "preview-stub",
		agencyId,
		clientId: null,
		proposalId: null,
		slug: "preview-stub",
		contractNumber: "PREVIEW",
		status: "sent",
		clientBusinessName: "Demo Client",
		clientContactName: null,
		clientEmail: null,
		clientPhone: null,
		clientAddress: null,
		visibleFields: [],
		includedScheduleIds: [],
		servicesDescription: null,
		generatedTermsHtml: null,
		generatedScheduleHtml: null,
		specialConditions: null,
		totalPrice: "0",
		priceIncludesGst: true,
		paymentTerms: null,
		commencementDate: null,
		completionDate: null,
		validUntil: null,
		agencySignatoryName: null,
		agencySignatoryTitle: null,
		agencySignedAt: null,
		clientSignatoryName: null,
		clientSignatoryTitle: null,
		clientSignedAt: null,
		clientSignatureIp: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		sentAt: null,
		viewCount: 0,
		lastViewedAt: null,
	} as unknown as typeof contracts.$inferSelect;
}

function stubInvoice(agencyId: string) {
	return {
		id: "preview-stub",
		agencyId,
		clientId: null,
		slug: "preview-stub",
		invoiceNumber: "PREVIEW",
		status: "sent",
		clientBusinessName: "Demo Client",
		clientContactName: null,
		clientEmail: null,
		clientPhone: null,
		clientAddress: null,
		clientAbn: null,
		issueDate: new Date(),
		dueDate: new Date(),
		paymentTerms: "NET_7",
		paymentTermsCustom: null,
		subtotal: "0",
		discountAmount: "0",
		discountDescription: null,
		gstRate: "10",
		gstAmount: "0",
		gstRegistered: false,
		total: "0",
		publicNotes: null,
		onlinePaymentEnabled: false,
		stripePaymentLinkUrl: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		paidAt: null,
		viewCount: 0,
		lastViewedAt: null,
	} as unknown as typeof invoices.$inferSelect;
}

function stubQuotation(agencyId: string) {
	return {
		id: "preview-stub",
		agencyId,
		slug: "preview-stub",
		quotationNumber: "PREVIEW",
		status: "sent",
		effectiveStatus: "sent",
		clientBusinessName: "Demo Client",
		clientContactName: null,
		clientEmail: null,
		clientPhone: null,
		clientAddress: null,
		preparedDate: new Date(),
		expiryDate: null,
		siteAddress: null,
		siteReference: null,
		subtotal: "0",
		discountAmount: "0",
		discountDescription: null,
		gstRate: "10",
		gstAmount: "0",
		gstRegistered: false,
		total: "0",
		termsBlocks: [],
		optionsNotes: null,
		acceptedByName: null,
		acceptedByTitle: null,
		acceptedAt: null,
		declinedAt: null,
		declineReason: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		viewCount: 0,
		lastViewedAt: null,
	} as unknown as typeof quotations.$inferSelect & { effectiveStatus: string };
}

function stubForm(agencyId: string) {
	return {
		id: "preview-stub",
		agencyId,
		slug: "preview-stub",
		name: "Preview Form",
		description: "Sample form for branding preview",
		schema: JSON.stringify({
			version: 1,
			steps: [
				{
					title: "Sample Step",
					fields: [
						{ name: "sample", type: "text", label: "Sample field", required: false },
					],
				},
			],
		}),
		uiConfig: null,
		status: "active",
		createdAt: new Date(),
		updatedAt: new Date(),
	} as unknown as typeof agencyForms.$inferSelect;
}

function stubSubmission() {
	return {
		id: "preview-stub",
		formId: "preview-stub",
		slug: "preview-stub",
		status: "draft",
		currentStep: 0,
		data: {},
		completionPercentage: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as unknown as typeof formSubmissions.$inferSelect;
}

/**
 * Quotation Types
 *
 * Shared types for quotation remote functions and UI components.
 * Separated from .remote.ts because remote files can only export
 * query()/command() functions.
 */

/** A single terms block stored in quotation.termsBlocks JSONB */
export interface TermsBlock {
	title: string;
	content: string;
	sortOrder: number;
}

/** Input for a scope section when creating/updating a quotation */
export interface ScopeSectionInput {
	title: string;
	workItems: string[];
	sectionPrice: string;
	scopeTemplateId?: string | null;
	sortOrder: number;
}

/** Quotation with its scope sections (returned by getQuotation) */
export interface QuotationWithSections {
	quotation: {
		id: string;
		agencyId: string;
		clientId: string | null;
		templateId: string | null;
		quotationNumber: string;
		slug: string;
		quotationName: string;
		status: string;
		clientBusinessName: string;
		clientContactName: string;
		clientEmail: string;
		clientPhone: string;
		clientAddress: string;
		siteAddress: string;
		siteReference: string;
		preparedDate: Date;
		expiryDate: Date;
		subtotal: string;
		discountAmount: string;
		discountDescription: string;
		gstAmount: string;
		total: string;
		gstRegistered: boolean;
		gstRate: string;
		termsBlocks: TermsBlock[];
		optionsNotes: string;
		notes: string;
		viewCount: number;
		lastViewedAt: Date | null;
		sentAt: Date | null;
		declinedAt: Date | null;
		declineReason: string;
		acceptedByName: string | null;
		acceptedByTitle: string | null;
		acceptedAt: Date | null;
		acceptanceIp: string | null;
		createdBy: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
	sections: {
		id: string;
		quotationId: string;
		title: string;
		workItems: string[];
		sectionPrice: string | null;
		sectionGst: string | null;
		sectionTotal: string | null;
		sortOrder: number;
		scopeTemplateId: string | null;
		createdAt: Date;
	}[];
	creatorName?: string | null;
}

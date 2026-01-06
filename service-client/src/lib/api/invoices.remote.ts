/**
 * Invoices Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for invoice operations.
 * Handles invoice creation (standalone or from proposals/contracts),
 * payment recording, and status tracking.
 *
 * Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import {
	invoices,
	invoiceLineItems,
	proposals,
	contracts,
	agencies,
	agencyProfiles,
	agencyPackages,
	agencyAddons,
	type Invoice
} from '$lib/server/schema';
import { getAgencyContext } from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import {
	hasPermission,
	canAccessResource,
	canModifyResource,
	canDeleteResource
} from '$lib/server/permissions';
import { eq, and, desc, asc, gte, lte, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// =============================================================================
// Validation Schemas
// =============================================================================

const InvoiceStatusSchema = v.picklist([
	'draft',
	'sent',
	'viewed',
	'paid',
	'overdue',
	'cancelled',
	'refunded'
]);

const PaymentMethodSchema = v.picklist(['bank_transfer', 'card', 'cash', 'other']);

const PaymentTermsSchema = v.picklist(['DUE_ON_RECEIPT', 'NET_7', 'NET_14', 'NET_30', 'CUSTOM']);

const LineItemSchema = v.object({
	description: v.pipe(v.string(), v.minLength(1)),
	quantity: v.string(),
	unitPrice: v.string(),
	isTaxable: v.optional(v.boolean(), true),
	category: v.optional(v.string()),
	packageId: v.optional(v.nullable(v.string())),
	addonId: v.optional(v.nullable(v.string()))
});

const CreateInvoiceSchema = v.object({
	proposalId: v.optional(v.pipe(v.string(), v.uuid())),
	contractId: v.optional(v.pipe(v.string(), v.uuid())),
	clientBusinessName: v.pipe(v.string(), v.minLength(1)),
	clientContactName: v.optional(v.string()),
	clientEmail: v.pipe(v.string(), v.email()),
	clientPhone: v.optional(v.string()),
	clientAddress: v.optional(v.string()),
	clientAbn: v.optional(v.string()),
	issueDate: v.optional(v.string()),
	dueDate: v.optional(v.string()),
	paymentTerms: v.optional(PaymentTermsSchema),
	paymentTermsCustom: v.optional(v.string()),
	notes: v.optional(v.string()),
	publicNotes: v.optional(v.string()),
	discountAmount: v.optional(v.string()),
	discountDescription: v.optional(v.string()),
	lineItems: v.array(LineItemSchema)
});

const UpdateInvoiceSchema = v.object({
	invoiceId: v.pipe(v.string(), v.uuid()),
	clientBusinessName: v.optional(v.string()),
	clientContactName: v.optional(v.string()),
	clientEmail: v.optional(v.pipe(v.string(), v.email())),
	clientPhone: v.optional(v.string()),
	clientAddress: v.optional(v.string()),
	clientAbn: v.optional(v.string()),
	issueDate: v.optional(v.string()),
	dueDate: v.optional(v.string()),
	paymentTerms: v.optional(v.string()),
	paymentTermsCustom: v.optional(v.string()),
	notes: v.optional(v.string()),
	publicNotes: v.optional(v.string()),
	discountAmount: v.optional(v.string()),
	discountDescription: v.optional(v.string()),
	lineItems: v.optional(v.array(LineItemSchema))
});

const RecordPaymentSchema = v.object({
	invoiceId: v.pipe(v.string(), v.uuid()),
	paymentMethod: PaymentMethodSchema,
	paymentReference: v.optional(v.string()),
	paymentNotes: v.optional(v.string()),
	paidAt: v.optional(v.string())
});

const InvoiceFiltersSchema = v.object({
	status: v.optional(InvoiceStatusSchema),
	fromDate: v.optional(v.string()),
	toDate: v.optional(v.string()),
	search: v.optional(v.string())
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique public slug for the invoice.
 */
async function generateUniqueSlug(): Promise<string> {
	let slug = nanoid(12);
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const existing = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.slug, slug)).limit(1);

		if (existing.length === 0) {
			return slug;
		}

		slug = nanoid(12);
		attempts++;
	}

	// Fallback: use timestamp-based slug
	return `inv-${Date.now()}-${nanoid(6)}`;
}

/**
 * Generate invoice number based on agency prefix and sequence.
 */
function generateInvoiceNumber(prefix: string, nextNumber: number): string {
	const year = new Date().getFullYear();
	const paddedNumber = String(nextNumber).padStart(4, '0');
	return `${prefix}-${year}-${paddedNumber}`;
}

/**
 * Calculate due date based on payment terms.
 */
function calculateDueDate(issueDate: Date, paymentTerms: string): Date {
	const due = new Date(issueDate);

	switch (paymentTerms) {
		case 'DUE_ON_RECEIPT':
			return due;
		case 'NET_7':
			due.setDate(due.getDate() + 7);
			return due;
		case 'NET_14':
			due.setDate(due.getDate() + 14);
			return due;
		case 'NET_30':
			due.setDate(due.getDate() + 30);
			return due;
		default:
			due.setDate(due.getDate() + 14); // Default to NET_14
			return due;
	}
}

/**
 * Calculate invoice totals from line items.
 */
function calculateInvoiceTotals(
	lineItems: Array<{ amount: string; isTaxable?: boolean }>,
	gstRegistered: boolean,
	gstRate: number,
	discountAmount: number = 0
): { subtotal: number; gstAmount: number; total: number } {
	const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);

	const taxableAmount = lineItems
		.filter((item) => item.isTaxable !== false)
		.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);

	const gstAmount = gstRegistered ? taxableAmount * (gstRate / 100) : 0;

	const total = subtotal - discountAmount + gstAmount;

	return {
		subtotal: Math.round(subtotal * 100) / 100,
		gstAmount: Math.round(gstAmount * 100) / 100,
		total: Math.round(total * 100) / 100
	};
}

// =============================================================================
// Helper: Check and Update Overdue Status
// =============================================================================

/**
 * Check if an invoice is overdue and update its status if needed.
 * Returns the invoice with potentially updated status.
 */
async function checkAndUpdateOverdueStatus<T extends { id: string; status: string; dueDate: Date }>(
	invoice: T
): Promise<T> {
	// Only check invoices that are sent or viewed (not draft, paid, cancelled, etc.)
	if (!['sent', 'viewed'].includes(invoice.status)) {
		return invoice;
	}

	const now = new Date();
	const dueDate = new Date(invoice.dueDate);

	// Set dueDate to end of day for comparison
	dueDate.setHours(23, 59, 59, 999);

	if (now > dueDate) {
		// Update status in database
		await db.update(invoices).set({ status: 'overdue', updatedAt: new Date() }).where(eq(invoices.id, invoice.id));

		// Return invoice with updated status
		return { ...invoice, status: 'overdue' };
	}

	return invoice;
}

/**
 * Check and update overdue status for multiple invoices.
 */
async function checkAndUpdateOverdueStatusBatch<T extends { id: string; status: string; dueDate: Date }>(
	invoiceList: T[]
): Promise<T[]> {
	const results: T[] = [];

	for (const invoice of invoiceList) {
		results.push(await checkAndUpdateOverdueStatus(invoice));
	}

	return results;
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get all invoices for the agency with optional filters.
 */
export const getInvoices = query(InvoiceFiltersSchema, async (filters) => {
	const context = await getAgencyContext();

	const conditions = [eq(invoices.agencyId, context.agencyId)];

	if (filters.status) {
		conditions.push(eq(invoices.status, filters.status));
	}

	if (filters.fromDate) {
		conditions.push(gte(invoices.issueDate, new Date(filters.fromDate)));
	}

	if (filters.toDate) {
		conditions.push(lte(invoices.issueDate, new Date(filters.toDate)));
	}

	// Check permissions for view scope
	const canViewAll = hasPermission(context.role, 'invoice:view_all');
	if (!canViewAll) {
		conditions.push(eq(invoices.createdBy, context.userId));
	}

	const results = await db
		.select()
		.from(invoices)
		.where(and(...conditions))
		.orderBy(desc(invoices.createdAt));

	// Check and update overdue status for all invoices
	const updatedResults = await checkAndUpdateOverdueStatusBatch(results);

	// If there's a search term, filter in JS (simpler than ILIKE)
	if (filters.search) {
		const searchLower = filters.search.toLowerCase();
		return updatedResults.filter(
			(inv) =>
				inv.invoiceNumber.toLowerCase().includes(searchLower) ||
				inv.clientBusinessName.toLowerCase().includes(searchLower) ||
				inv.clientEmail.toLowerCase().includes(searchLower)
		);
	}

	return updatedResults;
});

/**
 * Get a single invoice by ID with line items.
 */
export const getInvoice = query(v.pipe(v.string(), v.uuid()), async (invoiceId) => {
	const context = await getAgencyContext();

	const [invoice] = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.agencyId, context.agencyId)))
		.limit(1);

	if (!invoice) {
		throw new Error('Invoice not found');
	}

	// Check access permission
	if (!canAccessResource(context.role, invoice.createdBy || '', context.userId, 'invoice')) {
		throw new Error('Permission denied');
	}

	// Check and update overdue status
	const updatedInvoice = await checkAndUpdateOverdueStatus(invoice);

	// Get line items
	const lineItems = await db
		.select()
		.from(invoiceLineItems)
		.where(eq(invoiceLineItems.invoiceId, invoiceId))
		.orderBy(asc(invoiceLineItems.sortOrder));

	return { invoice: updatedInvoice, lineItems };
});

/**
 * Get invoice by public slug (for public view).
 */
export const getInvoiceBySlug = query(v.pipe(v.string(), v.minLength(1)), async (slug) => {
	const [invoice] = await db.select().from(invoices).where(eq(invoices.slug, slug)).limit(1);

	if (!invoice) {
		return null;
	}

	// Check and update overdue status
	const updatedInvoice = await checkAndUpdateOverdueStatus(invoice);

	// Get line items
	const lineItems = await db
		.select()
		.from(invoiceLineItems)
		.where(eq(invoiceLineItems.invoiceId, invoice.id))
		.orderBy(asc(invoiceLineItems.sortOrder));

	// Get agency info for display
	const [agency] = await db.select().from(agencies).where(eq(agencies.id, invoice.agencyId)).limit(1);

	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, invoice.agencyId))
		.limit(1);

	return { invoice: updatedInvoice, lineItems, agency, profile };
});

/**
 * Get invoice statistics for dashboard.
 */
export const getInvoiceStats = query(v.object({}), async () => {
	const context = await getAgencyContext();

	const allInvoices = await db
		.select({
			status: invoices.status,
			total: invoices.total,
			dueDate: invoices.dueDate
		})
		.from(invoices)
		.where(eq(invoices.agencyId, context.agencyId));

	const stats = {
		draftCount: 0,
		draftTotal: 0,
		awaitingCount: 0,
		awaitingTotal: 0,
		overdueCount: 0,
		overdueTotal: 0,
		paidCount: 0,
		paidTotal: 0
	};

	const now = new Date();

	for (const inv of allInvoices) {
		const amount = parseFloat(inv.total);

		// Check if sent/viewed invoices are actually overdue
		let effectiveStatus = inv.status;
		if (['sent', 'viewed'].includes(inv.status)) {
			const dueDate = new Date(inv.dueDate);
			dueDate.setHours(23, 59, 59, 999);
			if (now > dueDate) {
				effectiveStatus = 'overdue';
			}
		}

		switch (effectiveStatus) {
			case 'draft':
				stats.draftCount++;
				stats.draftTotal += amount;
				break;
			case 'sent':
			case 'viewed':
				stats.awaitingCount++;
				stats.awaitingTotal += amount;
				break;
			case 'paid':
				stats.paidCount++;
				stats.paidTotal += amount;
				break;
			case 'overdue':
				stats.overdueCount++;
				stats.overdueTotal += amount;
				break;
		}
	}

	return stats;
});

// =============================================================================
// Command Functions
// =============================================================================

/**
 * Create a standalone invoice.
 */
export const createInvoice = command(CreateInvoiceSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:create')) {
		throw new Error('Permission denied');
	}

	// Get agency profile for GST/payment settings
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Generate invoice number
	const invoiceNumber = generateInvoiceNumber(
		profile?.invoicePrefix || 'INV',
		profile?.nextInvoiceNumber || 1
	);

	// Generate slug
	const slug = await generateUniqueSlug();

	// Calculate dates
	const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
	const paymentTerms = data.paymentTerms || profile?.defaultPaymentTerms || 'NET_14';
	const dueDate = data.dueDate ? new Date(data.dueDate) : calculateDueDate(issueDate, paymentTerms);

	// Calculate line item amounts
	const lineItemsWithAmounts = data.lineItems.map((item, index) => ({
		...item,
		amount: (parseFloat(item.quantity || '1') * parseFloat(item.unitPrice || '0')).toFixed(2),
		sortOrder: index,
		isTaxable: item.isTaxable ?? true
	}));

	// Calculate totals
	const discountAmount = parseFloat(data.discountAmount || '0');
	const { subtotal, gstAmount, total } = calculateInvoiceTotals(
		lineItemsWithAmounts,
		profile?.gstRegistered ?? true,
		parseFloat(profile?.gstRate || '10.00'),
		discountAmount
	);

	// Create invoice
	const [invoice] = await db
		.insert(invoices)
		.values({
			agencyId: context.agencyId,
			proposalId: data.proposalId || null,
			contractId: data.contractId || null,
			invoiceNumber,
			slug,
			status: 'draft',
			clientBusinessName: data.clientBusinessName,
			clientContactName: data.clientContactName || '',
			clientEmail: data.clientEmail,
			clientPhone: data.clientPhone || '',
			clientAddress: data.clientAddress || '',
			clientAbn: data.clientAbn || '',
			issueDate,
			dueDate,
			subtotal: subtotal.toFixed(2),
			discountAmount: discountAmount.toFixed(2),
			discountDescription: data.discountDescription || '',
			gstAmount: gstAmount.toFixed(2),
			total: total.toFixed(2),
			gstRegistered: profile?.gstRegistered ?? true,
			gstRate: profile?.gstRate || '10.00',
			paymentTerms,
			paymentTermsCustom: data.paymentTermsCustom || '',
			notes: data.notes || '',
			publicNotes: data.publicNotes || '',
			createdBy: context.userId
		})
		.returning();

	if (!invoice) {
		throw new Error('Failed to create invoice');
	}

	// Create line items
	for (const item of lineItemsWithAmounts) {
		await db.insert(invoiceLineItems).values({
			invoiceId: invoice.id,
			description: item.description,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			amount: item.amount,
			isTaxable: item.isTaxable,
			sortOrder: item.sortOrder,
			category: item.category || null,
			packageId: item.packageId || null,
			addonId: item.addonId || null
		});
	}

	// Increment invoice number
	if (profile) {
		await db
			.update(agencyProfiles)
			.set({ nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1 })
			.where(eq(agencyProfiles.id, profile.id));
	}

	// Log activity
	await logActivity('invoice.created', 'invoice', invoice.id, {
		newValues: { invoiceNumber }
	});

	return invoice;
});

/**
 * Create invoice from accepted proposal.
 */
export const createInvoiceFromProposal = command(v.pipe(v.string(), v.uuid()), async (proposalId) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:create')) {
		throw new Error('Permission denied');
	}

	// Load proposal
	const [proposal] = await db
		.select()
		.from(proposals)
		.where(and(eq(proposals.id, proposalId), eq(proposals.agencyId, context.agencyId)))
		.limit(1);

	if (!proposal) {
		throw new Error('Proposal not found');
	}

	if (proposal.status !== 'accepted') {
		throw new Error('Can only create invoice from accepted proposal');
	}

	// Get agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Generate invoice number
	const invoiceNumber = generateInvoiceNumber(
		profile?.invoicePrefix || 'INV',
		profile?.nextInvoiceNumber || 1
	);

	const slug = await generateUniqueSlug();
	const issueDate = new Date();
	const paymentTerms = profile?.defaultPaymentTerms || 'NET_14';
	const dueDate = calculateDueDate(issueDate, paymentTerms);

	// Build line items from proposal package
	const lineItems: Array<{
		description: string;
		quantity: string;
		unitPrice: string;
		amount: string;
		isTaxable: boolean;
		sortOrder: number;
		category: string | null;
		packageId: string | null;
		addonId: string | null;
	}> = [];

	// Get selected package
	if (proposal.selectedPackageId) {
		const [pkg] = await db
			.select()
			.from(agencyPackages)
			.where(eq(agencyPackages.id, proposal.selectedPackageId))
			.limit(1);

		if (pkg) {
			// Setup fee
			if (pkg.setupFee && parseFloat(pkg.setupFee) > 0) {
				lineItems.push({
					description: `${pkg.name} - Setup & Development`,
					quantity: '1.00',
					unitPrice: pkg.setupFee,
					amount: pkg.setupFee,
					isTaxable: true,
					sortOrder: lineItems.length,
					category: 'setup',
					packageId: pkg.id,
					addonId: null
				});
			}

			// One-time price (for lump sum)
			if (pkg.pricingModel === 'lump_sum' && pkg.oneTimePrice && parseFloat(pkg.oneTimePrice) > 0) {
				lineItems.push({
					description: `${pkg.name} - Website Development`,
					quantity: '1.00',
					unitPrice: pkg.oneTimePrice,
					amount: pkg.oneTimePrice,
					isTaxable: true,
					sortOrder: lineItems.length,
					category: 'development',
					packageId: pkg.id,
					addonId: null
				});
			}
		}
	}

	// Get selected addons
	const selectedAddonIds = (proposal.selectedAddons as string[]) || [];
	if (selectedAddonIds.length > 0) {
		const addons = await db
			.select()
			.from(agencyAddons)
			.where(inArray(agencyAddons.id, selectedAddonIds));

		for (const addon of addons) {
			if (addon.pricingType === 'one_time' && addon.price) {
				lineItems.push({
					description: addon.name,
					quantity: '1.00',
					unitPrice: addon.price,
					amount: addon.price,
					isTaxable: true,
					sortOrder: lineItems.length,
					category: 'addon',
					packageId: null,
					addonId: addon.id
				});
			}
		}
	}

	// If no items from package, use custom pricing if available
	const customPricing = proposal.customPricing as { setupFee?: string; oneTimePrice?: string } | null;
	if (lineItems.length === 0 && customPricing) {
		const customPrice = customPricing.setupFee || customPricing.oneTimePrice;
		if (customPrice && parseFloat(customPrice) > 0) {
			lineItems.push({
				description: 'Website Design & Development',
				quantity: '1.00',
				unitPrice: customPrice,
				amount: customPrice,
				isTaxable: true,
				sortOrder: 0,
				category: 'development',
				packageId: null,
				addonId: null
			});
		}
	}

	// Calculate totals
	const { subtotal, gstAmount, total } = calculateInvoiceTotals(
		lineItems,
		profile?.gstRegistered ?? true,
		parseFloat(profile?.gstRate || '10.00')
	);

	// Create invoice
	const [invoice] = await db
		.insert(invoices)
		.values({
			agencyId: context.agencyId,
			proposalId,
			invoiceNumber,
			slug,
			status: 'draft',
			clientBusinessName: proposal.clientBusinessName,
			clientContactName: proposal.clientContactName,
			clientEmail: proposal.clientEmail,
			clientPhone: proposal.clientPhone || '',
			clientAddress: '',
			clientAbn: '',
			issueDate,
			dueDate,
			subtotal: subtotal.toFixed(2),
			gstAmount: gstAmount.toFixed(2),
			total: total.toFixed(2),
			gstRegistered: profile?.gstRegistered ?? true,
			gstRate: profile?.gstRate || '10.00',
			paymentTerms,
			createdBy: context.userId
		})
		.returning();

	if (!invoice) {
		throw new Error('Failed to create invoice');
	}

	// Create line items
	for (const item of lineItems) {
		await db.insert(invoiceLineItems).values({
			invoiceId: invoice.id,
			...item
		});
	}

	// Increment invoice number
	if (profile) {
		await db
			.update(agencyProfiles)
			.set({ nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1 })
			.where(eq(agencyProfiles.id, profile.id));
	}

	await logActivity('invoice.created_from_proposal', 'invoice', invoice.id, {
		newValues: { invoiceNumber, proposalId }
	});

	return invoice;
});

/**
 * Create invoice from signed contract.
 */
export const createInvoiceFromContract = command(v.pipe(v.string(), v.uuid()), async (contractId) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:create')) {
		throw new Error('Permission denied');
	}

	// Load contract
	const [contract] = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.id, contractId), eq(contracts.agencyId, context.agencyId)))
		.limit(1);

	if (!contract) {
		throw new Error('Contract not found');
	}

	if (contract.status !== 'signed' && contract.status !== 'completed') {
		throw new Error('Can only create invoice from signed or completed contract');
	}

	// Get agency profile
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Generate invoice number
	const invoiceNumber = generateInvoiceNumber(
		profile?.invoicePrefix || 'INV',
		profile?.nextInvoiceNumber || 1
	);

	const slug = await generateUniqueSlug();
	const issueDate = new Date();
	const paymentTerms = profile?.defaultPaymentTerms || 'NET_14';
	const dueDate = calculateDueDate(issueDate, paymentTerms);

	// Create a single line item from contract total
	const lineItems = [
		{
			description: contract.servicesDescription || 'Services as per contract',
			quantity: '1.00',
			unitPrice: contract.totalPrice,
			amount: contract.totalPrice,
			isTaxable: true,
			sortOrder: 0,
			category: 'development' as const,
			packageId: null,
			addonId: null
		}
	];

	// Calculate totals
	const { subtotal, gstAmount, total } = calculateInvoiceTotals(
		lineItems,
		profile?.gstRegistered ?? true,
		parseFloat(profile?.gstRate || '10.00')
	);

	// Create invoice
	const [invoice] = await db
		.insert(invoices)
		.values({
			agencyId: context.agencyId,
			contractId,
			proposalId: contract.proposalId,
			invoiceNumber,
			slug,
			status: 'draft',
			clientBusinessName: contract.clientBusinessName,
			clientContactName: contract.clientContactName,
			clientEmail: contract.clientEmail,
			clientPhone: contract.clientPhone || '',
			clientAddress: contract.clientAddress || '',
			clientAbn: '',
			issueDate,
			dueDate,
			subtotal: subtotal.toFixed(2),
			gstAmount: gstAmount.toFixed(2),
			total: total.toFixed(2),
			gstRegistered: profile?.gstRegistered ?? true,
			gstRate: profile?.gstRate || '10.00',
			paymentTerms,
			createdBy: context.userId
		})
		.returning();

	if (!invoice) {
		throw new Error('Failed to create invoice');
	}

	// Create line items
	for (const item of lineItems) {
		await db.insert(invoiceLineItems).values({
			invoiceId: invoice.id,
			...item
		});
	}

	// Increment invoice number
	if (profile) {
		await db
			.update(agencyProfiles)
			.set({ nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1 })
			.where(eq(agencyProfiles.id, profile.id));
	}

	await logActivity('invoice.created_from_contract', 'invoice', invoice.id, {
		newValues: { invoiceNumber, contractId }
	});

	return invoice;
});

/**
 * Update an invoice (only draft status).
 */
export const updateInvoice = command(UpdateInvoiceSchema, async (data) => {
	const context = await getAgencyContext();

	const [invoice] = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, data.invoiceId), eq(invoices.agencyId, context.agencyId)))
		.limit(1);

	if (!invoice) {
		throw new Error('Invoice not found');
	}

	if (!canModifyResource(context.role, invoice.createdBy || '', context.userId, 'invoice')) {
		throw new Error('Permission denied');
	}

	// Allow editing for draft, sent, viewed, and overdue invoices
	// Block editing for paid, cancelled, and refunded invoices
	if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
		throw new Error('Cannot edit paid, cancelled, or refunded invoices');
	}

	// Get agency profile for GST
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	// Update line items if provided
	if (data.lineItems) {
		// Delete existing line items
		await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoice.id));

		// Insert new line items
		const lineItemsWithAmounts = data.lineItems.map((item, index) => ({
			...item,
			amount: (parseFloat(item.quantity || '1') * parseFloat(item.unitPrice || '0')).toFixed(2),
			sortOrder: index,
			isTaxable: item.isTaxable ?? true
		}));

		for (const item of lineItemsWithAmounts) {
			await db.insert(invoiceLineItems).values({
				invoiceId: invoice.id,
				description: item.description,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				amount: item.amount,
				isTaxable: item.isTaxable,
				sortOrder: item.sortOrder,
				category: item.category || null,
				packageId: item.packageId || null,
				addonId: item.addonId || null
			});
		}

		// Recalculate totals
		const discountAmount = parseFloat(data.discountAmount || invoice.discountAmount);
		const { subtotal, gstAmount, total } = calculateInvoiceTotals(
			lineItemsWithAmounts,
			profile?.gstRegistered ?? true,
			parseFloat(profile?.gstRate || '10.00'),
			discountAmount
		);

		// Update invoice with new totals
		await db
			.update(invoices)
			.set({
				subtotal: subtotal.toFixed(2),
				gstAmount: gstAmount.toFixed(2),
				total: total.toFixed(2),
				updatedAt: new Date()
			})
			.where(eq(invoices.id, invoice.id));
	}

	// Build update object
	const updateData: Partial<Invoice> = { updatedAt: new Date() };

	if (data.clientBusinessName !== undefined) updateData.clientBusinessName = data.clientBusinessName;
	if (data.clientContactName !== undefined) updateData.clientContactName = data.clientContactName;
	if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail;
	if (data.clientPhone !== undefined) updateData.clientPhone = data.clientPhone;
	if (data.clientAddress !== undefined) updateData.clientAddress = data.clientAddress;
	if (data.clientAbn !== undefined) updateData.clientAbn = data.clientAbn;
	if (data.issueDate !== undefined) updateData.issueDate = new Date(data.issueDate);
	if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
	if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
	if (data.paymentTermsCustom !== undefined) updateData.paymentTermsCustom = data.paymentTermsCustom;
	if (data.notes !== undefined) updateData.notes = data.notes;
	if (data.publicNotes !== undefined) updateData.publicNotes = data.publicNotes;
	if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
	if (data.discountDescription !== undefined) updateData.discountDescription = data.discountDescription;

	const [updated] = await db
		.update(invoices)
		.set(updateData)
		.where(eq(invoices.id, invoice.id))
		.returning();

	await logActivity('invoice.updated', 'invoice', invoice.id, {
		oldValues: invoice,
		newValues: updateData
	});

	return updated;
});

/**
 * Delete an invoice (only draft status).
 */
export const deleteInvoice = command(v.pipe(v.string(), v.uuid()), async (invoiceId) => {
	const context = await getAgencyContext();

	const [invoice] = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.agencyId, context.agencyId)))
		.limit(1);

	if (!invoice) {
		throw new Error('Invoice not found');
	}

	if (!canDeleteResource(context.role, invoice.createdBy || '', context.userId, 'invoice')) {
		throw new Error('Permission denied');
	}

	if (invoice.status !== 'draft') {
		throw new Error('Can only delete draft invoices');
	}

	// Delete line items first (cascade should handle this, but explicit)
	await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));

	// Delete invoice
	await db.delete(invoices).where(eq(invoices.id, invoiceId));

	await logActivity('invoice.deleted', 'invoice', invoiceId, {
		oldValues: { invoiceNumber: invoice.invoiceNumber }
	});

	return { success: true };
});

/**
 * Duplicate an existing invoice.
 */
export const duplicateInvoice = command(v.pipe(v.string(), v.uuid()), async (invoiceId) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:create')) {
		throw new Error('Permission denied');
	}

	const [original] = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.agencyId, context.agencyId)))
		.limit(1);

	if (!original) {
		throw new Error('Invoice not found');
	}

	// Get agency profile for new invoice number
	const [profile] = await db
		.select()
		.from(agencyProfiles)
		.where(eq(agencyProfiles.agencyId, context.agencyId))
		.limit(1);

	const invoiceNumber = generateInvoiceNumber(
		profile?.invoicePrefix || 'INV',
		profile?.nextInvoiceNumber || 1
	);
	const slug = await generateUniqueSlug();
	const issueDate = new Date();
	const dueDate = calculateDueDate(issueDate, original.paymentTerms);

	// Create new invoice
	const [newInvoice] = await db
		.insert(invoices)
		.values({
			agencyId: context.agencyId,
			invoiceNumber,
			slug,
			status: 'draft',
			clientBusinessName: original.clientBusinessName,
			clientContactName: original.clientContactName,
			clientEmail: original.clientEmail,
			clientPhone: original.clientPhone,
			clientAddress: original.clientAddress,
			clientAbn: original.clientAbn,
			issueDate,
			dueDate,
			subtotal: original.subtotal,
			discountAmount: original.discountAmount,
			discountDescription: original.discountDescription,
			gstAmount: original.gstAmount,
			total: original.total,
			gstRegistered: original.gstRegistered,
			gstRate: original.gstRate,
			paymentTerms: original.paymentTerms,
			paymentTermsCustom: original.paymentTermsCustom,
			notes: original.notes,
			publicNotes: original.publicNotes,
			createdBy: context.userId
		})
		.returning();

	if (!newInvoice) {
		throw new Error('Failed to duplicate invoice');
	}

	// Copy line items
	const originalLineItems = await db
		.select()
		.from(invoiceLineItems)
		.where(eq(invoiceLineItems.invoiceId, invoiceId))
		.orderBy(asc(invoiceLineItems.sortOrder));

	for (const item of originalLineItems) {
		await db.insert(invoiceLineItems).values({
			invoiceId: newInvoice.id,
			description: item.description,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			amount: item.amount,
			isTaxable: item.isTaxable,
			sortOrder: item.sortOrder,
			category: item.category,
			packageId: item.packageId,
			addonId: item.addonId
		});
	}

	// Increment invoice number
	if (profile) {
		await db
			.update(agencyProfiles)
			.set({ nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1 })
			.where(eq(agencyProfiles.id, profile.id));
	}

	await logActivity('invoice.duplicated', 'invoice', newInvoice.id, {
		newValues: { invoiceNumber, originalInvoiceId: invoiceId }
	});

	return newInvoice;
});

/**
 * Send invoice (mark as sent).
 */
export const sendInvoice = command(v.pipe(v.string(), v.uuid()), async (invoiceId) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:send')) {
		throw new Error('Permission denied');
	}

	const [invoice] = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.agencyId, context.agencyId)))
		.limit(1);

	if (!invoice) {
		throw new Error('Invoice not found');
	}

	if (invoice.status !== 'draft') {
		throw new Error('Can only send draft invoices');
	}

	const [updated] = await db
		.update(invoices)
		.set({
			status: 'sent',
			sentAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoiceId))
		.returning();

	await logActivity('invoice.sent', 'invoice', invoiceId, {
		newValues: { status: 'sent' }
	});

	return updated;
});

/**
 * Record view of public invoice.
 */
export const recordInvoiceView = command(v.pipe(v.string(), v.minLength(1)), async (slug) => {
	const [invoice] = await db.select().from(invoices).where(eq(invoices.slug, slug)).limit(1);

	if (!invoice) {
		return null;
	}

	const updateData: Partial<Invoice> = {
		viewCount: invoice.viewCount + 1,
		lastViewedAt: new Date(),
		updatedAt: new Date()
	};

	// If status is 'sent', change to 'viewed'
	if (invoice.status === 'sent') {
		updateData.status = 'viewed';
	}

	await db.update(invoices).set(updateData).where(eq(invoices.id, invoice.id));

	return { success: true };
});

/**
 * Record payment for an invoice.
 */
export const recordPayment = command(RecordPaymentSchema, async (data) => {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, 'invoice:record_payment')) {
		throw new Error('Permission denied');
	}

	const [invoice] = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, data.invoiceId), eq(invoices.agencyId, context.agencyId)))
		.limit(1);

	if (!invoice) {
		throw new Error('Invoice not found');
	}

	if (invoice.status === 'paid') {
		throw new Error('Invoice is already paid');
	}

	if (invoice.status === 'cancelled' || invoice.status === 'refunded') {
		throw new Error('Cannot record payment for cancelled or refunded invoice');
	}

	const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();

	const [updated] = await db
		.update(invoices)
		.set({
			status: 'paid',
			paidAt,
			paymentMethod: data.paymentMethod,
			paymentReference: data.paymentReference || null,
			paymentNotes: data.paymentNotes || null,
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoice.id))
		.returning();

	await logActivity('invoice.payment_recorded', 'invoice', invoice.id, {
		newValues: {
			paymentMethod: data.paymentMethod,
			paymentReference: data.paymentReference,
			paidAt
		}
	});

	return updated;
});

/**
 * Cancel an invoice.
 */
export const cancelInvoice = command(
	v.object({
		invoiceId: v.pipe(v.string(), v.uuid()),
		reason: v.optional(v.string())
	}),
	async (data) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, 'invoice:cancel')) {
			throw new Error('Permission denied');
		}

		const [invoice] = await db
			.select()
			.from(invoices)
			.where(and(eq(invoices.id, data.invoiceId), eq(invoices.agencyId, context.agencyId)))
			.limit(1);

		if (!invoice) {
			throw new Error('Invoice not found');
		}

		if (invoice.status === 'paid') {
			throw new Error('Cannot cancel a paid invoice. Use refund instead.');
		}

		if (invoice.status === 'cancelled') {
			throw new Error('Invoice is already cancelled');
		}

		const [updated] = await db
			.update(invoices)
			.set({
				status: 'cancelled',
				notes: data.reason ? `${invoice.notes}\n\nCancellation reason: ${data.reason}` : invoice.notes,
				updatedAt: new Date()
			})
			.where(eq(invoices.id, invoice.id))
			.returning();

		await logActivity('invoice.cancelled', 'invoice', invoice.id, {
			newValues: { status: 'cancelled', reason: data.reason }
		});

		return updated;
	}
);

/**
 * Refund an invoice (only paid invoices).
 */
export const refundInvoice = command(
	v.object({
		invoiceId: v.pipe(v.string(), v.uuid()),
		reason: v.optional(v.string())
	}),
	async (data) => {
		const context = await getAgencyContext();

		if (!hasPermission(context.role, 'invoice:refund')) {
			throw new Error('Permission denied');
		}

		const [invoice] = await db
			.select()
			.from(invoices)
			.where(and(eq(invoices.id, data.invoiceId), eq(invoices.agencyId, context.agencyId)))
			.limit(1);

		if (!invoice) {
			throw new Error('Invoice not found');
		}

		if (invoice.status !== 'paid') {
			throw new Error('Can only refund paid invoices');
		}

		const [updated] = await db
			.update(invoices)
			.set({
				status: 'refunded',
				notes: data.reason ? `${invoice.notes}\n\nRefund reason: ${data.reason}` : invoice.notes,
				updatedAt: new Date()
			})
			.where(eq(invoices.id, invoice.id))
			.returning();

		await logActivity('invoice.refunded', 'invoice', invoice.id, {
			newValues: { status: 'refunded', reason: data.reason }
		});

		return updated;
	}
);

/**
 * Recalculate invoice totals.
 */
export const recalculateInvoiceTotals = command(v.pipe(v.string(), v.uuid()), async (invoiceId) => {
	const context = await getAgencyContext();

	const [invoice] = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.agencyId, context.agencyId)))
		.limit(1);

	if (!invoice) {
		throw new Error('Invoice not found');
	}

	if (invoice.status !== 'draft') {
		throw new Error('Can only recalculate draft invoices');
	}

	// Get line items
	const lineItems = await db
		.select()
		.from(invoiceLineItems)
		.where(eq(invoiceLineItems.invoiceId, invoiceId));

	// Calculate totals
	const discountAmount = parseFloat(invoice.discountAmount);
	const { subtotal, gstAmount, total } = calculateInvoiceTotals(
		lineItems,
		invoice.gstRegistered,
		parseFloat(invoice.gstRate),
		discountAmount
	);

	const [updated] = await db
		.update(invoices)
		.set({
			subtotal: subtotal.toFixed(2),
			gstAmount: gstAmount.toFixed(2),
			total: total.toFixed(2),
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoiceId))
		.returning();

	return updated;
});

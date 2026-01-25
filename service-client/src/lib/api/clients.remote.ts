/**
 * Clients Remote Functions
 *
 * CRUD operations for managing agency clients.
 * Clients are linked to form submissions and can be searched when sending forms.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	clients,
	questionnaireResponses,
	consultations,
	proposals,
	contracts,
	invoices,
} from "$lib/server/schema";
import { error } from "@sveltejs/kit";
import { getAgencyContext, requireAgencyRole } from "$lib/server/agency";
import { eq, and, asc, desc, ilike, or, sql, ne } from "drizzle-orm";

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateClientSchema = v.object({
	businessName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	email: v.pipe(v.string(), v.email(), v.maxLength(255)),
	phone: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(50)))),
	contactName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(255)))),
	notes: v.optional(v.nullable(v.string())),
});

const UpdateClientSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	businessName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	email: v.optional(v.pipe(v.string(), v.email(), v.maxLength(255))),
	phone: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(50)))),
	contactName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(255)))),
	notes: v.optional(v.nullable(v.string())),
});

const ClientStatusSchema = v.union([v.literal("active"), v.literal("archived")]);

const ClientFiltersSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		status: v.optional(ClientStatusSchema),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	})
);

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get all clients for the current agency.
 * Supports search, status filtering, and pagination.
 * By default, returns only active clients unless status is specified.
 */
export const getClients = query(ClientFiltersSchema, async (filters) => {
	const context = await getAgencyContext();
	const { search, status = "active", limit = 50, offset = 0 } = filters || {};

	// Build base conditions
	const conditions = [eq(clients.agencyId, context.agencyId)];

	// Add status filter (null means all statuses)
	if (status) {
		conditions.push(eq(clients.status, status));
	}

	// Add search filter
	if (search && search.trim()) {
		const searchTerm = `%${search.trim()}%`;
		conditions.push(
			or(
				ilike(clients.businessName, searchTerm),
				ilike(clients.email, searchTerm),
				ilike(clients.contactName, searchTerm)
			)!
		);
	}

	return db
		.select()
		.from(clients)
		.where(and(...conditions))
		.orderBy(asc(clients.businessName))
		.limit(limit)
		.offset(offset);
});

/**
 * Get a single client by ID.
 */
export const getClientById = query(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await getAgencyContext();

	const [client] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.agencyId, context.agencyId)));

	if (!client) {
		throw error(404, "Client not found");
	}

	return client;
});

/**
 * Get a client by email (for duplicate checking or linking).
 */
export const getClientByEmail = query(v.pipe(v.string(), v.email()), async (email) => {
	const context = await getAgencyContext();

	const [client] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.email, email.toLowerCase()), eq(clients.agencyId, context.agencyId)));

	return client || null;
});

/**
 * Search clients by query string.
 * Returns top 10 matches for autocomplete.
 * Also searches in questionnaire_responses for legacy clients not yet migrated.
 */
export const searchClients = query(
	v.object({
		query: v.pipe(v.string(), v.minLength(1)),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
	}),
	async ({ query: searchQuery, limit = 10 }) => {
		const context = await getAgencyContext();
		const searchTerm = `%${searchQuery.trim()}%`;

		// Search in clients table
		const clientResults = await db
			.select()
			.from(clients)
			.where(
				and(
					eq(clients.agencyId, context.agencyId),
					or(
						ilike(clients.businessName, searchTerm),
						ilike(clients.email, searchTerm),
						ilike(clients.contactName, searchTerm)
					)
				)
			)
			.orderBy(asc(clients.businessName))
			.limit(limit);

		// Also search in questionnaire_responses for legacy clients
		// (clients created through old questionnaire system that weren't migrated)
		const questionnaireClients = await db
			.select({
				clientBusinessName: questionnaireResponses.clientBusinessName,
				clientEmail: questionnaireResponses.clientEmail,
			})
			.from(questionnaireResponses)
			.where(
				and(
					eq(questionnaireResponses.agencyId, context.agencyId),
					ne(questionnaireResponses.clientBusinessName, ""),
					ne(questionnaireResponses.clientEmail, ""),
					or(
						ilike(questionnaireResponses.clientBusinessName, searchTerm),
						ilike(questionnaireResponses.clientEmail, searchTerm)
					)
				)
			)
			.limit(limit);

		// Merge results, deduplicating by email
		const seenEmails = new Set(clientResults.map((c) => c.email.toLowerCase()));
		const legacyClients = questionnaireClients
			.filter((qc) => !seenEmails.has(qc.clientEmail.toLowerCase()))
			.map((qc) => ({
				// Create a pseudo-client object that matches the clients table structure
				id: `legacy-${qc.clientEmail}`, // Pseudo ID for legacy clients
				agencyId: context.agencyId,
				businessName: qc.clientBusinessName,
				email: qc.clientEmail,
				phone: null,
				contactName: null,
				notes: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			}));

		// Combine and limit results
		const allResults = [...clientResults, ...legacyClients].slice(0, limit);

		return allResults;
	}
);

/**
 * Get client count for the agency.
 */
export const getClientCount = query(async () => {
	const context = await getAgencyContext();

	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(clients)
		.where(eq(clients.agencyId, context.agencyId));

	return result?.count || 0;
});

// =============================================================================
// Command Functions (Write Operations)
// =============================================================================

/**
 * Create a new client.
 * Requires admin or owner role.
 */
export const createClient = command(CreateClientSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin", "member"]);

	// Check for existing client with same email
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(
			and(
				eq(clients.agencyId, context.agencyId),
				eq(clients.email, data.email.toLowerCase())
			)
		);

	if (existing) {
		throw error(400, "A client with this email already exists");
	}

	const [client] = await db
		.insert(clients)
		.values({
			agencyId: context.agencyId,
			businessName: data.businessName,
			email: data.email.toLowerCase(),
			phone: data.phone || null,
			contactName: data.contactName || null,
			notes: data.notes || null,
		})
		.returning();

	return client;
});

/**
 * Create a client if they don't exist, or return existing.
 * Used when creating form submissions.
 */
export const getOrCreateClient = command(
	v.object({
		businessName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
		email: v.pipe(v.string(), v.email(), v.maxLength(255)),
		contactName: v.optional(v.nullable(v.string())),
	}),
	async (data) => {
		const context = await getAgencyContext();

		// Check for existing client
		const [existing] = await db
			.select()
			.from(clients)
			.where(
				and(
					eq(clients.agencyId, context.agencyId),
					eq(clients.email, data.email.toLowerCase())
				)
			);

		if (existing) {
			return { client: existing, created: false };
		}

		// Create new client
		const [client] = await db
			.insert(clients)
			.values({
				agencyId: context.agencyId,
				businessName: data.businessName,
				email: data.email.toLowerCase(),
				contactName: data.contactName || null,
			})
			.returning();

		return { client, created: true };
	}
);

/**
 * Update an existing client.
 * Requires admin or owner role.
 */
export const updateClient = command(UpdateClientSchema, async (data) => {
	const context = await requireAgencyRole(["owner", "admin", "member"]);

	// Verify client belongs to agency
	const [existing] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, data.id), eq(clients.agencyId, context.agencyId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	// Check email uniqueness if changing
	if (data.email && data.email.toLowerCase() !== existing.email) {
		const [emailExists] = await db
			.select({ id: clients.id })
			.from(clients)
			.where(
				and(
					eq(clients.agencyId, context.agencyId),
					eq(clients.email, data.email.toLowerCase())
				)
			);

		if (emailExists) {
			throw error(400, "A client with this email already exists");
		}
	}

	// Build update object
	const updates: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (data.businessName !== undefined) updates["businessName"] = data.businessName;
	if (data.email !== undefined) updates["email"] = data.email.toLowerCase();
	if (data.phone !== undefined) updates["phone"] = data.phone;
	if (data.contactName !== undefined) updates["contactName"] = data.contactName;
	if (data.notes !== undefined) updates["notes"] = data.notes;

	const [client] = await db
		.update(clients)
		.set(updates)
		.where(eq(clients.id, data.id))
		.returning();

	return client;
});

/**
 * Delete a client.
 * Requires owner role.
 */
export const deleteClient = command(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await requireAgencyRole(["owner"]);

	// Verify client belongs to agency
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.agencyId, context.agencyId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	// Note: form_submissions have ON DELETE SET NULL for client_id,
	// so deleting a client won't delete their submissions
	await db.delete(clients).where(eq(clients.id, clientId));

	return { success: true };
});

/**
 * Archive a client (soft delete).
 * Sets status to 'archived'.
 */
export const archiveClient = command(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await requireAgencyRole(["owner", "admin"]);

	// Verify client belongs to agency
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.agencyId, context.agencyId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	await db
		.update(clients)
		.set({ status: "archived", updatedAt: new Date() })
		.where(eq(clients.id, clientId));

	return { success: true };
});

/**
 * Restore an archived client.
 * Sets status back to 'active'.
 */
export const restoreClient = command(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await requireAgencyRole(["owner", "admin"]);

	// Verify client belongs to agency
	const [existing] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.agencyId, context.agencyId)));

	if (!existing) {
		throw error(404, "Client not found");
	}

	await db
		.update(clients)
		.set({ status: "active", updatedAt: new Date() })
		.where(eq(clients.id, clientId));

	return { success: true };
});

// =============================================================================
// Client Hub Functions (Document Aggregation)
// =============================================================================

/**
 * Get all documents linked to a client for the Client Hub view.
 * Returns consultations, proposals, contracts, and invoices.
 */
export const getClientDocuments = query(v.pipe(v.string(), v.uuid()), async (clientId) => {
	const context = await getAgencyContext();

	// Verify client belongs to agency
	const [client] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.agencyId, context.agencyId)));

	if (!client) {
		throw error(404, "Client not found");
	}

	// Fetch all linked documents in parallel
	const [clientConsultations, clientProposals, clientContracts, clientInvoices] = await Promise.all([
		// Consultations
		db
			.select({
				id: consultations.id,
				type: sql<string>`'consultation'`.as("type"),
				title: consultations.businessName,
				status: consultations.status,
				createdAt: consultations.createdAt,
				updatedAt: consultations.updatedAt,
			})
			.from(consultations)
			.where(
				and(
					eq(consultations.clientId, clientId),
					eq(consultations.agencyId, context.agencyId)
				)
			)
			.orderBy(desc(consultations.createdAt)),

		// Proposals
		db
			.select({
				id: proposals.id,
				type: sql<string>`'proposal'`.as("type"),
				title: proposals.title,
				status: proposals.status,
				number: proposals.proposalNumber,
				slug: proposals.slug,
				createdAt: proposals.createdAt,
				updatedAt: proposals.updatedAt,
			})
			.from(proposals)
			.where(
				and(
					eq(proposals.clientId, clientId),
					eq(proposals.agencyId, context.agencyId)
				)
			)
			.orderBy(desc(proposals.createdAt)),

		// Contracts
		db
			.select({
				id: contracts.id,
				type: sql<string>`'contract'`.as("type"),
				title: sql<string>`'Service Agreement'`.as("title"),
				status: contracts.status,
				number: contracts.contractNumber,
				slug: contracts.slug,
				createdAt: contracts.createdAt,
				updatedAt: contracts.updatedAt,
			})
			.from(contracts)
			.where(
				and(
					eq(contracts.clientId, clientId),
					eq(contracts.agencyId, context.agencyId)
				)
			)
			.orderBy(desc(contracts.createdAt)),

		// Invoices
		db
			.select({
				id: invoices.id,
				type: sql<string>`'invoice'`.as("type"),
				title: sql<string>`'Invoice'`.as("title"),
				status: invoices.status,
				number: invoices.invoiceNumber,
				slug: invoices.slug,
				total: invoices.total,
				createdAt: invoices.createdAt,
				updatedAt: invoices.updatedAt,
			})
			.from(invoices)
			.where(
				and(
					eq(invoices.clientId, clientId),
					eq(invoices.agencyId, context.agencyId)
				)
			)
			.orderBy(desc(invoices.createdAt)),
	]);

	return {
		client,
		consultations: clientConsultations,
		proposals: clientProposals,
		contracts: clientContracts,
		invoices: clientInvoices,
		// Summary counts
		counts: {
			consultations: clientConsultations.length,
			proposals: clientProposals.length,
			contracts: clientContracts.length,
			invoices: clientInvoices.length,
			total: clientConsultations.length + clientProposals.length + clientContracts.length + clientInvoices.length,
		},
	};
});

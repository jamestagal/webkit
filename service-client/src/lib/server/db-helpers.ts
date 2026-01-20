/**
 * Data Isolation Helpers for Multi-Tenant Operations
 *
 * CRITICAL: All database operations MUST use these helpers to ensure
 * proper data isolation between agencies.
 *
 * These helpers:
 * - Enforce agency scoping on all queries
 * - Prevent cross-agency data leakage
 * - Provide audit logging for sensitive operations
 */

import { db } from "$lib/server/db";
import { getAgencyContext, type AgencyContext } from "$lib/server/agency";
import {
	consultations,
	consultationDrafts,
	consultationVersions,
	agencyActivityLog,
	type AgencyActivityLogInsert,
} from "$lib/server/schema";
import { eq, and, desc, asc, type SQL } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getRequestEvent } from "$app/server";

// =============================================================================
// Agency-Scoped Query Wrapper
// =============================================================================

/**
 * Execute a function with guaranteed agency scoping.
 * This is the primary pattern for all agency-scoped database operations.
 *
 * @example
 * const consultations = await withAgencyScope(async (agencyId) => {
 *   return db.select().from(consultations)
 *     .where(eq(consultations.agencyId, agencyId));
 * });
 */
export async function withAgencyScope<T>(
	queryFn: (agencyId: string, context: AgencyContext) => Promise<T>,
): Promise<T> {
	const context = await getAgencyContext();
	return queryFn(context.agencyId, context);
}

/**
 * Execute a function with agency scoping, also providing user ID.
 * Use this when you need to filter by both agency and user.
 */
export async function withUserAgencyScope<T>(
	queryFn: (agencyId: string, userId: string, context: AgencyContext) => Promise<T>,
): Promise<T> {
	const context = await getAgencyContext();
	const userId = context.userId;
	return queryFn(context.agencyId, userId, context);
}

// =============================================================================
// Consultation Helpers (Agency-Scoped)
// =============================================================================

/**
 * Get all consultations for the current agency.
 * In v2, all agency members can see all consultations.
 */
export async function getConsultationsForAgency(options?: {
	limit?: number;
	offset?: number;
	status?: string;
	orderBy?: "created" | "updated";
	orderDir?: "asc" | "desc";
}) {
	return withUserAgencyScope(async (agencyId, _userId, _context) => {
		const conditions: SQL[] = [eq(consultations.agencyId, agencyId)];

		// v2: All agency members can see all consultations

		if (options?.status) {
			conditions.push(eq(consultations.status, options.status));
		}

		const orderColumn =
			options?.orderBy === "updated" ? consultations.updatedAt : consultations.createdAt;

		const orderFn = options?.orderDir === "asc" ? asc : desc;

		let query = db
			.select()
			.from(consultations)
			.where(and(...conditions))
			.orderBy(orderFn(orderColumn));

		if (options?.limit) {
			query = query.limit(options.limit) as typeof query;
		}

		if (options?.offset) {
			query = query.offset(options.offset) as typeof query;
		}

		return query;
	});
}

/**
 * Get a single consultation by ID, with agency scope verification.
 * Throws 404 if not found or not accessible.
 */
export async function getConsultationById(consultationId: string) {
	return withUserAgencyScope(async (agencyId, _userId, _context) => {
		const conditions: SQL[] = [
			eq(consultations.id, consultationId),
			eq(consultations.agencyId, agencyId),
		];

		// v2: All agency members can access all consultations

		const [consultation] = await db
			.select()
			.from(consultations)
			.where(and(...conditions))
			.limit(1);

		if (!consultation) {
			throw error(404, "Consultation not found");
		}

		return consultation;
	});
}

/**
 * Get consultation draft by consultation ID, with agency scope.
 */
export async function getConsultationDraftById(consultationId: string) {
	return withUserAgencyScope(async (agencyId, userId, context) => {
		const conditions: SQL[] = [
			eq(consultationDrafts.consultationId, consultationId),
			eq(consultationDrafts.agencyId, agencyId),
		];

		// Members can only access their own drafts
		if (context.role === "member") {
			conditions.push(eq(consultationDrafts.userId, userId));
		}

		const [draft] = await db
			.select()
			.from(consultationDrafts)
			.where(and(...conditions))
			.limit(1);

		return draft || null;
	});
}

/**
 * Get consultation versions by consultation ID, with agency scope.
 */
export async function getConsultationVersions(consultationId: string) {
	return withAgencyScope(async (agencyId) => {
		return db
			.select()
			.from(consultationVersions)
			.where(
				and(
					eq(consultationVersions.consultationId, consultationId),
					eq(consultationVersions.agencyId, agencyId),
				),
			)
			.orderBy(desc(consultationVersions.versionNumber));
	});
}

// =============================================================================
// Ownership Verification
// =============================================================================

/**
 * Verify that a consultation belongs to the current agency.
 * In v2, all agency members can access all consultations.
 * Throws 403/404 if access denied.
 */
export async function verifyConsultationAccess(consultationId: string): Promise<{
	agencyId: string;
}> {
	const context = await getAgencyContext();

	const [result] = await db
		.select({ agencyId: consultations.agencyId })
		.from(consultations)
		.where(eq(consultations.id, consultationId))
		.limit(1);

	if (!result || !result.agencyId) {
		throw error(404, "Consultation not found");
	}

	if (result.agencyId !== context.agencyId) {
		throw error(403, "Access denied: Consultation does not belong to your agency");
	}

	// v2: All agency members can access all consultations

	return { agencyId: result.agencyId };
}

/**
 * Verify that a consultation draft belongs to the current agency.
 * For members, also verifies they own the draft.
 */
export async function verifyDraftAccess(consultationId: string): Promise<{
	agencyId: string;
	userId: string;
}> {
	const context = await getAgencyContext();

	const [result] = await db
		.select({ agencyId: consultationDrafts.agencyId, userId: consultationDrafts.userId })
		.from(consultationDrafts)
		.where(eq(consultationDrafts.consultationId, consultationId))
		.limit(1);

	if (!result || !result.agencyId) {
		throw error(404, "Draft not found");
	}

	if (result.agencyId !== context.agencyId) {
		throw error(403, "Access denied: Draft does not belong to your agency");
	}

	// For members, also verify user ownership
	if (context.role === "member" && result.userId !== context.userId) {
		throw error(403, "Access denied: You do not own this draft");
	}

	return { agencyId: result.agencyId, userId: result.userId };
}

// =============================================================================
// Audit Logging
// =============================================================================

/**
 * Log an activity to the audit trail.
 * Call this for all sensitive operations.
 */
export async function logActivity(
	action: string,
	entityType: string,
	entityId?: string,
	details?: {
		oldValues?: Record<string, unknown>;
		newValues?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	try {
		const context = await getAgencyContext();
		const event = getRequestEvent();

		// Extract IP and User Agent from request
		// IP address must be null (not 'unknown') for inet column type
		const ipAddress =
			event?.request.headers.get("x-forwarded-for") ||
			event?.request.headers.get("cf-connecting-ip") ||
			null;
		const userAgent = event?.request.headers.get("user-agent") || "unknown";

		const logEntry: AgencyActivityLogInsert = {
			agencyId: context.agencyId,
			userId: context.userId,
			action,
			entityType,
			entityId,
			oldValues: details?.oldValues,
			newValues: details?.newValues,
			ipAddress,
			userAgent,
			metadata: details?.metadata ?? {},
		};

		await db.insert(agencyActivityLog).values(logEntry);
	} catch (err) {
		// Don't fail the main operation if logging fails
		console.error("Failed to log activity:", err);
	}
}

/**
 * Batch log multiple activities (for bulk operations).
 */
export async function logActivities(
	entries: Array<{
		action: string;
		entityType: string;
		entityId?: string;
		oldValues?: Record<string, unknown>;
		newValues?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
	}>,
): Promise<void> {
	if (entries.length === 0) return;

	try {
		const context = await getAgencyContext();
		const event = getRequestEvent();

		// IP address must be null (not 'unknown') for inet column type
		const ipAddress =
			event?.request.headers.get("x-forwarded-for") ||
			event?.request.headers.get("cf-connecting-ip") ||
			null;
		const userAgent = event?.request.headers.get("user-agent") || "unknown";

		const logEntries: AgencyActivityLogInsert[] = entries.map((entry) => ({
			agencyId: context.agencyId,
			userId: context.userId,
			action: entry.action,
			entityType: entry.entityType,
			entityId: entry.entityId,
			oldValues: entry.oldValues,
			newValues: entry.newValues,
			ipAddress,
			userAgent,
			metadata: entry.metadata ?? {},
		}));

		await db.insert(agencyActivityLog).values(logEntries);
	} catch (err) {
		console.error("Failed to log activities:", err);
	}
}

// =============================================================================
// Common Action Types for Audit Logging
// =============================================================================

export const AUDIT_ACTIONS = {
	// Agency
	AGENCY_CREATED: "agency.created",
	AGENCY_UPDATED: "agency.updated",
	AGENCY_BRANDING_UPDATED: "agency.branding_updated",
	AGENCY_DELETED: "agency.deleted",
	AGENCY_DELETION_SCHEDULED: "agency.deletion_scheduled",
	AGENCY_DELETION_CANCELLED: "agency.deletion_cancelled",

	// Members
	MEMBER_INVITED: "member.invited",
	MEMBER_ACCEPTED: "member.accepted",
	MEMBER_REMOVED: "member.removed",
	MEMBER_ROLE_CHANGED: "member.role_changed",

	// Consultations
	CONSULTATION_CREATED: "consultation.created",
	CONSULTATION_UPDATED: "consultation.updated",
	CONSULTATION_DELETED: "consultation.deleted",
	CONSULTATION_COMPLETED: "consultation.completed",

	// Proposals
	PROPOSAL_CREATED: "proposal.created",
	PROPOSAL_SENT: "proposal.sent",
	PROPOSAL_VIEWED: "proposal.viewed",
	PROPOSAL_ACCEPTED: "proposal.accepted",
	PROPOSAL_DECLINED: "proposal.declined",

	// Settings
	SETTINGS_UPDATED: "settings.updated",
	FORM_OPTIONS_UPDATED: "form_options.updated",
	TEMPLATE_CREATED: "template.created",
	TEMPLATE_UPDATED: "template.updated",
	TEMPLATE_DELETED: "template.deleted",

	// Security
	LOGIN: "security.login",
	LOGOUT: "security.logout",
	PASSWORD_CHANGED: "security.password_changed",
	API_KEY_GENERATED: "security.api_key_generated",

	// Data
	DATA_EXPORTED: "data.exported",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// =============================================================================
// Entity Types for Audit Logging
// =============================================================================

export const ENTITY_TYPES = {
	AGENCY: "agency",
	MEMBER: "member",
	CONSULTATION: "consultation",
	PROPOSAL: "proposal",
	TEMPLATE: "template",
	FORM_OPTION: "form_option",
	USER: "user",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

/**
 * Agency Context Helper for Remote Functions
 *
 * Provides agency context utilities for multi-tenant operations.
 * Uses getRequestEvent() to access the current agency from cookies/session.
 *
 * Adapted from BetterKit organization middleware patterns.
 */

import { getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { agencies, agencyMemberships, users } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "$lib/server/auth";
import type { AgencyRole } from "$lib/server/schema";
import {
	getImpersonatedAgencyId,
	getVirtualOwnerContext,
	isSuperAdmin,
} from "$lib/server/super-admin";

// Cookie name for storing current agency
const CURRENT_AGENCY_COOKIE = "current_agency_id";

/**
 * Agency context returned by getAgencyContext()
 */
export interface AgencyContext {
	agencyId: string;
	userId: string;
	role: AgencyRole;
	agency: {
		id: string;
		name: string;
		slug: string;
		logoUrl: string;
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
		status: string;
	};
}

/**
 * Get the current agency context for the authenticated user (read-only).
 *
 * Resolution order:
 * 1. Agency ID from cookie (if user has access)
 * 2. User's default agency (if set)
 * 3. First agency user belongs to
 *
 * NOTE: This function is safe for use in query() functions as it doesn't
 * modify cookies. Use setAgencyCookie() in commands if needed.
 *
 * Throws 403 if user has no agency access.
 */
export async function getAgencyContext(): Promise<AgencyContext> {
	const userId = getUserId();
	const event = getRequestEvent();

	// Check for super admin impersonation first
	const impersonatedAgencyId = getImpersonatedAgencyId();
	if (impersonatedAgencyId) {
		// Verify user is super admin
		const [user] = await db
			.select({ access: users.access })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (user && isSuperAdmin(user.access)) {
			const virtualContext = await getVirtualOwnerContext(userId, impersonatedAgencyId);
			if (virtualContext) {
				return virtualContext;
			}
		}
	}

	// Try to get agency ID from cookie
	let agencyId = event?.cookies.get(CURRENT_AGENCY_COOKIE);

	// If cookie has agency ID, verify user has access
	if (agencyId) {
		const membership = await verifyMembership(userId, agencyId);
		if (!membership) {
			// Don't delete cookie in read-only context - just ignore it
			agencyId = undefined;
		}
	}

	// If no valid cookie, try user's default agency
	if (!agencyId) {
		const [user] = await db
			.select({ defaultAgencyId: users.defaultAgencyId })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (user?.defaultAgencyId) {
			const membership = await verifyMembership(userId, user.defaultAgencyId);
			if (membership) {
				agencyId = user.defaultAgencyId;
			}
		}
	}

	// If still no agency, get agency where user has highest role (owner > admin > member)
	if (!agencyId) {
		const memberships = await db
			.select({
				agencyId: agencyMemberships.agencyId,
				role: agencyMemberships.role,
			})
			.from(agencyMemberships)
			.where(and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.status, "active")));

		// Prioritize by role: owner first, then admin, then member
		const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
		const sorted = memberships.sort(
			(a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3),
		);

		if (sorted.length > 0) {
			agencyId = sorted[0].agencyId;
		}
	}

	// If user has no agencies, throw error
	if (!agencyId) {
		throw error(403, "No agency access. Please create or join an agency.");
	}

	// Get full context with agency details
	const context = await getFullAgencyContext(userId, agencyId);

	if (!context) {
		throw error(403, "Agency access denied");
	}

	return context;
}

/**
 * Set the agency cookie. Call this from command() functions after mutations.
 */
export function setAgencyCookie(agencyId: string): void {
	const event = getRequestEvent();
	event?.cookies.set(CURRENT_AGENCY_COOKIE, agencyId, {
		path: "/",
		httpOnly: true,
		secure: process.env["NODE_ENV"] === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 30, // 30 days
	});
}

/**
 * Get agency context for a specific agency slug.
 * Used by slug-based routes like /[agencySlug]/...
 */
export async function getAgencyContextBySlug(slug: string): Promise<AgencyContext> {
	const userId = getUserId();

	// Get agency by slug
	const [agency] = await db.select().from(agencies).where(eq(agencies.slug, slug)).limit(1);

	if (!agency) {
		throw error(404, "Agency not found");
	}

	// Verify user membership
	const context = await getFullAgencyContext(userId, agency.id);

	if (!context) {
		throw error(403, "You do not have access to this agency");
	}

	return context;
}

/**
 * Switch the current agency context.
 * Updates the cookie to the new agency.
 */
export async function switchAgency(agencyId: string): Promise<void> {
	const userId = getUserId();
	const event = getRequestEvent();

	// Verify user has access to this agency
	const membership = await verifyMembership(userId, agencyId);

	if (!membership) {
		throw error(403, "You do not have access to this agency");
	}

	// Update cookie
	event?.cookies.set(CURRENT_AGENCY_COOKIE, agencyId, {
		path: "/",
		httpOnly: true,
		secure: process.env["NODE_ENV"] === "production",
		sameSite: "lax",
		maxAge: 60 * 60 * 24 * 30, // 30 days
	});
}

/**
 * Require a specific role to access an operation.
 * Throws 403 if user doesn't have required role.
 */
export async function requireAgencyRole(
	allowedRoles: AgencyRole[],
	agencyId?: string,
): Promise<AgencyContext> {
	const context = agencyId
		? await getFullAgencyContext(getUserId(), agencyId)
		: await getAgencyContext();

	if (!context) {
		throw error(403, "Agency access denied");
	}

	if (!allowedRoles.includes(context.role)) {
		throw error(403, `This action requires one of these roles: ${allowedRoles.join(", ")}`);
	}

	return context;
}

/**
 * Check if user has a specific role in the current agency.
 * Returns false instead of throwing.
 */
export async function hasAgencyRole(
	allowedRoles: AgencyRole[],
	agencyId?: string,
): Promise<boolean> {
	try {
		const context = agencyId
			? await getFullAgencyContext(getUserId(), agencyId)
			: await getAgencyContext();

		return context ? allowedRoles.includes(context.role) : false;
	} catch {
		return false;
	}
}

/**
 * Get the current agency ID without full context.
 * Returns undefined if user has no agency.
 */
export async function getCurrentAgencyId(): Promise<string | undefined> {
	try {
		const context = await getAgencyContext();
		return context.agencyId;
	} catch {
		return undefined;
	}
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Verify that a user has access to an agency.
 * Returns the membership if valid, null otherwise.
 */
async function verifyMembership(userId: string, agencyId: string) {
	const [membership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.userId, userId),
				eq(agencyMemberships.agencyId, agencyId),
				eq(agencyMemberships.status, "active"),
			),
		)
		.limit(1);

	return membership || null;
}

/**
 * Get full agency context with agency details and role.
 */
async function getFullAgencyContext(
	userId: string,
	agencyId: string,
): Promise<AgencyContext | null> {
	// Get membership and agency in one query
	const [result] = await db
		.select({
			membershipId: agencyMemberships.id,
			role: agencyMemberships.role,
			agencyId: agencies.id,
			agencyName: agencies.name,
			agencySlug: agencies.slug,
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			secondaryColor: agencies.secondaryColor,
			accentColor: agencies.accentColor,
			status: agencies.status,
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(
			and(
				eq(agencyMemberships.userId, userId),
				eq(agencyMemberships.agencyId, agencyId),
				eq(agencyMemberships.status, "active"),
				eq(agencies.status, "active"),
			),
		)
		.limit(1);

	if (!result) {
		return null;
	}

	return {
		agencyId: result.agencyId,
		userId,
		role: result.role as AgencyRole,
		agency: {
			id: result.agencyId,
			name: result.agencyName,
			slug: result.agencySlug,
			logoUrl: result.logoUrl,
			primaryColor: result.primaryColor,
			secondaryColor: result.secondaryColor,
			accentColor: result.accentColor,
			status: result.status,
		},
	};
}

// =============================================================================
// Role Permission Helpers
// =============================================================================

/**
 * Check if a role can perform admin actions.
 */
export function canAdminister(role: AgencyRole): boolean {
	return role === "owner" || role === "admin";
}

/**
 * Check if a role can manage members.
 */
export function canManageMembers(role: AgencyRole): boolean {
	return role === "owner" || role === "admin";
}

/**
 * Check if a role can update agency settings.
 */
export function canUpdateSettings(role: AgencyRole): boolean {
	return role === "owner" || role === "admin";
}

/**
 * Check if a role can delete the agency.
 */
export function canDeleteAgency(role: AgencyRole): boolean {
	return role === "owner";
}

/**
 * Check if a role can transfer ownership.
 */
export function canTransferOwnership(role: AgencyRole): boolean {
	return role === "owner";
}

// =============================================================================
// Slug Utilities
// =============================================================================

/**
 * Reserved slugs that cannot be used as agency slugs.
 */
export const RESERVED_SLUGS = [
	"admin",
	"dashboard",
	"settings",
	"agencies",
	"api",
	"auth",
	"super-admin",
	"consultation",
	"login",
	"logout",
	"signup",
	"register",
	"profile",
	"account",
];

/**
 * Generate a slug from an agency name.
 */
export function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
}

/**
 * Check if a slug is valid (not reserved and proper format).
 */
export function isValidSlug(slug: string): boolean {
	if (RESERVED_SLUGS.includes(slug)) {
		return false;
	}

	// Must be lowercase alphanumeric with hyphens, 3-50 chars
	return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

/**
 * Check if a slug is available (not already in use).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
	if (!isValidSlug(slug)) {
		return false;
	}

	const [existing] = await db
		.select({ id: agencies.id })
		.from(agencies)
		.where(eq(agencies.slug, slug))
		.limit(1);

	return !existing;
}

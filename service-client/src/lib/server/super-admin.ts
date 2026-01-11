/**
 * Super Admin Utilities
 *
 * Provides super admin access control and utilities for platform administration.
 * Super admins can manage all agencies, users, and view system-wide data.
 */

import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agencies, users } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { getUserId } from '$lib/server/auth';
import { getRequestEvent } from '$app/server';
import type { AgencyContext } from '$lib/server/agency';

// =============================================================================
// Super Admin Access Flag
// =============================================================================

/**
 * Super admin access flag (bit 16 = 65536)
 * Consistent with existing access flag pattern used for BasicPlan/PremiumPlan
 */
export const SUPER_ADMIN_FLAG = 0x0000000000010000; // 65536

/**
 * Check if a user has super admin access based on their access flags.
 */
export function isSuperAdmin(access: number): boolean {
	return (access & SUPER_ADMIN_FLAG) !== 0;
}

// =============================================================================
// Super Admin Cookie for Agency Impersonation
// =============================================================================

const SUPER_ADMIN_AGENCY_COOKIE = 'super_admin_agency_id';

/**
 * Get the agency ID the super admin is currently impersonating.
 */
export function getImpersonatedAgencyId(): string | undefined {
	const event = getRequestEvent();
	return event?.cookies.get(SUPER_ADMIN_AGENCY_COOKIE);
}

/**
 * Set the agency ID for super admin impersonation.
 */
export function setImpersonatedAgencyId(agencyId: string): void {
	const event = getRequestEvent();
	event?.cookies.set(SUPER_ADMIN_AGENCY_COOKIE, agencyId, {
		path: '/',
		httpOnly: true,
		secure: process.env['NODE_ENV'] === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 4 // 4 hours (shorter for security)
	});
}

/**
 * Clear the super admin impersonation cookie.
 */
export function clearImpersonatedAgencyId(): void {
	const event = getRequestEvent();
	event?.cookies.delete(SUPER_ADMIN_AGENCY_COOKIE, { path: '/' });
}

// =============================================================================
// Super Admin Guards
// =============================================================================

/**
 * Result type for requireSuperAdmin.
 */
export interface SuperAdminContext {
	userId: string;
	email: string;
	access: number;
}

/**
 * Require super admin access. Throws 403 if user is not a super admin.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
	const userId = getUserId();

	const [user] = await db
		.select({
			id: users.id,
			email: users.email,
			access: users.access
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw error(403, 'User not found');
	}

	if (!isSuperAdmin(user.access)) {
		throw error(403, 'Super admin access required');
	}

	return {
		userId: user.id,
		email: user.email,
		access: user.access
	};
}

/**
 * Check if the current user is a super admin without throwing.
 */
export async function checkIsSuperAdmin(): Promise<boolean> {
	try {
		const userId = getUserId();

		const [user] = await db
			.select({ access: users.access })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		return user ? isSuperAdmin(user.access) : false;
	} catch {
		return false;
	}
}

// =============================================================================
// Virtual Agency Context for Super Admin Impersonation
// =============================================================================

/**
 * Get a virtual "owner" agency context for super admin impersonation.
 * This allows super admins to access any agency as if they were the owner.
 */
export async function getVirtualOwnerContext(
	userId: string,
	agencyId: string
): Promise<AgencyContext | null> {
	// Verify user is super admin
	const [user] = await db
		.select({ access: users.access })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user || !isSuperAdmin(user.access)) {
		return null;
	}

	// Get agency details
	const [agency] = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			secondaryColor: agencies.secondaryColor,
			accentColor: agencies.accentColor,
			status: agencies.status
		})
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	if (!agency) {
		return null;
	}

	// Return virtual owner context
	return {
		agencyId: agency.id,
		userId,
		role: 'owner', // Super admins get owner-level access
		agency: {
			id: agency.id,
			name: agency.name,
			slug: agency.slug,
			logoUrl: agency.logoUrl,
			primaryColor: agency.primaryColor,
			secondaryColor: agency.secondaryColor,
			accentColor: agency.accentColor,
			status: agency.status
		}
	};
}

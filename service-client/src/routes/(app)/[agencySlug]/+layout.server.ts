/**
 * Agency Slug Layout Server Load
 *
 * Loads agency context based on URL slug parameter.
 * Verifies user has access to the requested agency.
 */

import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agencies, agencyMemberships, agencyFormOptions, users } from '$lib/server/schema';
import { eq, and, asc } from 'drizzle-orm';
import { groupOptionsByCategory, mergeWithDefaults } from '$lib/stores/agency-config.svelte';
import type { AgencyConfig } from '$lib/stores/agency-config.svelte';
import type { LayoutServerLoad } from './$types';
import { isSuperAdmin, getImpersonatedAgencyId } from '$lib/server/super-admin';

export const load: LayoutServerLoad = async ({ locals, params, cookies }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw redirect(302, '/login');
	}

	const { agencySlug } = params;

	// Get agency by slug
	const [agency] = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			logoUrl: agencies.logoUrl,
			logoAvatarUrl: agencies.logoAvatarUrl,
			primaryColor: agencies.primaryColor,
			secondaryColor: agencies.secondaryColor,
			accentColor: agencies.accentColor,
			status: agencies.status,
			deletedAt: agencies.deletedAt
		})
		.from(agencies)
		.where(eq(agencies.slug, agencySlug))
		.limit(1);

	if (!agency) {
		throw error(404, 'Agency not found');
	}

	if (agency.deletedAt) {
		throw error(410, 'This agency has been deleted');
	}

	if (agency.status !== 'active') {
		throw error(403, 'This agency is currently suspended');
	}

	// Check if user is super admin and impersonating this agency
	const userAccess = locals.user?.access ?? 0;
	const isUserSuperAdmin = isSuperAdmin(userAccess);
	const impersonatedAgencyId = getImpersonatedAgencyId();
	const isImpersonating = isUserSuperAdmin && impersonatedAgencyId === agency.id;

	// Verify user has access to this agency (or is super admin impersonating)
	const [membership] = await db
		.select({
			id: agencyMemberships.id,
			role: agencyMemberships.role,
			status: agencyMemberships.status,
			displayName: agencyMemberships.displayName
		})
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.userId, userId),
				eq(agencyMemberships.agencyId, agency.id),
				eq(agencyMemberships.status, 'active')
			)
		)
		.limit(1);

	// Allow access if user has membership OR is super admin impersonating
	if (!membership && !isImpersonating) {
		throw error(403, 'You do not have access to this agency');
	}

	// For super admin impersonation, create virtual owner membership
	const effectiveMembership = membership || {
		id: 'virtual',
		role: 'owner' as const,
		status: 'active' as const,
		displayName: 'Super Admin'
	};

	// Set the current agency cookie
	cookies.set('current_agency_id', agency.id, {
		path: '/',
		httpOnly: true,
		secure: process.env['NODE_ENV'] === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});

	// Load form options for this agency
	const options = await db
		.select({
			category: agencyFormOptions.category,
			value: agencyFormOptions.value,
			label: agencyFormOptions.label,
			isDefault: agencyFormOptions.isDefault,
			sortOrder: agencyFormOptions.sortOrder,
			metadata: agencyFormOptions.metadata
		})
		.from(agencyFormOptions)
		.where(and(eq(agencyFormOptions.agencyId, agency.id), eq(agencyFormOptions.isActive, true)))
		.orderBy(asc(agencyFormOptions.category), asc(agencyFormOptions.sortOrder));

	// Group by category and merge with defaults
	const grouped = groupOptionsByCategory(
		options.map((opt) => ({
			...opt,
			metadata: opt.metadata as Record<string, unknown>
		}))
	);
	const agencyConfig: AgencyConfig = mergeWithDefaults(grouped);

	// Get user's default agency for comparison
	const [user] = await db
		.select({ defaultAgencyId: users.defaultAgencyId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	// Get all agencies the user belongs to (for the agency switcher)
	const userAgencies = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			logoUrl: agencies.logoUrl,
			logoAvatarUrl: agencies.logoAvatarUrl,
			primaryColor: agencies.primaryColor,
			role: agencyMemberships.role
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(
			and(
				eq(agencyMemberships.userId, userId),
				eq(agencyMemberships.status, 'active'),
				eq(agencies.status, 'active')
			)
		)
		.orderBy(asc(agencies.name));

	return {
		agency: {
			id: agency.id,
			name: agency.name,
			slug: agency.slug,
			logoUrl: agency.logoUrl,
			logoAvatarUrl: agency.logoAvatarUrl,
			primaryColor: agency.primaryColor,
			secondaryColor: agency.secondaryColor,
			accentColor: agency.accentColor
		},
		membership: {
			role: effectiveMembership.role as 'owner' | 'admin' | 'member',
			displayName: effectiveMembership.displayName
		},
		agencyConfig,
		isDefaultAgency: user?.defaultAgencyId === agency.id,
		userAgencies: userAgencies.map((a) => ({
			...a,
			role: a.role as 'owner' | 'admin' | 'member'
		})),
		isSuperAdmin: isUserSuperAdmin,
		isImpersonating
	};
};

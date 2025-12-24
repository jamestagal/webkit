/**
 * Agency Remote Functions
 *
 * Direct PostgreSQL access using drizzle-orm for agency operations.
 * Follows the remote functions guide:
 * - Uses query() for read operations
 * - Uses command() for programmatic mutations
 * - Uses Valibot for validation (NOT Zod)
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import {
	agencies,
	agencyMemberships,
	agencyFormOptions,
	users
} from '$lib/server/schema';
import { getUserId } from '$lib/server/auth';
import {
	getAgencyContext,
	requireAgencyRole,
	generateSlug,
	isSlugAvailable,
	isValidSlug,
	switchAgency as switchAgencyContext
} from '$lib/server/agency';
import { logActivity } from '$lib/server/db-helpers';
import { eq, and, desc, asc } from 'drizzle-orm';

// =============================================================================
// Query Functions (Read Operations)
// =============================================================================

/**
 * Get the current agency context for the authenticated user.
 * Returns agency details, branding, and user's role.
 */
export const getCurrentAgency = query(async () => {
	const context = await getAgencyContext();
	return context;
});

/**
 * Get all agencies the user belongs to.
 * Used for the agency switcher component.
 */
export const getUserAgencies = query(async () => {
	const userId = getUserId();

	const results = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			logoUrl: agencies.logoUrl,
			primaryColor: agencies.primaryColor,
			role: agencyMemberships.role,
			status: agencies.status
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(
			and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.status, 'active'))
		)
		.orderBy(asc(agencies.name));

	return results;
});

/**
 * Get all form options for the current agency, grouped by category.
 * Returns a map of category -> options[].
 */
export const getAgencyFormOptions = query(async () => {
	const context = await getAgencyContext();

	const options = await db
		.select()
		.from(agencyFormOptions)
		.where(
			and(
				eq(agencyFormOptions.agencyId, context.agencyId),
				eq(agencyFormOptions.isActive, true)
			)
		)
		.orderBy(asc(agencyFormOptions.category), asc(agencyFormOptions.sortOrder));

	// Group by category
	const grouped: Record<string, typeof options> = {};
	for (const option of options) {
		const category = option.category;
		if (!grouped[category]) {
			grouped[category] = [];
		}
		grouped[category]!.push(option);
	}

	return grouped;
});

/**
 * Get form options for a specific category.
 */
export const getFormOptionsByCategory = query(
	v.pipe(v.string(), v.minLength(1)),
	async (category: string) => {
		const context = await getAgencyContext();

		return await db
			.select()
			.from(agencyFormOptions)
			.where(
				and(
					eq(agencyFormOptions.agencyId, context.agencyId),
					eq(agencyFormOptions.category, category),
					eq(agencyFormOptions.isActive, true)
				)
			)
			.orderBy(asc(agencyFormOptions.sortOrder));
	}
);

/**
 * Get agency members (admin/owner only).
 */
export const getAgencyMembers = query(async () => {
	const context = await requireAgencyRole(['owner', 'admin']);

	const members = await db
		.select({
			id: agencyMemberships.id,
			userId: agencyMemberships.userId,
			role: agencyMemberships.role,
			status: agencyMemberships.status,
			displayName: agencyMemberships.displayName,
			invitedAt: agencyMemberships.invitedAt,
			acceptedAt: agencyMemberships.acceptedAt,
			userEmail: users.email,
			userAvatar: users.avatar
		})
		.from(agencyMemberships)
		.innerJoin(users, eq(agencyMemberships.userId, users.id))
		.where(eq(agencyMemberships.agencyId, context.agencyId))
		.orderBy(desc(agencyMemberships.createdAt));

	return members;
});

/**
 * Check if a slug is available.
 */
export const checkSlugAvailable = query(
	v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
	async (slug: string) => {
		const available = await isSlugAvailable(slug);
		const valid = isValidSlug(slug);
		return { available, valid };
	}
);

// =============================================================================
// Command Functions (Programmatic Mutations)
// =============================================================================

// Validation schemas
const CreateAgencySchema = v.object({
	name: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
	slug: v.optional(v.pipe(v.string(), v.minLength(3), v.maxLength(50)))
});

const UpdateAgencyBrandingSchema = v.object({
	agencyId: v.optional(v.pipe(v.string(), v.uuid())),
	name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(100))),
	logoUrl: v.optional(v.string()),
	primaryColor: v.optional(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/))),
	secondaryColor: v.optional(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/))),
	accentColor: v.optional(v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/)))
});

const UpdateAgencyContactSchema = v.object({
	agencyId: v.optional(v.pipe(v.string(), v.uuid())),
	email: v.optional(v.pipe(v.string(), v.email())),
	phone: v.optional(v.string()),
	website: v.optional(v.string())
});

const SwitchAgencySchema = v.pipe(v.string(), v.uuid());

const InviteMemberSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	role: v.picklist(['admin', 'member'] as const)
});

const UpdateMemberRoleSchema = v.object({
	membershipId: v.pipe(v.string(), v.uuid()),
	role: v.picklist(['admin', 'member'] as const)
});

const RemoveMemberSchema = v.pipe(v.string(), v.uuid());

const UpdateFormOptionsSchema = v.object({
	category: v.string(),
	options: v.array(
		v.object({
			value: v.string(),
			label: v.string(),
			sortOrder: v.optional(v.number()),
			isDefault: v.optional(v.boolean()),
			isActive: v.optional(v.boolean()),
			metadata: v.optional(v.record(v.string(), v.unknown()))
		})
	)
});

/**
 * Create a new agency.
 * The creating user becomes the owner.
 */
export const createAgency = command(CreateAgencySchema, async (data) => {
	const userId = getUserId();

	// Generate slug if not provided
	let slug = data.slug || generateSlug(data.name);

	// Ensure slug is available
	let counter = 1;
	let baseSlug = slug;
	while (!(await isSlugAvailable(slug))) {
		slug = `${baseSlug}-${counter}`;
		counter++;
		if (counter > 100) {
			throw new Error('Unable to generate unique slug');
		}
	}

	// Create agency
	const [agency] = await db
		.insert(agencies)
		.values({
			name: data.name,
			slug
		})
		.returning();

	if (!agency) {
		throw new Error('Failed to create agency');
	}

	// Create owner membership
	await db.insert(agencyMemberships).values({
		userId,
		agencyId: agency.id,
		role: 'owner',
		status: 'active',
		acceptedAt: new Date()
	});

	// Set as user's default agency if they don't have one
	await db
		.update(users)
		.set({ defaultAgencyId: agency.id })
		.where(and(eq(users.id, userId), eq(users.defaultAgencyId, null as unknown as string)));

	// Switch to new agency
	await switchAgencyContext(agency.id);

	// Log activity
	await logActivity('agency.created', 'agency', agency.id, {
		newValues: { name: data.name, slug: agency.slug }
	});

	return { agencyId: agency.id, slug: agency.slug };
});

/**
 * Update agency branding (admin/owner only).
 */
export const updateAgencyBranding = command(UpdateAgencyBrandingSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin'], data.agencyId);

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) updates['name'] = data.name;
	if (data.logoUrl !== undefined) updates['logoUrl'] = data.logoUrl;
	if (data.primaryColor !== undefined) updates['primaryColor'] = data.primaryColor;
	if (data.secondaryColor !== undefined) updates['secondaryColor'] = data.secondaryColor;
	if (data.accentColor !== undefined) updates['accentColor'] = data.accentColor;

	await db.update(agencies).set(updates).where(eq(agencies.id, context.agencyId));

	// Log activity
	await logActivity('agency.branding.updated', 'agency', context.agencyId, {
		newValues: updates
	});
});

/**
 * Update agency contact info (admin/owner only).
 */
export const updateAgencyContact = command(UpdateAgencyContactSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin'], data.agencyId);

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.email !== undefined) updates['email'] = data.email;
	if (data.phone !== undefined) updates['phone'] = data.phone;
	if (data.website !== undefined) updates['website'] = data.website;

	await db.update(agencies).set(updates).where(eq(agencies.id, context.agencyId));

	// Log activity
	await logActivity('agency.contact.updated', 'agency', context.agencyId, {
		newValues: updates
	});
});

/**
 * Switch to a different agency.
 */
export const switchAgency = command(SwitchAgencySchema, async (agencyId: string) => {
	await switchAgencyContext(agencyId);
});

/**
 * Invite a new member to the agency (admin/owner only).
 */
export const inviteMember = command(InviteMemberSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin']);
	const userId = getUserId();

	// Find user by email
	const [existingUser] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, data.email))
		.limit(1);

	if (!existingUser) {
		// TODO: Send invitation email to non-existing user
		throw new Error('User not found. Email invitations coming soon.');
	}

	// Check if user is already a member
	const [existingMembership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.userId, existingUser.id),
				eq(agencyMemberships.agencyId, context.agencyId)
			)
		)
		.limit(1);

	if (existingMembership) {
		throw new Error('User is already a member of this agency');
	}

	// Create membership
	const [newMembership] = await db.insert(agencyMemberships).values({
		userId: existingUser.id,
		agencyId: context.agencyId,
		role: data.role,
		status: 'active', // Auto-accept for existing users
		invitedAt: new Date(),
		invitedBy: userId,
		acceptedAt: new Date()
	}).returning({ id: agencyMemberships.id });

	// Log activity
	await logActivity('member.invited', 'membership', newMembership?.id, {
		newValues: { email: data.email, role: data.role, userId: existingUser.id }
	});
});

/**
 * Update a member's role (owner only for admin promotion, admin+ for member changes).
 */
export const updateMemberRole = command(UpdateMemberRoleSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Get the membership to update
	const [membership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.id, data.membershipId),
				eq(agencyMemberships.agencyId, context.agencyId)
			)
		)
		.limit(1);

	if (!membership) {
		throw new Error('Membership not found');
	}

	// Cannot change owner's role
	if (membership.role === 'owner') {
		throw new Error('Cannot change owner role. Transfer ownership instead.');
	}

	// Only owner can promote to admin
	if (data.role === 'admin' && context.role !== 'owner') {
		throw new Error('Only the owner can promote members to admin');
	}

	const oldRole = membership.role;
	await db
		.update(agencyMemberships)
		.set({ role: data.role, updatedAt: new Date() })
		.where(eq(agencyMemberships.id, data.membershipId));

	// Log activity
	await logActivity('member.role.changed', 'membership', data.membershipId, {
		oldValues: { role: oldRole },
		newValues: { role: data.role },
		metadata: { userId: membership.userId }
	});
});

/**
 * Remove a member from the agency (admin/owner only).
 */
export const removeMember = command(RemoveMemberSchema, async (membershipId: string) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Get the membership to remove
	const [membership] = await db
		.select()
		.from(agencyMemberships)
		.where(
			and(
				eq(agencyMemberships.id, membershipId),
				eq(agencyMemberships.agencyId, context.agencyId)
			)
		)
		.limit(1);

	if (!membership) {
		throw new Error('Membership not found');
	}

	// Cannot remove owner
	if (membership.role === 'owner') {
		throw new Error('Cannot remove owner. Transfer ownership first.');
	}

	// Admin can only remove members, not other admins
	if (membership.role === 'admin' && context.role !== 'owner') {
		throw new Error('Only the owner can remove admins');
	}

	await db.delete(agencyMemberships).where(eq(agencyMemberships.id, membershipId));

	// Log activity
	await logActivity('member.removed', 'membership', membershipId, {
		oldValues: { userId: membership.userId, role: membership.role }
	});
});

/**
 * Update form options for a category (admin/owner only).
 * Uses upsert pattern - creates new options or updates existing ones.
 */
export const updateFormOptions = command(UpdateFormOptionsSchema, async (data) => {
	const context = await requireAgencyRole(['owner', 'admin']);

	// Delete existing options for this category
	await db
		.delete(agencyFormOptions)
		.where(
			and(
				eq(agencyFormOptions.agencyId, context.agencyId),
				eq(agencyFormOptions.category, data.category)
			)
		);

	// Insert new options
	if (data.options.length > 0) {
		await db.insert(agencyFormOptions).values(
			data.options.map((opt, index) => ({
				agencyId: context.agencyId,
				category: data.category,
				value: opt.value,
				label: opt.label,
				sortOrder: opt.sortOrder ?? index,
				isDefault: opt.isDefault ?? false,
				isActive: opt.isActive ?? true,
				metadata: opt.metadata ?? {}
			}))
		);
	}

	// Log activity
	await logActivity('form.options.updated', 'form_options', undefined, {
		newValues: { category: data.category, optionCount: data.options.length }
	});
});

/**
 * Set user's default agency.
 */
export const setDefaultAgency = command(SwitchAgencySchema, async (agencyId: string) => {
	const userId = getUserId();

	// Verify user has access
	const context = await getAgencyContext();
	if (context.agencyId !== agencyId) {
		await requireAgencyRole(['owner', 'admin', 'member'], agencyId);
	}

	await db.update(users).set({ defaultAgencyId: agencyId }).where(eq(users.id, userId));
});

// =============================================================================
// Type Exports
// =============================================================================

export type AgencyWithRole = Awaited<ReturnType<typeof getUserAgencies>>[number];
export type AgencyFormOptionsMap = Awaited<ReturnType<typeof getAgencyFormOptions>>;
export type AgencyMember = Awaited<ReturnType<typeof getAgencyMembers>>[number];

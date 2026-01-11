/**
 * Super Admin Remote Functions
 *
 * Remote functions for platform administration.
 * All functions require super admin access.
 */

import { query, command } from '$app/server';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import {
	agencies,
	agencyMemberships,
	users,
	proposals,
	contracts,
	invoices,
	agencyActivityLog
} from '$lib/server/schema';
import { eq, desc, sql, and, like, or, count } from 'drizzle-orm';
import {
	requireSuperAdmin,
	setImpersonatedAgencyId,
	clearImpersonatedAgencyId,
	SUPER_ADMIN_FLAG
} from '$lib/server/super-admin';

// =============================================================================
// Dashboard Stats
// =============================================================================

export const getSuperAdminStats = query(async () => {
	await requireSuperAdmin();

	// Get total counts
	const [agencyStats] = await db
		.select({
			total: count(),
			active: sql<number>`COUNT(*) FILTER (WHERE ${agencies.status} = 'active')`,
			suspended: sql<number>`COUNT(*) FILTER (WHERE ${agencies.status} = 'suspended')`
		})
		.from(agencies);

	const [userStats] = await db.select({ total: count() }).from(users);

	// Get agencies by subscription tier
	const tierStats = await db
		.select({
			tier: agencies.subscriptionTier,
			count: count()
		})
		.from(agencies)
		.groupBy(agencies.subscriptionTier);

	// Get recent agency signups (last 10)
	const recentAgencies = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			status: agencies.status,
			subscriptionTier: agencies.subscriptionTier,
			createdAt: agencies.createdAt
		})
		.from(agencies)
		.orderBy(desc(agencies.createdAt))
		.limit(10);

	// Get super admin count
	const [superAdminStats] = await db
		.select({
			total: sql<number>`COUNT(*) FILTER (WHERE (${users.access} & ${SUPER_ADMIN_FLAG}) != 0)`
		})
		.from(users);

	return {
		agencies: {
			total: agencyStats?.total ?? 0,
			active: agencyStats?.active ?? 0,
			suspended: agencyStats?.suspended ?? 0
		},
		users: {
			total: userStats?.total ?? 0,
			superAdmins: superAdminStats?.total ?? 0
		},
		agenciesByTier: Object.fromEntries(tierStats.map((t) => [t.tier, t.count])),
		recentAgencies
	};
});

// =============================================================================
// Agencies Management
// =============================================================================

const AgenciesFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		status: v.optional(v.picklist(['active', 'suspended', 'cancelled'])),
		tier: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0)))
	})
);

export const getAgencies = query(AgenciesFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, status, tier, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (status) {
		conditions.push(eq(agencies.status, status));
	}

	if (tier) {
		conditions.push(eq(agencies.subscriptionTier, tier));
	}

	if (search) {
		conditions.push(
			or(
				like(agencies.name, `%${search}%`),
				like(agencies.slug, `%${search}%`),
				like(agencies.email, `%${search}%`)
			)
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get agencies with member count
	const agencyList = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			email: agencies.email,
			status: agencies.status,
			subscriptionTier: agencies.subscriptionTier,
			createdAt: agencies.createdAt,
			memberCount: sql<number>`(
				SELECT COUNT(*) FROM ${agencyMemberships}
				WHERE ${agencyMemberships.agencyId} = ${agencies.id}
				AND ${agencyMemberships.status} = 'active'
			)`
		})
		.from(agencies)
		.where(whereClause)
		.orderBy(desc(agencies.createdAt))
		.limit(limit)
		.offset(offset);

	// Get total count for pagination
	const [totalResult] = await db
		.select({ count: count() })
		.from(agencies)
		.where(whereClause);

	return {
		agencies: agencyList,
		total: totalResult?.count ?? 0,
		limit,
		offset
	};
});

export const getAgencyDetails = query(v.pipe(v.string(), v.uuid()), async (agencyId) => {
	await requireSuperAdmin();

	// Get agency with profile
	const [agency] = await db
		.select()
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	if (!agency) {
		return null;
	}

	// Get members
	const members = await db
		.select({
			id: agencyMemberships.id,
			userId: agencyMemberships.userId,
			role: agencyMemberships.role,
			status: agencyMemberships.status,
			displayName: agencyMemberships.displayName,
			createdAt: agencyMemberships.createdAt,
			userEmail: users.email
		})
		.from(agencyMemberships)
		.innerJoin(users, eq(agencyMemberships.userId, users.id))
		.where(eq(agencyMemberships.agencyId, agencyId));

	// Get document counts
	const [proposalCount] = await db
		.select({ count: count() })
		.from(proposals)
		.where(eq(proposals.agencyId, agencyId));

	const [contractCount] = await db
		.select({ count: count() })
		.from(contracts)
		.where(eq(contracts.agencyId, agencyId));

	const [invoiceCount] = await db
		.select({ count: count() })
		.from(invoices)
		.where(eq(invoices.agencyId, agencyId));

	return {
		agency,
		members,
		stats: {
			proposals: proposalCount?.count ?? 0,
			contracts: contractCount?.count ?? 0,
			invoices: invoiceCount?.count ?? 0
		}
	};
});

const UpdateAgencyStatusSchema = v.object({
	agencyId: v.pipe(v.string(), v.uuid()),
	status: v.optional(v.picklist(['active', 'suspended', 'cancelled'])),
	subscriptionTier: v.optional(v.string())
});

export const updateAgencyStatus = command(UpdateAgencyStatusSchema, async (data) => {
	await requireSuperAdmin();

	const updates: Partial<typeof agencies.$inferInsert> = {
		updatedAt: new Date()
	};

	if (data.status) {
		updates.status = data.status;
	}

	if (data.subscriptionTier) {
		updates.subscriptionTier = data.subscriptionTier;
	}

	await db.update(agencies).set(updates).where(eq(agencies.id, data.agencyId));

	return { success: true };
});

// =============================================================================
// Agency Impersonation
// =============================================================================

export const impersonateAgency = command(v.pipe(v.string(), v.uuid()), async (agencyId) => {
	await requireSuperAdmin();

	// Verify agency exists
	const [agency] = await db
		.select({ id: agencies.id, slug: agencies.slug })
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	if (!agency) {
		return { success: false, error: 'Agency not found' };
	}

	// Set impersonation cookie
	setImpersonatedAgencyId(agencyId);

	return { success: true, slug: agency.slug };
});

export const stopImpersonation = command(async () => {
	await requireSuperAdmin();

	clearImpersonatedAgencyId();

	return { success: true };
});

// =============================================================================
// Users Management
// =============================================================================

const UsersFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		superAdminOnly: v.optional(v.boolean()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0)))
	})
);

export const getUsers = query(UsersFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, superAdminOnly, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (superAdminOnly) {
		conditions.push(sql`(${users.access} & ${SUPER_ADMIN_FLAG}) != 0`);
	}

	if (search) {
		conditions.push(like(users.email, `%${search}%`));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get users first
	const userList = await db
		.select({
			id: users.id,
			email: users.email,
			access: users.access,
			created: users.created
		})
		.from(users)
		.where(whereClause)
		.orderBy(desc(users.created))
		.limit(limit)
		.offset(offset);

	// Get membership counts for these users (same approach as getUserDetails)
	const userIds = userList.map((u) => u.id);
	const membershipCounts =
		userIds.length > 0
			? await db
					.select({
						userId: agencyMemberships.userId,
						count: count()
					})
					.from(agencyMemberships)
					.where(
						and(
							sql`${agencyMemberships.userId} IN (${sql.join(
								userIds.map((id) => sql`${id}`),
								sql`, `
							)})`,
							eq(agencyMemberships.status, 'active')
						)
					)
					.groupBy(agencyMemberships.userId)
			: [];

	// Create a map for quick lookup
	const countMap = new Map(membershipCounts.map((mc) => [mc.userId, mc.count]));

	// Get total count for pagination
	const [totalResult] = await db.select({ count: count() }).from(users).where(whereClause);

	return {
		users: userList.map((u) => ({
			...u,
			agencyCount: countMap.get(u.id) ?? 0,
			isSuperAdmin: (u.access & SUPER_ADMIN_FLAG) !== 0
		})),
		total: totalResult?.count ?? 0,
		limit,
		offset
	};
});

export const getUserDetails = query(v.pipe(v.string(), v.uuid()), async (userId) => {
	await requireSuperAdmin();

	// Get user
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		return null;
	}

	// Get all agency memberships
	const memberships = await db
		.select({
			id: agencyMemberships.id,
			agencyId: agencyMemberships.agencyId,
			role: agencyMemberships.role,
			status: agencyMemberships.status,
			createdAt: agencyMemberships.createdAt,
			agencyName: agencies.name,
			agencySlug: agencies.slug
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(eq(agencyMemberships.userId, userId));

	return {
		user: {
			id: user.id,
			email: user.email,
			access: user.access,
			created: user.created,
			isSuperAdmin: (user.access & SUPER_ADMIN_FLAG) !== 0
		},
		memberships
	};
});

const UpdateUserAccessSchema = v.object({
	userId: v.pipe(v.string(), v.uuid()),
	grantSuperAdmin: v.optional(v.boolean()),
	revokeSuperAdmin: v.optional(v.boolean())
});

export const updateUserAccess = command(UpdateUserAccessSchema, async (data) => {
	const admin = await requireSuperAdmin();

	// Cannot modify own super admin status
	if (data.userId === admin.userId) {
		return { success: false, error: 'Cannot modify your own super admin status' };
	}

	// Get current user
	const [user] = await db
		.select({ access: users.access })
		.from(users)
		.where(eq(users.id, data.userId))
		.limit(1);

	if (!user) {
		return { success: false, error: 'User not found' };
	}

	let newAccess = user.access;

	if (data.grantSuperAdmin) {
		newAccess = newAccess | SUPER_ADMIN_FLAG;
	}

	if (data.revokeSuperAdmin) {
		newAccess = newAccess & ~SUPER_ADMIN_FLAG;
	}

	await db.update(users).set({ access: newAccess }).where(eq(users.id, data.userId));

	return { success: true };
});

// =============================================================================
// Audit Logs
// =============================================================================

const AuditLogsFilterSchema = v.optional(
	v.object({
		agencyId: v.optional(v.pipe(v.string(), v.uuid())),
		action: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0)))
	})
);

export const getSystemAuditLogs = query(AuditLogsFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { agencyId, action, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (agencyId) {
		conditions.push(eq(agencyActivityLog.agencyId, agencyId));
	}

	if (action) {
		conditions.push(like(agencyActivityLog.action, `%${action}%`));
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get logs with agency and user info
	const logs = await db
		.select({
			id: agencyActivityLog.id,
			createdAt: agencyActivityLog.createdAt,
			action: agencyActivityLog.action,
			entityType: agencyActivityLog.entityType,
			entityId: agencyActivityLog.entityId,
			oldValues: agencyActivityLog.oldValues,
			newValues: agencyActivityLog.newValues,
			ipAddress: agencyActivityLog.ipAddress,
			agencyId: agencyActivityLog.agencyId,
			userId: agencyActivityLog.userId,
			agencyName: agencies.name,
			userEmail: users.email
		})
		.from(agencyActivityLog)
		.leftJoin(agencies, eq(agencyActivityLog.agencyId, agencies.id))
		.leftJoin(users, eq(agencyActivityLog.userId, users.id))
		.where(whereClause)
		.orderBy(desc(agencyActivityLog.createdAt))
		.limit(limit)
		.offset(offset);

	// Get total count
	const [totalResult] = await db
		.select({ count: count() })
		.from(agencyActivityLog)
		.where(whereClause);

	return {
		logs,
		total: totalResult?.count ?? 0,
		limit,
		offset
	};
});

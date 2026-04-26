/**
 * Super Admin Remote Functions
 *
 * Remote functions for platform administration.
 * All functions require super admin access.
 */

import { query, command } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import {
	agencies,
	agencyMemberships,
	users,
	proposals,
	contracts,
	invoices,
	agencyActivityLog,
} from "$lib/server/schema";
import { eq, desc, sql, and, like, or, count, inArray } from "drizzle-orm";
import {
	requireSuperAdmin,
	setImpersonatedAgencyId,
	clearImpersonatedAgencyId,
	SUPER_ADMIN_FLAG,
} from "$lib/server/super-admin";
import { error } from "@sveltejs/kit";

const FreemiumReasonSchema = v.picklist([
	"beta_tester",
	"partner",
	"promotional",
	"early_signup",
	"referral_reward",
	"internal",
]);

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
			suspended: sql<number>`COUNT(*) FILTER (WHERE ${agencies.status} = 'suspended')`,
		})
		.from(agencies);

	const [userStats] = await db.select({ total: count() }).from(users);

	// Get agencies by subscription tier
	const tierStats = await db
		.select({
			tier: agencies.subscriptionTier,
			count: count(),
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
			createdAt: agencies.createdAt,
		})
		.from(agencies)
		.orderBy(desc(agencies.createdAt))
		.limit(10);

	// Get super admin count
	const [superAdminStats] = await db
		.select({
			total: sql<number>`COUNT(*) FILTER (WHERE (${users.access} & ${SUPER_ADMIN_FLAG}) != 0)`,
		})
		.from(users);

	return {
		agencies: {
			total: agencyStats?.total ?? 0,
			active: agencyStats?.active ?? 0,
			suspended: agencyStats?.suspended ?? 0,
		},
		users: {
			total: userStats?.total ?? 0,
			superAdmins: superAdminStats?.total ?? 0,
		},
		agenciesByTier: Object.fromEntries(tierStats.map((t) => [t.tier, t.count])),
		recentAgencies,
	};
});

// =============================================================================
// Agencies Management
// =============================================================================

const AgenciesFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		status: v.optional(v.picklist(["active", "suspended", "cancelled"])),
		tier: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
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
				like(agencies.email, `%${search}%`),
			),
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
			isFreemium: agencies.isFreemium,
			createdAt: agencies.createdAt,
			memberCount: sql<number>`(
				SELECT COUNT(*) FROM ${agencyMemberships}
				WHERE ${agencyMemberships.agencyId} = ${agencies.id}
				AND ${agencyMemberships.status} = 'active'
			)`,
		})
		.from(agencies)
		.where(whereClause)
		.orderBy(desc(agencies.createdAt))
		.limit(limit)
		.offset(offset);

	// Get total count for pagination
	const [totalResult] = await db.select({ count: count() }).from(agencies).where(whereClause);

	return {
		agencies: agencyList,
		total: totalResult?.count ?? 0,
		limit,
		offset,
	};
});

export const getAgencyDetails = query(v.pipe(v.string(), v.uuid()), async (agencyId) => {
	await requireSuperAdmin();

	// Get agency with profile
	const [agency] = await db.select().from(agencies).where(eq(agencies.id, agencyId)).limit(1);

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
			userEmail: users.email,
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

	// Resolve user names for freemium granted_by / revoked_by. Skip "system:*" sentinels
	// (e.g. "system:beta_invite" written by the beta-invite flow) — those aren't UUIDs.
	const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const actorIds = [agency.freemiumGrantedBy, agency.freemiumRevokedBy].filter(
		(id): id is string => !!id && UUID_RE.test(id),
	);
	const actorMap = new Map<string, string>();
	if (actorIds.length > 0) {
		const rows = await db
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(inArray(users.id, actorIds));
		for (const r of rows) actorMap.set(r.id, r.email);
	}

	return {
		agency: {
			...agency,
			freemiumGrantedByName: agency.freemiumGrantedBy
				? (actorMap.get(agency.freemiumGrantedBy) ?? null)
				: null,
			freemiumRevokedByName: agency.freemiumRevokedBy
				? (actorMap.get(agency.freemiumRevokedBy) ?? null)
				: null,
		},
		members,
		stats: {
			proposals: proposalCount?.count ?? 0,
			contracts: contractCount?.count ?? 0,
			invoices: invoiceCount?.count ?? 0,
		},
	};
});

const UpdateAgencyAccessSchema = v.object({
	agencyId: v.pipe(v.string(), v.uuid()),
	status: v.optional(v.picklist(["active", "suspended", "cancelled"])),
	subscriptionTier: v.optional(v.string()),
	freemium: v.optional(
		v.object({
			enabled: v.boolean(),
			reason: v.optional(FreemiumReasonSchema),
			expiresAt: v.optional(v.nullable(v.pipe(v.string(), v.isoTimestamp()))),
		}),
	),
});

/**
 * Unified agency access command. Replaces updateAgencyStatus, revokeAgencyFreemium,
 * and updateFreemiumExpiry. The whole body runs inside one transaction so a failed
 * activity-log insert rolls back the agency update.
 *
 * Freemium payload semantics: desired end-state for the freemium section, not a partial
 * patch. When `freemium` is present, every field describes the target. Omitting the key
 * entirely leaves the agency's freemium columns alone.
 */
export const updateAgencyAccess = command(UpdateAgencyAccessSchema, async (data) => {
	const { userId } = await requireSuperAdmin();

	return await db.transaction(async (tx) => {
		const [currentAgency] = await tx
			.select()
			.from(agencies)
			.where(eq(agencies.id, data.agencyId))
			.limit(1);

		if (!currentAgency) {
			throw error(404, "Agency not found");
		}

		const updates: Partial<typeof agencies.$inferInsert> = {};
		const logEntries: Array<typeof agencyActivityLog.$inferInsert> = [];
		const now = new Date();

		// Status / tier
		if (data.status && data.status !== currentAgency.status) {
			updates.status = data.status;
			logEntries.push({
				agencyId: data.agencyId,
				userId,
				action: "agency.status_changed",
				entityType: "agency",
				entityId: data.agencyId,
				oldValues: { status: currentAgency.status },
				newValues: { status: data.status },
				metadata: { source: "super_admin" },
			});
		}

		if (data.subscriptionTier && data.subscriptionTier !== currentAgency.subscriptionTier) {
			updates.subscriptionTier = data.subscriptionTier;
			const tierOrder = ["free", "starter", "growth", "agency_pro"];
			const oldIdx = tierOrder.indexOf(currentAgency.subscriptionTier);
			const newIdx = tierOrder.indexOf(data.subscriptionTier);
			const action = newIdx > oldIdx ? "subscription.upgraded" : "subscription.downgraded";
			logEntries.push({
				agencyId: data.agencyId,
				userId,
				action,
				entityType: "agency",
				entityId: data.agencyId,
				oldValues: { subscriptionTier: currentAgency.subscriptionTier },
				newValues: { subscriptionTier: data.subscriptionTier },
				metadata: { source: "super_admin" },
			});
		}

		// Freemium
		if (data.freemium) {
			const wasEnabled = currentAgency.isFreemium;
			const willBeEnabled = data.freemium.enabled;

			if (wasEnabled && !willBeEnabled) {
				// enable → disable
				updates.isFreemium = false;
				updates.freemiumRevokedBy = userId;
				updates.freemiumRevokedAt = now;
				logEntries.push({
					agencyId: data.agencyId,
					userId,
					action: "freemium.revoked",
					entityType: "agency",
					entityId: data.agencyId,
					oldValues: {
						reason: currentAgency.freemiumReason,
						expiresAt: currentAgency.freemiumExpiresAt,
					},
					newValues: {},
					metadata: { source: "super_admin" },
				});
			} else if (!wasEnabled && willBeEnabled) {
				// disable → enable
				if (!data.freemium.reason) {
					throw error(400, "Freemium reason is required when granting access");
				}
				const expiresAt = data.freemium.expiresAt ? new Date(data.freemium.expiresAt) : null;
				updates.isFreemium = true;
				updates.freemiumReason = data.freemium.reason;
				updates.freemiumGrantedAt = now;
				updates.freemiumGrantedBy = userId;
				updates.freemiumExpiresAt = expiresAt;
				updates.freemiumRevokedAt = null;
				updates.freemiumRevokedBy = null;
				logEntries.push({
					agencyId: data.agencyId,
					userId,
					action: "freemium.granted",
					entityType: "agency",
					entityId: data.agencyId,
					oldValues: {},
					newValues: { reason: data.freemium.reason, expiresAt },
					metadata: { source: "super_admin" },
				});
			} else if (wasEnabled && willBeEnabled) {
				// edit in place — preserve grantedAt/grantedBy
				const oldDelta: Record<string, unknown> = {};
				const newDelta: Record<string, unknown> = {};

				if (data.freemium.reason && data.freemium.reason !== currentAgency.freemiumReason) {
					updates.freemiumReason = data.freemium.reason;
					oldDelta["reason"] = currentAgency.freemiumReason;
					newDelta["reason"] = data.freemium.reason;
				}

				if (data.freemium.expiresAt !== undefined) {
					const nextExpiresAt = data.freemium.expiresAt ? new Date(data.freemium.expiresAt) : null;
					const prevMs = currentAgency.freemiumExpiresAt?.getTime() ?? null;
					const nextMs = nextExpiresAt?.getTime() ?? null;
					if (prevMs !== nextMs) {
						updates.freemiumExpiresAt = nextExpiresAt;
						oldDelta["expiresAt"] = currentAgency.freemiumExpiresAt;
						newDelta["expiresAt"] = nextExpiresAt;
					}
				}

				if (Object.keys(newDelta).length > 0) {
					logEntries.push({
						agencyId: data.agencyId,
						userId,
						action: "freemium.updated",
						entityType: "agency",
						entityId: data.agencyId,
						oldValues: oldDelta,
						newValues: newDelta,
						metadata: { source: "super_admin" },
					});
				}
			}
			// !wasEnabled && !willBeEnabled → no-op
		}

		// Skip the write entirely when no meaningful field changed — keeps updated_at
		// truthful as "last meaningful change" rather than "last submit click".
		if (Object.keys(updates).length === 0) {
			return { success: true, agency: currentAgency };
		}

		updates.updatedAt = now;
		await tx.update(agencies).set(updates).where(eq(agencies.id, data.agencyId));

		if (logEntries.length > 0) {
			await tx.insert(agencyActivityLog).values(logEntries);
		}

		const [updated] = await tx
			.select()
			.from(agencies)
			.where(eq(agencies.id, data.agencyId))
			.limit(1);

		return { success: true, agency: updated };
	});
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
		return { success: false, error: "Agency not found" };
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
		ownersOnly: v.optional(v.boolean()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

export const getUsers = query(UsersFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, superAdminOnly, ownersOnly, limit = 50, offset = 0 } = filters || {};

	// Build where conditions
	const conditions = [];

	if (superAdminOnly) {
		conditions.push(sql`(${users.access} & ${SUPER_ADMIN_FLAG}) != 0`);
	}

	if (search) {
		conditions.push(like(users.email, `%${search}%`));
	}

	// Filter for owners only
	if (ownersOnly) {
		conditions.push(
			sql`EXISTS (
				SELECT 1 FROM ${agencyMemberships}
				WHERE ${agencyMemberships.userId} = ${users.id}
				AND ${agencyMemberships.role} = 'owner'
				AND ${agencyMemberships.status} = 'active'
			)`,
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get users first
	const userList = await db
		.select({
			id: users.id,
			email: users.email,
			access: users.access,
			created: users.created,
			suspended: users.suspended,
		})
		.from(users)
		.where(whereClause)
		.orderBy(desc(users.created))
		.limit(limit)
		.offset(offset);

	// Get membership info for these users (agency name and role)
	const userIds = userList.map((u) => u.id);
	const memberships =
		userIds.length > 0
			? await db
					.select({
						userId: agencyMemberships.userId,
						role: agencyMemberships.role,
						agencyName: agencies.name,
					})
					.from(agencyMemberships)
					.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
					.where(
						and(
							sql`${agencyMemberships.userId} IN (${sql.join(
								userIds.map((id) => sql`${id}`),
								sql`, `,
							)})`,
							eq(agencyMemberships.status, "active"),
						),
					)
			: [];

	// Group memberships by user - get primary agency (owner role first, then first agency)
	const userMembershipMap = new Map<string, { agencyName: string; role: string; count: number }>();
	for (const m of memberships) {
		const existing = userMembershipMap.get(m.userId);
		if (!existing) {
			userMembershipMap.set(m.userId, { agencyName: m.agencyName, role: m.role, count: 1 });
		} else {
			existing.count++;
			// Prefer owner role for display
			if (m.role === "owner" && existing.role !== "owner") {
				existing.agencyName = m.agencyName;
				existing.role = m.role;
			}
		}
	}

	// Get total count for pagination
	const [totalResult] = await db.select({ count: count() }).from(users).where(whereClause);

	return {
		users: userList.map((u) => {
			const membershipInfo = userMembershipMap.get(u.id);
			return {
				...u,
				agencyCount: membershipInfo?.count ?? 0,
				agencyName: membershipInfo?.agencyName ?? null,
				primaryRole: membershipInfo?.role ?? null,
				isSuperAdmin: (u.access & SUPER_ADMIN_FLAG) !== 0,
				isSuspended: u.suspended,
			};
		}),
		total: totalResult?.count ?? 0,
		limit,
		offset,
	};
});

export const getUserDetails = query(v.pipe(v.string(), v.uuid()), async (userId) => {
	await requireSuperAdmin();

	// Get user
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

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
			agencySlug: agencies.slug,
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
			isSuperAdmin: (user.access & SUPER_ADMIN_FLAG) !== 0,
			suspended: user.suspended,
			suspendedAt: user.suspendedAt,
			suspendedReason: user.suspendedReason,
		},
		memberships,
	};
});

const UpdateUserAccessSchema = v.object({
	userId: v.pipe(v.string(), v.uuid()),
	grantSuperAdmin: v.optional(v.boolean()),
	revokeSuperAdmin: v.optional(v.boolean()),
});

export const updateUserAccess = command(UpdateUserAccessSchema, async (data) => {
	const admin = await requireSuperAdmin();

	// Cannot modify own super admin status
	if (data.userId === admin.userId) {
		return { success: false, error: "Cannot modify your own super admin status" };
	}

	// Get current user
	const [user] = await db
		.select({ access: users.access })
		.from(users)
		.where(eq(users.id, data.userId))
		.limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
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
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
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
			userEmail: users.email,
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
		offset,
	};
});

// =============================================================================
// Freemium Management
// =============================================================================

const FreemiumAgenciesFilterSchema = v.optional(
	v.object({
		search: v.optional(v.string()),
		reason: v.optional(v.string()),
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
		offset: v.optional(v.pipe(v.number(), v.minValue(0))),
	}),
);

/**
 * Get all agencies with freemium status
 */
export const getFreemiumAgencies = query(FreemiumAgenciesFilterSchema, async (filters) => {
	await requireSuperAdmin();

	const { search, reason, limit = 50, offset = 0 } = filters || {};

	// Build where conditions - always filter for freemium agencies
	const conditions = [eq(agencies.isFreemium, true)];

	if (reason) {
		conditions.push(eq(agencies.freemiumReason, reason));
	}

	if (search) {
		const searchCondition = or(
			like(agencies.name, `%${search}%`),
			like(agencies.slug, `%${search}%`),
			like(agencies.email, `%${search}%`),
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	// conditions always has at least one element (isFreemium filter)
	const whereClause = and(...conditions)!;

	// Get freemium agencies with owner info
	const agencyList = await db
		.select({
			id: agencies.id,
			name: agencies.name,
			slug: agencies.slug,
			email: agencies.email,
			status: agencies.status,
			isFreemium: agencies.isFreemium,
			freemiumReason: agencies.freemiumReason,
			freemiumExpiresAt: agencies.freemiumExpiresAt,
			freemiumGrantedAt: agencies.freemiumGrantedAt,
			freemiumGrantedBy: agencies.freemiumGrantedBy,
			createdAt: agencies.createdAt,
		})
		.from(agencies)
		.where(whereClause)
		.orderBy(desc(agencies.freemiumGrantedAt))
		.limit(limit)
		.offset(offset);

	// Get owner emails for each agency
	const agencyIds = agencyList.map((a) => a.id);
	const owners =
		agencyIds.length > 0
			? await db
					.select({
						agencyId: agencyMemberships.agencyId,
						ownerEmail: users.email,
					})
					.from(agencyMemberships)
					.innerJoin(users, eq(agencyMemberships.userId, users.id))
					.where(
						and(
							sql`${agencyMemberships.agencyId} IN (${sql.join(
								agencyIds.map((id) => sql`${id}`),
								sql`, `,
							)})`,
							eq(agencyMemberships.role, "owner"),
						),
					)
			: [];

	// Create owner map
	const ownerMap = new Map(owners.map((o) => [o.agencyId, o.ownerEmail]));

	// Get total count
	const [totalResult] = await db.select({ count: count() }).from(agencies).where(whereClause);

	// Get stats by reason
	const reasonStats = await db
		.select({
			reason: agencies.freemiumReason,
			count: count(),
		})
		.from(agencies)
		.where(eq(agencies.isFreemium, true))
		.groupBy(agencies.freemiumReason);

	return {
		agencies: agencyList.map((a) => ({
			...a,
			ownerEmail: ownerMap.get(a.id) || null,
		})),
		total: totalResult?.count ?? 0,
		stats: Object.fromEntries(reasonStats.map((r) => [r.reason || "unknown", r.count])),
		limit,
		offset,
	};
});

// =============================================================================
// User Management (Super Admin)
// =============================================================================

const RemoveUserFromAgencySchema = v.object({
	userId: v.pipe(v.string(), v.uuid()),
	agencyId: v.pipe(v.string(), v.uuid()),
});

/**
 * Remove a user from a specific agency
 * Deletes their membership but keeps the user account
 */
export const removeUserFromAgency = command(RemoveUserFromAgencySchema, async (data) => {
	await requireSuperAdmin();

	const { userId, agencyId } = data;

	// Check membership exists
	const [membership] = await db
		.select({ id: agencyMemberships.id, role: agencyMemberships.role })
		.from(agencyMemberships)
		.where(and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.agencyId, agencyId)))
		.limit(1);

	if (!membership) {
		return { success: false, error: "User is not a member of this agency" };
	}

	// Prevent removing the only owner
	if (membership.role === "owner") {
		const [ownerCount] = await db
			.select({ count: count() })
			.from(agencyMemberships)
			.where(and(eq(agencyMemberships.agencyId, agencyId), eq(agencyMemberships.role, "owner")));

		if ((ownerCount?.count ?? 0) <= 1) {
			return { success: false, error: "Cannot remove the only owner from an agency" };
		}
	}

	// Delete the membership
	await db.delete(agencyMemberships).where(eq(agencyMemberships.id, membership.id));

	return { success: true };
});

const SuspendUserSchema = v.object({
	userId: v.pipe(v.string(), v.uuid()),
	reason: v.optional(v.string()),
});

/**
 * Suspend a user account
 * Prevents the user from logging in while preserving all their data
 */
export const suspendUser = command(SuspendUserSchema, async (data) => {
	const admin = await requireSuperAdmin();

	const { userId, reason } = data;

	// Cannot suspend yourself
	if (userId === admin.userId) {
		return { success: false, error: "Cannot suspend your own account" };
	}

	// Check user exists
	const [user] = await db
		.select({ id: users.id, suspended: users.suspended })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
	}

	if (user.suspended) {
		return { success: false, error: "User is already suspended" };
	}

	await db
		.update(users)
		.set({
			suspended: true,
			suspendedAt: new Date(),
			suspendedReason: reason || null,
		})
		.where(eq(users.id, userId));

	return { success: true };
});

/**
 * Remove suspension from a user account
 * Restores their ability to log in
 */
export const unsuspendUser = command(v.pipe(v.string(), v.uuid()), async (userId) => {
	await requireSuperAdmin();

	// Check user exists
	const [user] = await db
		.select({ id: users.id, suspended: users.suspended })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
	}

	if (!user.suspended) {
		return { success: false, error: "User is not suspended" };
	}

	await db
		.update(users)
		.set({
			suspended: false,
			suspendedAt: null,
			suspendedReason: null,
		})
		.where(eq(users.id, userId));

	return { success: true };
});

/**
 * Permanently delete a user account
 * Removes the user and all their agency memberships
 */
export const deleteUser = command(v.pipe(v.string(), v.uuid()), async (userId) => {
	const admin = await requireSuperAdmin();

	// Cannot delete yourself
	if (userId === admin.userId) {
		return { success: false, error: "Cannot delete your own account" };
	}

	// Check user exists
	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

	if (!user) {
		return { success: false, error: "User not found" };
	}

	// Check if user is the only owner of any agency
	const ownedAgencies = await db
		.select({
			agencyId: agencyMemberships.agencyId,
			agencyName: agencies.name,
		})
		.from(agencyMemberships)
		.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
		.where(and(eq(agencyMemberships.userId, userId), eq(agencyMemberships.role, "owner")));

	for (const owned of ownedAgencies) {
		const [ownerCount] = await db
			.select({ count: count() })
			.from(agencyMemberships)
			.where(
				and(eq(agencyMemberships.agencyId, owned.agencyId), eq(agencyMemberships.role, "owner")),
			);

		if ((ownerCount?.count ?? 0) <= 1) {
			return {
				success: false,
				error: `Cannot delete user: they are the only owner of "${owned.agencyName}". Transfer ownership first.`,
			};
		}
	}

	// Delete all memberships first
	await db.delete(agencyMemberships).where(eq(agencyMemberships.userId, userId));

	// Delete the user
	await db.delete(users).where(eq(users.id, userId));

	return { success: true };
});

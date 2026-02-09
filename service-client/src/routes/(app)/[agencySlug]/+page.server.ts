/**
 * Dashboard Page Server Load
 *
 * Loads data for the agency dashboard including:
 * - Consultation counts for statistics
 * - Demo data status (for onboarding)
 * - Profile completeness (for onboarding)
 * - Team member count, open proposals, pending invoices, revenue
 * - Recent activity feed
 */

import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import {
	consultations,
	agencyProfiles,
	agencyMemberships,
	proposals,
	invoices,
	agencyActivityLog,
} from "$lib/server/schema";
import { eq, count, and, sql, gte, inArray, desc } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
	// Get agency context from layout
	const { agency } = await parent();
	const agencyId = agency.id;

	// First of current month for time-scoped queries
	const firstOfMonth = new Date();
	firstOfMonth.setDate(1);
	firstOfMonth.setHours(0, 0, 0, 0);

	// Run all stat queries in parallel
	const [
		consultationStats,
		completedStats,
		teamStats,
		proposalStats,
		invoiceStats,
		revenueStats,
		profile,
		activities,
	] = await Promise.all([
		// 1. Active consultations count
		db
			.select({ count: count() })
			.from(consultations)
			.where(eq(consultations.agencyId, agencyId)),

		// 2. Completed this month (status = 'completed' and updatedAt in current month)
		db
			.select({ count: count() })
			.from(consultations)
			.where(
				and(
					eq(consultations.agencyId, agencyId),
					eq(consultations.status, "completed"),
					gte(consultations.updatedAt, firstOfMonth),
				),
			),

		// 3. Team members (active memberships)
		db
			.select({ count: count() })
			.from(agencyMemberships)
			.where(
				and(
					eq(agencyMemberships.agencyId, agencyId),
					eq(agencyMemberships.status, "active"),
				),
			),

		// 4. Open proposals (sent or viewed)
		db
			.select({ count: count() })
			.from(proposals)
			.where(
				and(
					eq(proposals.agencyId, agencyId),
					inArray(proposals.status, ["sent", "viewed"]),
				),
			),

		// 5. Pending invoices (sent)
		db
			.select({ count: count() })
			.from(invoices)
			.where(
				and(
					eq(invoices.agencyId, agencyId),
					eq(invoices.status, "sent"),
				),
			),

		// 6. Revenue this month (paid invoices)
		db
			.select({
				total: sql<string>`COALESCE(SUM(${invoices.total}), '0')`,
			})
			.from(invoices)
			.where(
				and(
					eq(invoices.agencyId, agencyId),
					eq(invoices.status, "paid"),
					gte(invoices.paidAt, firstOfMonth),
				),
			),

		// Profile completeness check
		db
			.select({
				abn: agencyProfiles.abn,
				legalEntityName: agencyProfiles.legalEntityName,
				addressLine1: agencyProfiles.addressLine1,
				city: agencyProfiles.city,
				state: agencyProfiles.state,
				postcode: agencyProfiles.postcode,
			})
			.from(agencyProfiles)
			.where(eq(agencyProfiles.agencyId, agencyId))
			.limit(1),

		// Recent activity (last 10 items)
		db
			.select({
				id: agencyActivityLog.id,
				createdAt: agencyActivityLog.createdAt,
				action: agencyActivityLog.action,
				entityType: agencyActivityLog.entityType,
				entityId: agencyActivityLog.entityId,
				userId: agencyActivityLog.userId,
				newValues: agencyActivityLog.newValues,
			})
			.from(agencyActivityLog)
			.where(eq(agencyActivityLog.agencyId, agencyId))
			.orderBy(desc(agencyActivityLog.createdAt))
			.limit(10),
	]);

	// Resolve user names for activity feed
	const userIds = [
		...new Set(activities.filter((a) => a.userId).map((a) => a.userId!)),
	];
	let userMap = new Map<string, string>();

	if (userIds.length > 0) {
		const members = await db
			.select({
				userId: agencyMemberships.userId,
				displayName: agencyMemberships.displayName,
			})
			.from(agencyMemberships)
			.where(eq(agencyMemberships.agencyId, agencyId));

		for (const m of members) {
			if (m.displayName) userMap.set(m.userId, m.displayName);
		}
	}

	const recentActivity = activities.map((a) => ({
		id: a.id,
		createdAt: a.createdAt.toISOString(),
		action: a.action,
		entityType: a.entityType,
		entityId: a.entityId,
		userId: a.userId,
		userName: a.userId ? (userMap.get(a.userId) ?? "Unknown") : "System",
		newValues: a.newValues as Record<string, unknown> | null,
	}));

	// Check if demo data exists
	const hasDemoData =
		consultationStats[0] && Number(consultationStats[0].count) > 0;

	// Profile is complete if key business fields are filled
	const profileRow = profile[0];
	const isProfileComplete = !!(
		profileRow &&
		profileRow.legalEntityName &&
		profileRow.addressLine1 &&
		profileRow.city &&
		profileRow.state &&
		profileRow.postcode
	);

	const consultationCount = Number(consultationStats[0]?.count ?? 0);

	return {
		consultationCount,
		completedThisMonth: Number(completedStats[0]?.count ?? 0),
		teamMemberCount: Number(teamStats[0]?.count ?? 0),
		openProposalCount: Number(proposalStats[0]?.count ?? 0),
		pendingInvoiceCount: Number(invoiceStats[0]?.count ?? 0),
		revenueThisMonth: revenueStats[0]?.total ?? "0",
		recentActivity,
		hasDemoData,
		isProfileComplete,
		isNewAgency: consultationCount === 0,
	};
};

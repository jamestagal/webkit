import type { PageServerLoad } from "./$types";
import { hasFeature } from "$lib/server/subscription";
import { db } from "$lib/server/db";
import {
	consultations,
	proposals,
	invoices,
	agencyActivityLog,
	agencyMemberships,
} from "$lib/server/schema";
import { eq, and, sql, gte, count } from "drizzle-orm";

export const load: PageServerLoad = async ({ parent }) => {
	const { agency } = await parent();

	// Tier gate: analytics feature required (Growth+ only)
	const canAccessReports = await hasFeature("analytics");

	if (!canAccessReports) {
		return {
			gated: true as const,
			agency,
		};
	}

	const agencyId = agency.id;

	// Get data for the last 6 months
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
	sixMonthsAgo.setDate(1);
	sixMonthsAgo.setHours(0, 0, 0, 0);

	// Monthly revenue (paid invoices grouped by month)
	const monthlyRevenue = await db
		.select({
			month: sql<string>`to_char(${invoices.paidAt}, 'YYYY-MM')`,
			total: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`,
		})
		.from(invoices)
		.where(
			and(
				eq(invoices.agencyId, agencyId),
				eq(invoices.status, "paid"),
				gte(invoices.paidAt, sixMonthsAgo),
			),
		)
		.groupBy(sql`to_char(${invoices.paidAt}, 'YYYY-MM')`)
		.orderBy(sql`to_char(${invoices.paidAt}, 'YYYY-MM')`);

	// Consultation pipeline (status breakdown)
	const consultationPipeline = await db
		.select({
			status: consultations.status,
			count: count(),
		})
		.from(consultations)
		.where(eq(consultations.agencyId, agencyId))
		.groupBy(consultations.status);

	// Proposal conversion (status breakdown)
	const proposalStats = await db
		.select({
			status: proposals.status,
			count: count(),
		})
		.from(proposals)
		.where(eq(proposals.agencyId, agencyId))
		.groupBy(proposals.status);

	// Invoice aging (unpaid invoices by days outstanding)
	const unpaidInvoices = await db
		.select({
			dueDate: invoices.dueDate,
			total: invoices.total,
		})
		.from(invoices)
		.where(
			and(
				eq(invoices.agencyId, agencyId),
				eq(invoices.status, "sent"),
			),
		);

	const now = new Date();
	const agingBuckets = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
	for (const inv of unpaidInvoices) {
		const daysOverdue = Math.floor(
			(now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24),
		);
		const amount = parseFloat(inv.total);
		if (daysOverdue <= 0) agingBuckets.current += amount;
		else if (daysOverdue <= 30) agingBuckets.overdue30 += amount;
		else if (daysOverdue <= 60) agingBuckets.overdue60 += amount;
		else agingBuckets.overdue90 += amount;
	}

	// Team activity (actions per member in last 30 days)
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const teamActivity = await db
		.select({
			userId: agencyActivityLog.userId,
			actionCount: count(),
		})
		.from(agencyActivityLog)
		.where(
			and(
				eq(agencyActivityLog.agencyId, agencyId),
				gte(agencyActivityLog.createdAt, thirtyDaysAgo),
			),
		)
		.groupBy(agencyActivityLog.userId);

	// Resolve user names for team activity
	const memberNames = await db
		.select({
			userId: agencyMemberships.userId,
			displayName: agencyMemberships.displayName,
		})
		.from(agencyMemberships)
		.where(eq(agencyMemberships.agencyId, agencyId));

	const nameMap = new Map(memberNames.map((m) => [m.userId, m.displayName || "Unknown"]));

	// Format monthly revenue labels
	const revenueLabels = monthlyRevenue.map((r) => {
		const [year, month] = (r.month ?? "").split("-");
		const date = new Date(parseInt(year ?? "0"), parseInt(month ?? "1") - 1);
		return date.toLocaleDateString("en-AU", { month: "short" });
	});
	const revenueData = monthlyRevenue.map((r) => parseFloat(r.total ?? "0"));

	return {
		gated: false as const,
		agency,
		revenue: { labels: revenueLabels, data: revenueData },
		consultationPipeline: consultationPipeline.map((c) => ({
			status: c.status,
			count: Number(c.count),
		})),
		proposalStats: proposalStats.map((p) => ({
			status: p.status,
			count: Number(p.count),
		})),
		agingBuckets,
		teamActivity: teamActivity.map((t) => ({
			name: nameMap.get(t.userId ?? "") ?? "System",
			actions: Number(t.actionCount),
		})),
	};
};

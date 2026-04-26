import { query } from "$app/server";
import * as v from "valibot";
import { db } from "$lib/server/db";
import { agencyActivityLog, agencyMemberships } from "$lib/server/schema";
import { getAgencyContext } from "$lib/server/agency";
import { eq, desc } from "drizzle-orm";

const ActivityFiltersSchema = v.optional(
	v.object({
		limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
	}),
);

export const getRecentActivity = query(ActivityFiltersSchema, async (filters) => {
	const context = await getAgencyContext();
	const limit = filters?.limit ?? 10;

	const activities = await db
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
		.where(eq(agencyActivityLog.agencyId, context.agencyId))
		.orderBy(desc(agencyActivityLog.createdAt))
		.limit(limit);

	// Resolve user names for activities with userId
	const userIds = [...new Set(activities.filter((a) => a.userId).map((a) => a.userId!))];
	let userMap = new Map<string, string>();

	if (userIds.length > 0) {
		const members = await db
			.select({
				userId: agencyMemberships.userId,
				displayName: agencyMemberships.displayName,
			})
			.from(agencyMemberships)
			.where(eq(agencyMemberships.agencyId, context.agencyId));

		for (const m of members) {
			if (m.displayName) userMap.set(m.userId, m.displayName);
		}
	}

	return activities.map((a) => ({
		...a,
		createdAt: a.createdAt.toISOString(),
		userName: a.userId ? (userMap.get(a.userId) ?? "Unknown") : "System",
	}));
});

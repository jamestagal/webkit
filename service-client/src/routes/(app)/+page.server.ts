import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { agencies, agencyMemberships, users } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";

export const load: import("./$types").PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;

	if (userId) {
		// Get user's default agency
		const [user] = await db
			.select({ defaultAgencyId: users.defaultAgencyId })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		let agencySlug: string | null = null;

		if (user?.defaultAgencyId) {
			// Get the default agency's slug
			const [agency] = await db
				.select({ slug: agencies.slug })
				.from(agencies)
				.where(and(eq(agencies.id, user.defaultAgencyId), eq(agencies.status, "active")))
				.limit(1);

			agencySlug = agency?.slug ?? null;
		}

		// If no default agency, get agency where user has highest role (owner > admin > member)
		if (!agencySlug) {
			const memberships = await db
				.select({
					slug: agencies.slug,
					role: agencyMemberships.role,
				})
				.from(agencyMemberships)
				.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
				.where(
					and(
						eq(agencyMemberships.userId, userId),
						eq(agencyMemberships.status, "active"),
						eq(agencies.status, "active"),
					),
				);

			// Prioritize by role: owner first, then admin, then member
			const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
			const sorted = memberships.sort(
				(a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3),
			);

			agencySlug = sorted[0]?.slug ?? null;
		}

		// Redirect to agency dashboard if user has one
		if (agencySlug) {
			throw redirect(302, `/${agencySlug}`);
		}
	}

	// If no agency, show welcome/create agency page
	return {
		email: locals.user.email,
		avatar: locals.user.avatar,
		subscription_active: locals.user.subscription_active,
	};
};

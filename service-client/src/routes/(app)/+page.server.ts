import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { agencies, agencyMemberships, users } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { verifyJWT } from "$lib/server/jwt";
import type { User } from "$lib/types";

/**
 * Root page handler: serves landing page (public) or redirects to agency dashboard.
 *
 * Since "/" is a public route (no hooks auth), we manually verify the JWT here
 * to check if the user is logged in. This keeps the hooks auth flow completely
 * untouched for all other routes while allowing "/" to serve the landing page.
 */
export const load: import("./$types").PageServerLoad = async ({ cookies }) => {
	// Manually check auth — hooks skip auth for "/" (public route)
	const access_token = cookies.get("access_token") ?? "";
	const refresh_token = cookies.get("refresh_token") ?? "";

	// No tokens at all — show landing page
	if (!access_token && !refresh_token) {
		return { isAuthenticated: false, email: "", avatar: "", subscription_active: false };
	}

	// Try to verify the access token
	const user = await verifyJWT<User>(access_token);
	const userId = user?.id ?? "";

	if (userId) {
		// Get user's default agency
		const [dbUser] = await db
			.select({ defaultAgencyId: users.defaultAgencyId })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		let agencySlug: string | null = null;

		if (dbUser?.defaultAgencyId) {
			// Get the default agency's slug
			const [agency] = await db
				.select({ slug: agencies.slug })
				.from(agencies)
				.where(and(eq(agencies.id, dbUser.defaultAgencyId), eq(agencies.status, "active")))
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

		// Authenticated but no agency — show create agency page
		return {
			isAuthenticated: true,
			email: user?.email ?? "",
			avatar: user?.avatar ?? "",
			subscription_active: user?.subscription_active ?? false,
		};
	}

	// Token exists but expired/invalid — show landing page
	// (Don't attempt refresh here; they'll get refreshed when they visit any auth route)
	return { isAuthenticated: false, email: "", avatar: "", subscription_active: false };
};

import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { agencies, agencyMemberships, users } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";
import { verifyJWT } from "$lib/server/jwt";
import type { User } from "$lib/types";

/**
 * Root page handler.
 *
 * Post-cutover (PR3 / marketing-site-astro): the public landing has moved
 * to webkit.au (Astro Worker). Unauthenticated visitors to app.webkit.au/
 * are redirected to /login — the SvelteKit app no longer serves a public
 * landing page.
 *
 * "/" is still a public route (no hooks auth) so we manually verify the
 * JWT here to decide between /login redirect (unauth) and the agency
 * dashboard / create-agency card (auth).
 */
export const load: import("./$types").PageServerLoad = async ({ cookies }) => {
	const access_token = cookies.get("access_token") ?? "";
	const refresh_token = cookies.get("refresh_token") ?? "";

	if (!access_token && !refresh_token) {
		throw redirect(302, "/login");
	}

	const user = await verifyJWT<User>(access_token);
	const userId = user?.id ?? "";

	if (!userId) {
		// Token present but expired/invalid — same UX as no token.
		throw redirect(302, "/login");
	}

	const [dbUser] = await db
		.select({ defaultAgencyId: users.defaultAgencyId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	let agencySlug: string | null = null;

	if (dbUser?.defaultAgencyId) {
		const [agency] = await db
			.select({ slug: agencies.slug })
			.from(agencies)
			.where(and(eq(agencies.id, dbUser.defaultAgencyId), eq(agencies.status, "active")))
			.limit(1);

		agencySlug = agency?.slug ?? null;
	}

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

		const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 };
		const sorted = memberships.sort(
			(a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3),
		);

		agencySlug = sorted[0]?.slug ?? null;
	}

	if (agencySlug) {
		throw redirect(302, `/${agencySlug}`);
	}

	// Authenticated but no agency — show create-agency card.
	return {
		isAuthenticated: true,
		email: user?.email ?? "",
		avatar: user?.avatar ?? "",
		subscription_active: user?.subscription_active ?? false,
	};
};

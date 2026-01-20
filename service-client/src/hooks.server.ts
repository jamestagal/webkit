import { logger, perf } from "./lib/server/logger";
import { error, redirect, type Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
import { verifyJWT } from "./lib/server/jwt";
import { refresh, TokenRefreshError } from "./lib/server/refresh";
import type { Session, User } from "./lib/types";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { agencyMemberships, agencies } from "$lib/server/schema";
import { eq, and } from "drizzle-orm";

/**
 * Check if this is a remote function (RPC) request.
 * Remote functions don't support redirect() - they need HTTP errors instead.
 */
function isRemoteFunctionRequest(event: { request: Request; url: URL }): boolean {
	// Remote functions use POST and go through SvelteKit's RPC mechanism
	if (event.request.method === "POST") {
		// Check for common RPC patterns
		const contentType = event.request.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			return true;
		}
	}
	return false;
}

// Cookie name for current agency (must match agency.ts)
const CURRENT_AGENCY_COOKIE = "current_agency_id";

export const handle: Handle = async ({ event, resolve }) => {
	const end = perf("handle");

	logger.debug(event.url.pathname);
	if (building) {
		return await resolve(event);
	}

	event.locals.user = {
		id: "",
		email: "",
		access: 0,
		avatar: "",
		subscription_active: false,
		phone: "",
	};

	if (event.url.pathname === "/login") {
		event.cookies.set("access_token", "", {
			path: "/",
			maxAge: 0,
			domain: env.DOMAIN,
		});
		event.cookies.set("refresh_token", "", {
			path: "/",
			maxAge: 0,
			domain: env.DOMAIN,
		});
		return await resolve(event);
	}

	// Check if we are on the 2FA login page
	if (event.url.pathname === "/login/phone" || event.url.pathname === "/login/verify") {
		const session_token = event.cookies.get("session_token");
		if (!session_token) {
			throw redirect(302, "/login");
		}
		const session = await verifyJWT<Session>(session_token);
		if (!session) {
			throw redirect(302, "/login");
		}
		event.locals.session = session_token;
		event.locals.user.phone = session.phone;
		return await resolve(event);
	}

	// Check if we have a token. If not, redirect to the auth page
	let access_token = event.cookies.get("access_token") ?? "";
	const refresh_token = event.cookies.get("refresh_token") ?? "";

	// Debug logging for auth flow (helps diagnose production session issues)
	logger.debug(
		`Auth check: path=${event.url.pathname}, hasAccessToken=${!!access_token}, hasRefreshToken=${!!refresh_token}`,
	);

	if (!refresh_token) {
		logger.debug("No refresh_token cookie found - redirecting to login");
		throw redirect(302, "/login");
	}
	if (event.url.pathname === "/payments") {
		access_token = "";
	}

	let user = await verifyJWT<User>(access_token);
	// If the token is invalid, refresh the token
	// JWT token holds the information about subscription status, so we need to refresh it
	if (!user) {
		logger.debug(`Access token invalid/expired for path=${event.url.pathname}, attempting refresh`);
		try {
			access_token = await refresh(event, access_token, refresh_token);
			user = await verifyJWT(access_token);
			if (!user) {
				logger.error("Token verification failed after successful refresh");
				if (isRemoteFunctionRequest(event)) {
					throw error(401, "Session expired. Please log in again.");
				}
				throw redirect(302, "/login");
			}
			logger.debug("Token refresh successful");
		} catch (e) {
			if (e instanceof TokenRefreshError) {
				logger.error(`Token refresh failed for path=${event.url.pathname}: ${e.message}`);
				// For remote functions (commands), throw HTTP error instead of redirect
				if (isRemoteFunctionRequest(event)) {
					throw error(401, e.message);
				}
				throw redirect(302, "/login");
			}
			throw e; // Re-throw other errors (including redirects)
		}
	}

	event.locals.user = user;
	event.locals.token = access_token;

	// Last check to make sure we have a user
	if (!event.locals.user.id) {
		logger.error("No user found");
		throw redirect(302, "/login");
	}
	logger.debug("User: %O", event.locals.user);

	// ==========================================================================
	// MULTI-TENANCY: Verify agency membership on protected routes
	// ==========================================================================
	const isAppRoute =
		event.url.pathname.startsWith("/consultation") ||
		event.url.pathname.startsWith("/notes") ||
		event.url.pathname.startsWith("/payments") ||
		event.url.pathname.startsWith("/files") ||
		event.url.pathname.startsWith("/emails") ||
		event.url.pathname === "/";

	if (isAppRoute) {
		const currentAgencyId = event.cookies.get(CURRENT_AGENCY_COOKIE);

		if (currentAgencyId) {
			// Verify membership is still active
			try {
				const [membership] = await db
					.select({
						membershipId: agencyMemberships.id,
						role: agencyMemberships.role,
						status: agencyMemberships.status,
						agencyStatus: agencies.status,
						agencyDeleted: agencies.deletedAt,
					})
					.from(agencyMemberships)
					.innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
					.where(
						and(
							eq(agencyMemberships.userId, event.locals.user.id),
							eq(agencyMemberships.agencyId, currentAgencyId),
						),
					)
					.limit(1);

				// Check if membership is valid
				const membershipValid =
					membership &&
					membership.status === "active" &&
					membership.agencyStatus === "active" &&
					!membership.agencyDeleted;

				if (!membershipValid) {
					// Membership revoked or agency deleted - clear cookie
					logger.warn(`Agency access revoked for user ${event.locals.user.id}`);
					event.cookies.delete(CURRENT_AGENCY_COOKIE, { path: "/" });

					// If this is an API request, let it continue (will get 403 from context)
					// If it's a page request, could redirect to agency selection
					// For now, just clear the cookie and let the request continue
					// The layout will handle showing an error or redirecting
				}
			} catch (err) {
				// Database error - log but don't block the request
				logger.error("Error verifying agency membership:", err);
			}
		}
	}

	end();
	return await resolve(event, {
		preload: ({ type }) => type === "js" || type === "css" || type === "font",
	});
};

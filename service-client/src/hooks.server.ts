import { logger, perf } from "./lib/server/logger";
import { redirect, type Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
import { verifyJWT } from "./lib/server/jwt";
import { refresh } from "./lib/server/refresh";
import type { Session, User } from "./lib/types";
import { env } from "$env/dynamic/private";

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
	if (!refresh_token) {
		logger.debug("No token found");
		throw redirect(302, "/login");
	}
	if (event.url.pathname === "/payments") {
		access_token = "";
	}

	let user = await verifyJWT<User>(access_token);
	// If the token is invalid, refresh the token
	// JWT token holds the information about subscription status, so we need to refresh it
	if (!user) {
		access_token = await refresh(event, access_token, refresh_token);
		user = await verifyJWT(access_token);
		if (!user) {
			logger.error("Error refreshing token");
			throw redirect(302, "/login");
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

	end();
	return await resolve(event, {
		preload: ({ type }) => type === "js" || type === "css" || type === "font",
	});
};

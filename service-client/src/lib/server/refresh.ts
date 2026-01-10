import { env } from "$env/dynamic/private";
import { type RequestEvent } from "@sveltejs/kit";
import { logger, perf } from "./logger";

export type AuthResponse = {
	access_token: string;
	refresh_token: string;
};

/**
 * Custom error for token refresh failures.
 * This is thrown instead of redirect() to allow proper handling in different contexts:
 * - Page requests: hooks.server.ts converts this to a redirect
 * - Remote function commands: error propagates and client handles it
 */
export class TokenRefreshError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TokenRefreshError";
	}
}

export async function refresh(
	event: RequestEvent,
	access_token: string,
	refresh_token: string,
): Promise<string> {
	const end = perf("refresh");
	try {
		const r = await fetch(`${env.CORE_URL}/refresh`, {
			headers: { Cookie: `refresh_token=${refresh_token}; access_token=${access_token}` },
		});
		if (!r.ok) {
			throw new Error(`Error refreshing token: ${r.status}`);
		}
		const new_cookies = r.headers.get("set-cookie");
		if (!new_cookies) {
			throw new Error("No cookies found");
		}
		refresh_token = new_cookies.match(/refresh_token=([^;]+)/)?.[1] ?? "";
		access_token = new_cookies.match(/access_token=([^;]+)/)?.[1] ?? "";

		// Token expiration constants (must match Go backend config/config.go)
		const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes in seconds
		const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

		event.cookies.set("access_token", access_token, {
			path: "/",
			sameSite: "lax",
			secure: true,
			httpOnly: true,
			domain: env.DOMAIN,
			maxAge: ACCESS_TOKEN_MAX_AGE,
		});
		event.cookies.set("refresh_token", refresh_token, {
			path: "/",
			sameSite: "lax",
			secure: true,
			httpOnly: true,
			domain: env.DOMAIN,
			maxAge: REFRESH_TOKEN_MAX_AGE,
		});
		end();
		return access_token;
	} catch (e) {
		logger.error(`Error refreshing token: ${e}`);
		throw new TokenRefreshError("Session expired. Please log in again.");
	}
}

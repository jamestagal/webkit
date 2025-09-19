import { env } from "$env/dynamic/private";
import { redirect, type RequestEvent } from "@sveltejs/kit";
import { logger, perf } from "./logger";

export type AuthResponse = {
	access_token: string;
	refresh_token: string;
};

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

		event.cookies.set("access_token", access_token, {
			path: "/",
			sameSite: "lax",
			secure: true,
			httpOnly: true,
			domain: env.DOMAIN,
		});
		event.cookies.set("refresh_token", refresh_token, {
			path: "/",
			sameSite: "lax",
			secure: true,
			httpOnly: true,
			domain: env.DOMAIN,
		});
		end();
		return access_token;
	} catch (e) {
		logger.error(`Error refreshing token: ${e}`);
		throw redirect(302, "/login");
	}
}

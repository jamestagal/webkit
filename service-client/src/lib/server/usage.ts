/**
 * Server-side helpers for the usage tracking API (service-core).
 *
 * - `checkUsage` / `getUsageSummary` — non-incrementing reads for UX hints and
 *   the /settings/billing dashboard.
 * - `consumePDFExport` — atomic increment used by the five Gotenberg-calling
 *   +server.ts routes. This is the deliberate exception to "SvelteKit only
 *   does Check" (spec §11) — those routes are the point of work, so gating
 *   lives there. Everywhere else in SvelteKit should call `checkUsage`.
 *
 * Re-exports `TIER_LIMITS`, `FEATURE_GATES`, and the `Tier`/`UsageFeature`
 * types from the generated file so consumers don't have to know where the
 * constants live.
 */
import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import { getRequestEvent } from "$app/server";

import {
	TIER_LIMITS,
	FEATURE_GATES,
	type Tier,
	type UsageFeature,
} from "$lib/generated/tier-limits";

export { TIER_LIMITS, FEATURE_GATES };
export type { Tier, UsageFeature };

/** Matches the Go `usage.Status` struct exactly (json encoded). */
export interface UsageStatus {
	Feature: string;
	Current: number;
	Limit: number;
	Period: string;
	Remaining: number;
	AtWarning: boolean;
	AtLimit: boolean;
}

interface SafeResponse<T> {
	success: boolean;
	data: T;
	message: string;
}

/** Threshold helpers — same semantics as the Go service's flag computation. */
export function isAtWarning(current: number, limit: number): boolean {
	return limit > 0 && current / limit >= 0.8;
}

export function isAtLimit(current: number, limit: number): boolean {
	return limit > 0 && current >= limit;
}

export function getLimit(tier: Tier, feature: UsageFeature): number {
	return TIER_LIMITS[tier][feature];
}

/**
 * `enterprise` is a reserved sales-only tier with no TIER_LIMITS entry
 * (decision 10 — per-agency overrides are wired when the first deal is
 * signed). Until then, fall back to Agency Pro caps so an Enterprise
 * agency isn't incorrectly gated at a lower tier.
 */
export function resolveLimitsTier(tier: string): Tier {
	if (tier === "enterprise") return "agency_pro";
	if (tier === "free" || tier === "starter" || tier === "growth" || tier === "agency_pro") {
		return tier;
	}
	return "free";
}

/** Hard ceilings (rows, not monthly counters) exposed for guard call-sites. */
export function getMaxClients(tier: string): number {
	return TIER_LIMITS[resolveLimitsTier(tier)].max_clients;
}

export function getMaxMembers(tier: string): number {
	return TIER_LIMITS[resolveLimitsTier(tier)].max_members;
}

/**
 * callUsageAPI routes through service-core with the caller's bearer token.
 * Mirrors the shape of callBillingAPI in billing.remote.ts so error handling
 * behaves the same (4xx/5xx throw via @sveltejs/kit `error`).
 *
 * 429 responses surface the server's reset_date hint in the message so the
 * UI can render "resets on DD Month YYYY" without a second call.
 */
async function callUsageAPI<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const event = getRequestEvent();
	const accessToken = event.cookies.get("access_token");

	const res = await fetch(`${env.CORE_URL}/api/v1/usage${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			...options.headers,
		},
	});

	if (!res.ok) {
		const body = (await res.json().catch(() => ({ message: "Unknown error" }))) as {
			message?: string;
			reset_date?: string;
		};
		const msg = body.reset_date
			? `${body.message ?? "usage limit reached"} (resets ${body.reset_date})`
			: body.message ?? `usage API error: ${res.status}`;
		throw error(res.status, msg);
	}

	const parsed = (await res.json()) as SafeResponse<T>;
	return parsed.data;
}

/** Non-incrementing lookup for a single feature. */
export async function checkUsage(
	agencyId: string,
	feature: string,
): Promise<UsageStatus> {
	const qs = new URLSearchParams({ agencyId, feature });
	return callUsageAPI<UsageStatus>(`/check?${qs}`);
}

/** All metered features in one call — powers the billing dashboard. */
export async function getUsageSummary(
	agencyId: string,
): Promise<UsageStatus[]> {
	const qs = new URLSearchParams({ agencyId });
	return callUsageAPI<UsageStatus[]>(`/summary?${qs}`);
}

/**
 * Atomic check + increment for PDF exports. Call at the top of any
 * +server.ts route that invokes Gotenberg. Throws with HTTP 429 when
 * the cap is hit (caller can let SvelteKit surface it directly) — the
 * error message already includes the reset_date.
 */
export async function consumePDFExport(
	agencyId: string,
): Promise<UsageStatus> {
	return callUsageAPI<UsageStatus>("/consume", {
		method: "POST",
		body: JSON.stringify({ agencyId, feature: "pdf_export" }),
	});
}

/**
 * Atomic check + increment for AI generations made from the SvelteKit side
 * (e.g. proposal AI generation, which calls Anthropic directly rather than
 * going through the content-service Go handler).
 */
export async function consumeAIGeneration(
	agencyId: string,
): Promise<UsageStatus> {
	return callUsageAPI<UsageStatus>("/consume", {
		method: "POST",
		body: JSON.stringify({ agencyId, feature: "ai_generation" }),
	});
}

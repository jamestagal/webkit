import type { PageServerLoad } from "./$types";
import { getBillingInfo } from "$lib/api/billing.remote";
import { getAgencyUsageStats } from "$lib/server/subscription";
import { getAgencyContext } from "$lib/server/agency";
import { getUsageSummary } from "$lib/server/usage";

export const load: PageServerLoad = async ({ url }) => {
	// Pass sessionId to auto-sync from Stripe if DB is behind (idempotent pattern)
	const sessionId = url.searchParams.get("session_id") || undefined;

	const context = await getAgencyContext();

	const [billingInfo, usageStats, usageSummary] = await Promise.all([
		getBillingInfo({ sessionId }).catch(() => null),
		getAgencyUsageStats(),
		// Go /usage/summary is the new source of truth for monthly counters.
		// getAgencyUsageStats() stays on the legacy columns and is rendered
		// alongside during the transition; PR 3 removes it entirely.
		getUsageSummary(context.agencyId).catch(() => []),
	]);

	return {
		billingInfo,
		usageStats,
		usageSummary,
		// Pass sessionId so frontend knows checkout just completed
		checkoutSessionId: sessionId,
	};
};

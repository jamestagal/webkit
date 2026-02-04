import type { PageServerLoad } from "./$types";
import { getBillingInfo } from "$lib/api/billing.remote";
import { getAgencyUsageStats } from "$lib/server/subscription";

export const load: PageServerLoad = async ({ url }) => {
	// Pass sessionId to auto-sync from Stripe if DB is behind (idempotent pattern)
	const sessionId = url.searchParams.get("session_id") || undefined;

	const [billingInfo, usageStats] = await Promise.all([
		getBillingInfo({ sessionId }).catch(() => null),
		getAgencyUsageStats(),
	]);

	return {
		billingInfo,
		usageStats,
		// Pass sessionId so frontend knows checkout just completed
		checkoutSessionId: sessionId,
	};
};

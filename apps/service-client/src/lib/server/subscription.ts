/**
 * Subscription Tier Enforcement
 *
 * Defines subscription tiers and their limits.
 * Provides functions to check and enforce limits.
 *
 * IMPORTANT: Limits should be enforced in the service layer,
 * not just in the UI, to prevent bypass.
 */

import { db } from "$lib/server/db";
import { agencies, agencyMemberships } from "$lib/server/schema";
import { eq, and, count } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getAgencyContext } from "$lib/server/agency";
import { checkUsage, consumeAIGeneration, getMaxMembers } from "$lib/server/usage";
import { formatDate } from "$lib/utils/formatting";

// First-of-next-month in local time — kept here so the two refactored
// wrappers below return the same `resetsAt` shape as their legacy callers expect.
function startOfNextMonth(): Date {
	const d = new Date();
	d.setMonth(d.getMonth() + 1);
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d;
}

// =============================================================================
// Tier Definitions
// =============================================================================

// Self-serve tiers live in TIER_DEFINITIONS. "enterprise" is a reserved slot
// for future sales-negotiated contracts — no TIER_DEFINITIONS entry until the
// first Enterprise deal defines its caps.
export type SelfServeTier = "free" | "starter" | "growth" | "agency_pro";
export type SubscriptionTier = SelfServeTier | "enterprise";

export interface TierLimits {
	// All numeric caps are authoritative in @webkit/billing-tokens (Go is
	// SSoT). The fields below are legacy and retained only for the `features`
	// array used by hasFeature/tierHasFeature; PR 4+ will migrate those too.
	maxMembers: number; // kept for legacy getAgencyTierLimits consumers
	maxAIGenerationsPerMonth: number;
	maxSeoAuditsPerMonth: number;
	maxStorageMB: number;
	features: TierFeature[];
}

export type TierFeature =
	| "basic_proposals"
	| "pdf_export"
	| "email_delivery"
	| "custom_branding"
	| "analytics"
	| "white_label"
	| "api_access"
	| "priority_support"
	| "custom_domain"
	| "sso"
	| "ai_proposal_generation"
	| "seo_audits"
	| "backlink_analysis";

export const TIER_DEFINITIONS: Record<SelfServeTier, TierLimits> = {
	free: {
		maxMembers: 1,
		maxAIGenerationsPerMonth: 5,
		maxSeoAuditsPerMonth: 2,
		maxStorageMB: 500,
		features: ["basic_proposals", "ai_proposal_generation"],
	},
	starter: {
		maxMembers: 3,
		maxAIGenerationsPerMonth: 25,
		maxSeoAuditsPerMonth: 10,
		maxStorageMB: 5 * 1024, // 5GB
		features: ["basic_proposals", "pdf_export", "email_delivery", "ai_proposal_generation", "seo_audits"],
	},
	growth: {
		maxMembers: 10,
		maxAIGenerationsPerMonth: 100,
		maxSeoAuditsPerMonth: 50,
		maxStorageMB: 20 * 1024, // 20GB
		features: [
			"basic_proposals",
			"pdf_export",
			"email_delivery",
			"custom_branding",
			"analytics",
			"white_label",
			"api_access",
			"ai_proposal_generation",
			"seo_audits",
			"backlink_analysis",
		],
	},
	agency_pro: {
		maxMembers: 25,
		maxAIGenerationsPerMonth: 500,
		maxSeoAuditsPerMonth: 200,
		maxStorageMB: 50 * 1024, // 50GB
		features: [
			"basic_proposals",
			"pdf_export",
			"email_delivery",
			"custom_branding",
			"analytics",
			"white_label",
			"api_access",
			"priority_support",
			"custom_domain",
			"sso",
			"ai_proposal_generation",
			"seo_audits",
			"backlink_analysis",
		],
	},
};

// =============================================================================
// Freemium Support
// =============================================================================

/**
 * Get the effective tier for an agency, considering freemium status.
 * Freemium users get Agency Pro-level access regardless of actual subscription.
 */
export async function getEffectiveTier(agencyId: string): Promise<SubscriptionTier> {
	const [agency] = await db
		.select({
			subscriptionTier: agencies.subscriptionTier,
			isFreemium: agencies.isFreemium,
			freemiumExpiresAt: agencies.freemiumExpiresAt,
		})
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	if (!agency) return "free";

	// Check freemium status
	if (agency.isFreemium) {
		// Check if expired (null = no expiry)
		if (agency.freemiumExpiresAt && new Date() > agency.freemiumExpiresAt) {
			// Freemium expired, fall back to actual tier
			return (agency.subscriptionTier as SubscriptionTier) || "free";
		}
		// Active freemium - grant Agency Pro access
		return "agency_pro";
	}

	return (agency.subscriptionTier as SubscriptionTier) || "free";
}

// =============================================================================
// Tier Information Functions
// =============================================================================

/**
 * Get the tier limits for a specific tier.
 */
export function getTierLimits(tier: SubscriptionTier): TierLimits {
	// "enterprise" is a reserved sales-only slot with no TIER_DEFINITIONS entry.
	// Until per-agency overrides are wired for Enterprise deals, treat it as the
	// Agency Pro ceiling so no agency is under-served if the tier ever gets set.
	if (tier === "enterprise") return TIER_DEFINITIONS.agency_pro;
	return TIER_DEFINITIONS[tier] || TIER_DEFINITIONS.free;
}

/**
 * Get the current agency's tier and limits.
 * Respects freemium status - freemium users get Agency Pro limits.
 */
export async function getAgencyTierLimits(): Promise<{
	tier: SubscriptionTier;
	limits: TierLimits;
}> {
	const context = await getAgencyContext();

	// Use getEffectiveTier to respect freemium status
	const tier = await getEffectiveTier(context.agencyId);
	return { tier, limits: getTierLimits(tier) };
}

/**
 * Check if a feature is available for a tier.
 */
export function tierHasFeature(tier: SubscriptionTier, feature: TierFeature): boolean {
	const limits = getTierLimits(tier);
	return limits.features.includes(feature);
}

// =============================================================================
// Limit Checking Functions
// =============================================================================

/**
 * Get current member count for an agency.
 */
export async function getMemberCount(agencyId: string): Promise<number> {
	const [result] = await db
		.select({ count: count() })
		.from(agencyMemberships)
		.where(and(eq(agencyMemberships.agencyId, agencyId), eq(agencyMemberships.status, "active")));

	return result?.count ?? 0;
}

/**
 * Check if agency can add more members.
 *
 * Reads the cap from the @webkit/billing-tokens package so Go
 * remains the single source of truth. Enterprise maps to Agency Pro's cap
 * until the first sales deal defines per-agency overrides — `unlimited`
 * is therefore always false in the current model, but the field is kept
 * in the return shape for backwards compatibility with existing callers.
 */
export async function canAddMember(agencyId?: string): Promise<{
	allowed: boolean;
	current: number;
	limit: number;
	unlimited: boolean;
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	const tier = await getEffectiveTier(targetAgencyId);
	const limit = getMaxMembers(tier);
	const currentCount = await getMemberCount(targetAgencyId);

	return {
		allowed: currentCount < limit,
		current: currentCount,
		limit,
		unlimited: false,
	};
}

/**
 * Check if agency can generate more AI content this month.
 *
 * Thin wrapper over the Go /api/v1/usage/check endpoint — the agency_usage
 * table in service-core is the source of truth. The legacy column
 * agencies.ai_generations_this_month is deprecated (PR 3 removes it).
 */
export async function canGenerateWithAI(agencyId?: string): Promise<{
	allowed: boolean;
	current: number;
	limit: number;
	unlimited: boolean;
	resetsAt: Date;
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	const status = await checkUsage(targetAgencyId, "ai_generation");
	return {
		allowed: !status.AtLimit,
		current: status.Current,
		limit: status.Limit,
		unlimited: false,
		resetsAt: startOfNextMonth(),
	};
}

/**
 * Increment AI generation counter for an agency after a successful generation
 * initiated from the SvelteKit side (e.g. proposal AI generation, which calls
 * Anthropic directly). Delegates to the Go /api/v1/usage/consume endpoint so
 * agency_usage is the single source of truth.
 *
 * Content-intelligence AI generation is already counted in-process by the Go
 * handleGenerateCopy handler — do not call this from paths that go through
 * content-service, or it will double-count.
 */
export async function incrementAIGenerationCount(agencyId: string): Promise<void> {
	await consumeAIGeneration(agencyId);
}

// =============================================================================
// SEO Audit Quota Functions
// =============================================================================

/**
 * Check if agency can run an SEO audit.
 * Thin wrapper over Go /api/v1/usage/check (agency_usage is SSoT).
 */
export async function canRunSeoAudit(
	agencyId?: string,
	_clientId?: string,
): Promise<{
	allowed: boolean;
	current: number;
	limit: number;
	unlimited: boolean;
	resetsAt: Date;
	isReaudit: boolean;
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	// Thin wrapper over Go /api/v1/usage/check. Decision 9 dropped re-audit
	// logic — every audit counts equally against the monthly cap — so the
	// clientId parameter is ignored. `isReaudit` is kept in the return shape
	// for back-compat with existing callers; always false.
	const status = await checkUsage(targetAgencyId, "seo_audit");
	return {
		allowed: !status.AtLimit && status.Limit > 0,
		current: status.Current,
		limit: status.Limit,
		unlimited: false,
		resetsAt: startOfNextMonth(),
		isReaudit: false,
	};
}

/**
 * Enforce SEO audit limit - throws if limit exceeded.
 */
export async function enforceSeoAuditLimit(
	agencyId?: string,
	clientId?: string,
): Promise<void> {
	const result = await canRunSeoAudit(agencyId, clientId);

	if (!result.allowed) {
		throw error(
			403,
			`Monthly SEO audit limit reached (${result.current}/${result.limit}). ` +
				`Limit resets on ${formatDate(result.resetsAt)}. ` +
				`Upgrade your plan for more audits.`,
		);
	}
}

// =============================================================================
// Limit Enforcement Functions (Throws on Violation)
// =============================================================================

/**
 * Enforce member limit - throws if limit exceeded.
 */
export async function enforceMemberLimit(agencyId?: string): Promise<void> {
	const result = await canAddMember(agencyId);

	if (!result.allowed) {
		throw error(
			403,
			`Member limit reached (${result.current}/${result.limit}). Upgrade your plan to add more members.`,
		);
	}
}

/**
 * Enforce AI generation limit - throws if limit exceeded.
 */
export async function enforceAIGenerationLimit(agencyId?: string): Promise<void> {
	const result = await canGenerateWithAI(agencyId);

	if (!result.allowed) {
		throw error(
			403,
			`Monthly AI generation limit reached (${result.current}/${result.limit}). ` +
				`Limit resets on ${formatDate(result.resetsAt)}. ` +
				`Upgrade your plan for more AI generations.`,
		);
	}
}

/**
 * Require a specific feature - throws if not available.
 */
export async function requireFeature(feature: TierFeature): Promise<void> {
	const { tier, limits } = await getAgencyTierLimits();

	if (!limits.features.includes(feature)) {
		throw error(
			403,
			`The "${feature}" feature is not available on the ${tier} plan. Please upgrade to access this feature.`,
		);
	}
}

/**
 * Check if current agency has a feature.
 * Returns false instead of throwing.
 */
export async function hasFeature(feature: TierFeature): Promise<boolean> {
	const { limits } = await getAgencyTierLimits();
	return limits.features.includes(feature);
}

// =============================================================================
// Usage Statistics
// =============================================================================

/**
 * Get comprehensive usage statistics for an agency.
 */
export async function getAgencyUsageStats(agencyId?: string): Promise<{
	tier: SubscriptionTier;
	limits: TierLimits;
	usage: {
		members: { current: number; limit: number; percentage: number };
	};
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	// Monthly counters (AI generations, SEO audits, PDF exports, etc.) now come
	// from Go /api/v1/usage/summary. Consumers that want those should call
	// getUsageSummary directly. This function is retained for the members
	// row-count only, since that lives in agency_memberships, not agency_usage.
	const { tier, limits } = await getAgencyTierLimits();
	const memberCount = await getMemberCount(targetAgencyId);
	const memberPercentage =
		limits.maxMembers > 0 ? Math.round((memberCount / limits.maxMembers) * 100) : 0;

	return {
		tier,
		limits,
		usage: {
			members: {
				current: memberCount,
				limit: limits.maxMembers,
				percentage: memberPercentage,
			},
		},
	};
}

// =============================================================================
// Tier Comparison (for upgrade prompts)
// =============================================================================

/**
 * Get comparison between current tier and available upgrades.
 */
export function getTierComparison(currentTier: SubscriptionTier): Array<{
	tier: SubscriptionTier;
	name: string;
	limits: TierLimits;
	isCurrentTier: boolean;
	isUpgrade: boolean;
}> {
	// Only self-serve tiers surface in comparisons (enterprise is sales-only).
	const tierOrder: SelfServeTier[] = ["free", "starter", "growth", "agency_pro"];
	const currentIndex = tierOrder.indexOf(currentTier as SelfServeTier);

	return tierOrder.map((tier, index) => ({
		tier,
		name: tier.charAt(0).toUpperCase() + tier.slice(1),
		limits: TIER_DEFINITIONS[tier],
		isCurrentTier: tier === currentTier,
		isUpgrade: index > currentIndex,
	}));
}

/**
 * Get the next tier up from current tier.
 */
export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
	const tierOrder: SubscriptionTier[] = ["free", "starter", "growth", "agency_pro"];
	const currentIndex = tierOrder.indexOf(currentTier);

	if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
		return null;
	}

	return tierOrder[currentIndex + 1] ?? null;
}

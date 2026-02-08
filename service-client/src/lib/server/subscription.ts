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
import { agencies, agencyMemberships, consultations } from "$lib/server/schema";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getAgencyContext } from "$lib/server/agency";

// =============================================================================
// Tier Definitions
// =============================================================================

export type SubscriptionTier = "free" | "starter" | "growth" | "enterprise";

export interface TierLimits {
	maxMembers: number; // -1 = unlimited
	maxConsultationsPerMonth: number; // -1 = unlimited
	maxAIGenerationsPerMonth: number; // -1 = unlimited
	maxTemplates: number; // -1 = unlimited
	maxStorageMB: number; // -1 = unlimited
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
	| "ai_proposal_generation";

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierLimits> = {
	free: {
		maxMembers: 1,
		maxConsultationsPerMonth: 10,
		maxAIGenerationsPerMonth: 5,
		maxTemplates: 3,
		maxStorageMB: 100,
		features: ["basic_proposals", "ai_proposal_generation"],
	},
	starter: {
		maxMembers: 3,
		maxConsultationsPerMonth: 25,
		maxAIGenerationsPerMonth: 25,
		maxTemplates: 5,
		maxStorageMB: 1024, // 1GB
		features: ["basic_proposals", "pdf_export", "email_delivery", "ai_proposal_generation"],
	},
	growth: {
		maxMembers: 10,
		maxConsultationsPerMonth: 100,
		maxAIGenerationsPerMonth: 100,
		maxTemplates: 20,
		maxStorageMB: 10240, // 10GB
		features: [
			"basic_proposals",
			"pdf_export",
			"email_delivery",
			"custom_branding",
			"analytics",
			"white_label",
			"api_access",
			"ai_proposal_generation",
		],
	},
	enterprise: {
		maxMembers: -1,
		maxConsultationsPerMonth: -1,
		maxAIGenerationsPerMonth: -1,
		maxTemplates: -1,
		maxStorageMB: -1,
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
		],
	},
};

// =============================================================================
// Freemium Support
// =============================================================================

/**
 * Get the effective tier for an agency, considering freemium status.
 * Freemium users get enterprise-level access regardless of actual subscription.
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
		// Active freemium - grant enterprise access
		return "enterprise";
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
	return TIER_DEFINITIONS[tier] || TIER_DEFINITIONS.free;
}

/**
 * Get the current agency's tier and limits.
 * Respects freemium status - freemium users get enterprise limits.
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
 * Get consultation count for current month.
 */
export async function getMonthlyConsultationCount(agencyId: string): Promise<number> {
	const startOfMonth = new Date();
	startOfMonth.setDate(1);
	startOfMonth.setHours(0, 0, 0, 0);

	const [result] = await db
		.select({ count: count() })
		.from(consultations)
		.where(and(eq(consultations.agencyId, agencyId), gte(consultations.createdAt, startOfMonth)));

	return result?.count ?? 0;
}

/**
 * Check if agency can add more members.
 */
export async function canAddMember(agencyId?: string): Promise<{
	allowed: boolean;
	current: number;
	limit: number;
	unlimited: boolean;
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	const { limits } = await getAgencyTierLimits();
	const currentCount = await getMemberCount(targetAgencyId);

	if (limits.maxMembers === -1) {
		return { allowed: true, current: currentCount, limit: -1, unlimited: true };
	}

	return {
		allowed: currentCount < limits.maxMembers,
		current: currentCount,
		limit: limits.maxMembers,
		unlimited: false,
	};
}

/**
 * Check if agency can create more consultations this month.
 */
export async function canCreateConsultation(agencyId?: string): Promise<{
	allowed: boolean;
	current: number;
	limit: number;
	unlimited: boolean;
	resetsAt: Date;
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	const { limits } = await getAgencyTierLimits();
	const currentCount = await getMonthlyConsultationCount(targetAgencyId);

	// Calculate when limit resets (start of next month)
	const resetsAt = new Date();
	resetsAt.setMonth(resetsAt.getMonth() + 1);
	resetsAt.setDate(1);
	resetsAt.setHours(0, 0, 0, 0);

	if (limits.maxConsultationsPerMonth === -1) {
		return { allowed: true, current: currentCount, limit: -1, unlimited: true, resetsAt };
	}

	return {
		allowed: currentCount < limits.maxConsultationsPerMonth,
		current: currentCount,
		limit: limits.maxConsultationsPerMonth,
		unlimited: false,
		resetsAt,
	};
}

/**
 * Get AI generation count for current month.
 * Uses the aiGenerationsThisMonth counter on the agencies table.
 */
export async function getMonthlyAIGenerationCount(agencyId: string): Promise<number> {
	const [agency] = await db
		.select({
			aiGenerationsThisMonth: agencies.aiGenerationsThisMonth,
			aiGenerationsResetAt: agencies.aiGenerationsResetAt,
		})
		.from(agencies)
		.where(eq(agencies.id, agencyId))
		.limit(1);

	if (!agency) return 0;

	// Check if counter needs to be reset (new month)
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	if (!agency.aiGenerationsResetAt || agency.aiGenerationsResetAt < startOfMonth) {
		// Reset counter for new month
		await db
			.update(agencies)
			.set({
				aiGenerationsThisMonth: 0,
				aiGenerationsResetAt: now,
			})
			.where(eq(agencies.id, agencyId));
		return 0;
	}

	return agency.aiGenerationsThisMonth ?? 0;
}

/**
 * Check if agency can generate more AI proposals this month.
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

	const { limits } = await getAgencyTierLimits();
	const currentCount = await getMonthlyAIGenerationCount(targetAgencyId);

	// Calculate when limit resets (start of next month)
	const resetsAt = new Date();
	resetsAt.setMonth(resetsAt.getMonth() + 1);
	resetsAt.setDate(1);
	resetsAt.setHours(0, 0, 0, 0);

	if (limits.maxAIGenerationsPerMonth === -1) {
		return { allowed: true, current: currentCount, limit: -1, unlimited: true, resetsAt };
	}

	return {
		allowed: currentCount < limits.maxAIGenerationsPerMonth,
		current: currentCount,
		limit: limits.maxAIGenerationsPerMonth,
		unlimited: false,
		resetsAt,
	};
}

/**
 * Increment AI generation counter for an agency.
 * Call this after a successful AI generation.
 * Uses atomic SQL to prevent race conditions with concurrent requests.
 */
export async function incrementAIGenerationCount(agencyId: string): Promise<void> {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	await db.execute(sql`
		UPDATE agencies
		SET ai_generations_this_month = CASE
			WHEN ai_generations_reset_at IS NULL OR ai_generations_reset_at < ${startOfMonth}
			THEN 1
			ELSE ai_generations_this_month + 1
		END,
		ai_generations_reset_at = CASE
			WHEN ai_generations_reset_at IS NULL OR ai_generations_reset_at < ${startOfMonth}
			THEN ${now}
			ELSE ai_generations_reset_at
		END
		WHERE id = ${agencyId}
	`);
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
 * Enforce consultation limit - throws if limit exceeded.
 */
export async function enforceConsultationLimit(agencyId?: string): Promise<void> {
	const result = await canCreateConsultation(agencyId);

	if (!result.allowed) {
		throw error(
			403,
			`Monthly consultation limit reached (${result.current}/${result.limit}). ` +
				`Limit resets on ${result.resetsAt.toLocaleDateString()}. ` +
				`Upgrade your plan for more consultations.`,
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
				`Limit resets on ${result.resetsAt.toLocaleDateString()}. ` +
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
		consultationsThisMonth: { current: number; limit: number; percentage: number };
		aiGenerationsThisMonth: { current: number; limit: number; percentage: number };
	};
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	const { tier, limits } = await getAgencyTierLimits();
	const memberCount = await getMemberCount(targetAgencyId);
	const consultationCount = await getMonthlyConsultationCount(targetAgencyId);
	const aiGenerationCount = await getMonthlyAIGenerationCount(targetAgencyId);

	const memberPercentage =
		limits.maxMembers === -1 ? 0 : Math.round((memberCount / limits.maxMembers) * 100);

	const consultationPercentage =
		limits.maxConsultationsPerMonth === -1
			? 0
			: Math.round((consultationCount / limits.maxConsultationsPerMonth) * 100);

	const aiGenerationPercentage =
		limits.maxAIGenerationsPerMonth === -1
			? 0
			: Math.round((aiGenerationCount / limits.maxAIGenerationsPerMonth) * 100);

	return {
		tier,
		limits,
		usage: {
			members: {
				current: memberCount,
				limit: limits.maxMembers,
				percentage: memberPercentage,
			},
			consultationsThisMonth: {
				current: consultationCount,
				limit: limits.maxConsultationsPerMonth,
				percentage: consultationPercentage,
			},
			aiGenerationsThisMonth: {
				current: aiGenerationCount,
				limit: limits.maxAIGenerationsPerMonth,
				percentage: aiGenerationPercentage,
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
	const tierOrder: SubscriptionTier[] = ["free", "starter", "growth", "enterprise"];
	const currentIndex = tierOrder.indexOf(currentTier);

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
	const tierOrder: SubscriptionTier[] = ["free", "starter", "growth", "enterprise"];
	const currentIndex = tierOrder.indexOf(currentTier);

	if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
		return null;
	}

	return tierOrder[currentIndex + 1] ?? null;
}

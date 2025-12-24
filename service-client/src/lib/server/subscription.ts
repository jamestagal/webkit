/**
 * Subscription Tier Enforcement
 *
 * Defines subscription tiers and their limits.
 * Provides functions to check and enforce limits.
 *
 * IMPORTANT: Limits should be enforced in the service layer,
 * not just in the UI, to prevent bypass.
 */

import { db } from '$lib/server/db';
import { agencies, agencyMemberships, consultations } from '$lib/server/schema';
import { eq, and, gte, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getAgencyContext } from '$lib/server/agency';

// =============================================================================
// Tier Definitions
// =============================================================================

export type SubscriptionTier = 'free' | 'starter' | 'growth' | 'enterprise';

export interface TierLimits {
	maxMembers: number; // -1 = unlimited
	maxConsultationsPerMonth: number; // -1 = unlimited
	maxTemplates: number; // -1 = unlimited
	maxStorageMB: number; // -1 = unlimited
	features: TierFeature[];
}

export type TierFeature =
	| 'basic_proposals'
	| 'pdf_export'
	| 'email_delivery'
	| 'custom_branding'
	| 'analytics'
	| 'white_label'
	| 'api_access'
	| 'priority_support'
	| 'custom_domain'
	| 'sso';

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierLimits> = {
	free: {
		maxMembers: 1,
		maxConsultationsPerMonth: 5,
		maxTemplates: 1,
		maxStorageMB: 100,
		features: ['basic_proposals']
	},
	starter: {
		maxMembers: 3,
		maxConsultationsPerMonth: 25,
		maxTemplates: 5,
		maxStorageMB: 1024, // 1GB
		features: ['basic_proposals', 'pdf_export', 'email_delivery']
	},
	growth: {
		maxMembers: 10,
		maxConsultationsPerMonth: 100,
		maxTemplates: 20,
		maxStorageMB: 10240, // 10GB
		features: [
			'basic_proposals',
			'pdf_export',
			'email_delivery',
			'custom_branding',
			'analytics',
			'white_label',
			'api_access'
		]
	},
	enterprise: {
		maxMembers: -1,
		maxConsultationsPerMonth: -1,
		maxTemplates: -1,
		maxStorageMB: -1,
		features: [
			'basic_proposals',
			'pdf_export',
			'email_delivery',
			'custom_branding',
			'analytics',
			'white_label',
			'api_access',
			'priority_support',
			'custom_domain',
			'sso'
		]
	}
};

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
 */
export async function getAgencyTierLimits(): Promise<{
	tier: SubscriptionTier;
	limits: TierLimits;
}> {
	const context = await getAgencyContext();

	const [agency] = await db
		.select({ subscriptionTier: agencies.subscriptionTier })
		.from(agencies)
		.where(eq(agencies.id, context.agencyId))
		.limit(1);

	const tier = (agency?.subscriptionTier as SubscriptionTier) || 'free';
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
		.where(and(eq(agencyMemberships.agencyId, agencyId), eq(agencyMemberships.status, 'active')));

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
		unlimited: false
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
		resetsAt
	};
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
			`Member limit reached (${result.current}/${result.limit}). Upgrade your plan to add more members.`
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
				`Upgrade your plan for more consultations.`
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
			`The "${feature}" feature is not available on the ${tier} plan. Please upgrade to access this feature.`
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
	};
}> {
	const context = await getAgencyContext();
	const targetAgencyId = agencyId || context.agencyId;

	const { tier, limits } = await getAgencyTierLimits();
	const memberCount = await getMemberCount(targetAgencyId);
	const consultationCount = await getMonthlyConsultationCount(targetAgencyId);

	const memberPercentage =
		limits.maxMembers === -1 ? 0 : Math.round((memberCount / limits.maxMembers) * 100);

	const consultationPercentage =
		limits.maxConsultationsPerMonth === -1
			? 0
			: Math.round((consultationCount / limits.maxConsultationsPerMonth) * 100);

	return {
		tier,
		limits,
		usage: {
			members: {
				current: memberCount,
				limit: limits.maxMembers,
				percentage: memberPercentage
			},
			consultationsThisMonth: {
				current: consultationCount,
				limit: limits.maxConsultationsPerMonth,
				percentage: consultationPercentage
			}
		}
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
	const tierOrder: SubscriptionTier[] = ['free', 'starter', 'growth', 'enterprise'];
	const currentIndex = tierOrder.indexOf(currentTier);

	return tierOrder.map((tier, index) => ({
		tier,
		name: tier.charAt(0).toUpperCase() + tier.slice(1),
		limits: TIER_DEFINITIONS[tier],
		isCurrentTier: tier === currentTier,
		isUpgrade: index > currentIndex
	}));
}

/**
 * Get the next tier up from current tier.
 */
export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
	const tierOrder: SubscriptionTier[] = ['free', 'starter', 'growth', 'enterprise'];
	const currentIndex = tierOrder.indexOf(currentTier);

	if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
		return null;
	}

	return tierOrder[currentIndex + 1] ?? null;
}

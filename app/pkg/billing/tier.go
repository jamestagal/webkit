// Package billing defines subscription tier constants and per-tier limits.
// Tier constants are the canonical source of truth for tier string values —
// all callers should use these constants instead of raw strings.
package billing

// SubscriptionTier identifies an agency's billing plan.
type SubscriptionTier string

const (
	TierFree      SubscriptionTier = "free"
	TierStarter   SubscriptionTier = "starter"
	TierGrowth    SubscriptionTier = "growth"
	TierAgencyPro SubscriptionTier = "agency_pro"

	// TierEnterprise is a reserved slot for sales-negotiated contracts.
	// No entry in TierLimits — per-agency overrides will be added when
	// the first Enterprise deal is signed.
	TierEnterprise SubscriptionTier = "enterprise"
)

// SelfServeTiers are tiers users can subscribe to via Stripe checkout.
var SelfServeTiers = []SubscriptionTier{TierFree, TierStarter, TierGrowth, TierAgencyPro}

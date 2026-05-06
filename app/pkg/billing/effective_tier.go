package billing

import (
	"database/sql"
	"time"
)

// EffectiveTier returns the tier whose caps should be applied for billing
// enforcement, accounting for freemium overrides.
//
// Mirrors the SvelteKit getEffectiveTier in
// apps/service-client/src/lib/server/subscription.ts (lines 129-154). Any
// change to freemium-grant semantics — what counts as "active freemium,"
// what tier freemium grants, expiry semantics — must be applied in BOTH
// places. The durable fix is generating both helpers from a shared spec
// (similar to @webkit/billing-tokens); until then, the two implementations
// must be kept in sync by hand.
//
// Semantics:
//   - Active freemium (is_freemium=true and expiry unset OR in future) → TierAgencyPro.
//   - Expired freemium → fall back to subscriptionTier.
//   - Non-freemium → subscriptionTier verbatim.
//   - Empty subscriptionTier → TierFree.
func EffectiveTier(
	subscriptionTier SubscriptionTier,
	isFreemium bool,
	freemiumExpiresAt sql.NullTime,
	now time.Time,
) SubscriptionTier {
	if isFreemium {
		if !freemiumExpiresAt.Valid || now.Before(freemiumExpiresAt.Time) {
			return TierAgencyPro
		}
	}
	if subscriptionTier == "" {
		return TierFree
	}
	return subscriptionTier
}

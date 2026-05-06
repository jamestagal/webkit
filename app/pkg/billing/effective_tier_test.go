package billing

import (
	"database/sql"
	"testing"
	"time"
)

// TestEffectiveTier mirrors the cases in apps/service-client/src/lib/server/
// subscription.ts:129-154 (getEffectiveTier). Any change to freemium-grant
// semantics — what counts as "active freemium," what tier freemium grants,
// expiry semantics — must be applied in BOTH places.
//
// Mirrored cases:
//   - active freemium, no expiry → agency_pro
//   - active freemium, future expiry → agency_pro
//   - expired freemium → fall back to subscriptionTier
//   - non-freemium → subscriptionTier verbatim
//   - empty tier → free (default)
//
// SvelteKit drift check: when modifying this file, grep getEffectiveTier
// in apps/service-client/src/lib/server/subscription.ts and confirm the
// case set still matches.
func TestEffectiveTier(t *testing.T) {
	now := time.Date(2026, 5, 6, 12, 0, 0, 0, time.UTC)
	future := sql.NullTime{Time: now.Add(24 * time.Hour), Valid: true}
	past := sql.NullTime{Time: now.Add(-time.Hour), Valid: true}
	pastSecond := sql.NullTime{Time: now.Add(-time.Second), Valid: true}
	noExpiry := sql.NullTime{Valid: false}

	cases := []struct {
		name              string
		subscriptionTier  SubscriptionTier
		isFreemium        bool
		freemiumExpiresAt sql.NullTime
		want              SubscriptionTier
	}{
		// non-freemium passthrough
		{"non-freemium free", TierFree, false, noExpiry, TierFree},
		{"non-freemium starter", TierStarter, false, noExpiry, TierStarter},
		{"non-freemium growth", TierGrowth, false, noExpiry, TierGrowth},
		{"non-freemium agency_pro", TierAgencyPro, false, noExpiry, TierAgencyPro},

		// active freemium
		{"active freemium, no expiry → agency_pro", TierFree, true, noExpiry, TierAgencyPro},
		{"active freemium, future expiry → agency_pro", TierFree, true, future, TierAgencyPro},
		{"freemium grants agency_pro even on agency_pro tier", TierAgencyPro, true, noExpiry, TierAgencyPro},

		// expired freemium → fall back
		{"expired freemium on free → free", TierFree, true, past, TierFree},
		{"expired freemium on starter → starter", TierStarter, true, pastSecond, TierStarter},

		// freemium=false with expiry set (junk data) → ignored
		{"freemium=false with future expiry set is ignored", TierFree, false, future, TierFree},

		// empty subscription tier
		{"empty tier non-freemium → free default", "", false, noExpiry, TierFree},
		{"empty tier active freemium → agency_pro", "", true, noExpiry, TierAgencyPro},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := EffectiveTier(tc.subscriptionTier, tc.isFreemium, tc.freemiumExpiresAt, now)
			if got != tc.want {
				t.Errorf("EffectiveTier(%q, %v, %+v, %v) = %q; want %q",
					tc.subscriptionTier, tc.isFreemium, tc.freemiumExpiresAt, now, got, tc.want)
			}
		})
	}
}

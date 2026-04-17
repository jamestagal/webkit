package billing

import "testing"

// paidTiersAscending is the expected ordering for monotonic invariants.
var paidTiersAscending = []SubscriptionTier{TierStarter, TierGrowth, TierAgencyPro}

// TestTierLimits_AllSelfServeTiersPresent ensures every self-serve tier has
// an entry in TierLimits. Catches accidental map deletions.
func TestTierLimits_AllSelfServeTiersPresent(t *testing.T) {
	for _, tier := range SelfServeTiers {
		if _, ok := TierLimits[tier]; !ok {
			t.Errorf("TierLimits missing entry for self-serve tier %q", tier)
		}
	}
}

// TestTierLimits_EnterpriseDeferred ensures Enterprise is NOT in the map.
// Per decision 10: per-agency overrides only, wired on first sales deal.
func TestTierLimits_EnterpriseDeferred(t *testing.T) {
	if _, ok := TierLimits[TierEnterprise]; ok {
		t.Errorf("TierLimits should NOT have an Enterprise entry — use per-agency overrides")
	}
}

// TestTierLimits_NoUnlimitedOnSelfServe ensures no self-serve tier uses the
// Unlimited sentinel. "Unlimited" cannot appear in self-serve marketing copy.
func TestTierLimits_NoUnlimitedOnSelfServe(t *testing.T) {
	for _, tier := range SelfServeTiers {
		l := TierLimits[tier]
		fields := map[string]int{
			"SEOAudits":      l.SEOAudits,
			"Crawls":         l.Crawls,
			"AIGenerations":  l.AIGenerations,
			"PDFExports":     l.PDFExports,
			"SocialProfiles": l.SocialProfiles,
			"Forms":          l.Forms,
			"MaxClients":     l.MaxClients,
			"MaxMembers":     l.MaxMembers,
		}
		for name, v := range fields {
			if v == Unlimited {
				t.Errorf("tier %q: %s is Unlimited (%d) — self-serve tiers must have finite caps",
					tier, name, Unlimited)
			}
		}
		if l.MaxStorageBytes == int64(Unlimited) {
			t.Errorf("tier %q: MaxStorageBytes is Unlimited — self-serve tiers must have finite caps", tier)
		}
	}
}

// TestTierLimits_PaidTiersMonotonic ensures Starter ≤ Growth ≤ AgencyPro for
// every cap. Prevents accidental regressions like "Growth has fewer audits
// than Starter".
func TestTierLimits_PaidTiersMonotonic(t *testing.T) {
	caps := []struct {
		name string
		get  func(Limits) int64
	}{
		{"SEOAudits", func(l Limits) int64 { return int64(l.SEOAudits) }},
		{"Crawls", func(l Limits) int64 { return int64(l.Crawls) }},
		{"AIGenerations", func(l Limits) int64 { return int64(l.AIGenerations) }},
		{"PDFExports", func(l Limits) int64 { return int64(l.PDFExports) }},
		{"SocialProfiles", func(l Limits) int64 { return int64(l.SocialProfiles) }},
		{"Forms", func(l Limits) int64 { return int64(l.Forms) }},
		{"MaxClients", func(l Limits) int64 { return int64(l.MaxClients) }},
		{"MaxMembers", func(l Limits) int64 { return int64(l.MaxMembers) }},
		{"MaxStorageBytes", func(l Limits) int64 { return l.MaxStorageBytes }},
	}

	for _, c := range caps {
		var prev int64
		var prevTier SubscriptionTier
		for i, tier := range paidTiersAscending {
			v := c.get(TierLimits[tier])
			if i > 0 && v < prev {
				t.Errorf("%s non-monotonic: %s=%d < %s=%d (paid tiers must strictly ascend)",
					c.name, tier, v, prevTier, prev)
			}
			prev = v
			prevTier = tier
		}
	}
}

// TestTierLimits_FreeIsLowest ensures Free never exceeds any paid tier on
// any cap. Safety net against accidental Free tier bumps.
func TestTierLimits_FreeIsLowest(t *testing.T) {
	free := TierLimits[TierFree]
	for _, tier := range paidTiersAscending {
		paid := TierLimits[tier]
		checks := []struct {
			name   string
			free   int64
			paid   int64
		}{
			{"SEOAudits", int64(free.SEOAudits), int64(paid.SEOAudits)},
			{"Crawls", int64(free.Crawls), int64(paid.Crawls)},
			{"AIGenerations", int64(free.AIGenerations), int64(paid.AIGenerations)},
			{"PDFExports", int64(free.PDFExports), int64(paid.PDFExports)},
			{"SocialProfiles", int64(free.SocialProfiles), int64(paid.SocialProfiles)},
			{"Forms", int64(free.Forms), int64(paid.Forms)},
			{"MaxClients", int64(free.MaxClients), int64(paid.MaxClients)},
			{"MaxMembers", int64(free.MaxMembers), int64(paid.MaxMembers)},
			{"MaxStorageBytes", free.MaxStorageBytes, paid.MaxStorageBytes},
		}
		for _, c := range checks {
			if c.free > c.paid {
				t.Errorf("%s: Free (%d) > %s (%d) — Free must never exceed paid tiers",
					c.name, c.free, tier, c.paid)
			}
		}
	}
}

// TestTierLimits_AllCapsNonNegative ensures no cap is accidentally negative
// (which would be mistaken for Unlimited or cause underflow).
func TestTierLimits_AllCapsNonNegative(t *testing.T) {
	for _, tier := range SelfServeTiers {
		l := TierLimits[tier]
		caps := map[string]int64{
			"SEOAudits":       int64(l.SEOAudits),
			"Crawls":          int64(l.Crawls),
			"AIGenerations":   int64(l.AIGenerations),
			"PDFExports":      int64(l.PDFExports),
			"SocialProfiles":  int64(l.SocialProfiles),
			"Forms":           int64(l.Forms),
			"MaxClients":      int64(l.MaxClients),
			"MaxMembers":      int64(l.MaxMembers),
			"MaxStorageBytes": l.MaxStorageBytes,
		}
		for name, v := range caps {
			if v < 0 {
				t.Errorf("tier %q: %s is negative (%d) — use Unlimited constant only where intended",
					tier, name, v)
			}
		}
	}
}

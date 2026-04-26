//go:generate go run ../../cmd/gentiers -out ../../../apps/service-client/src/lib/generated/tier-limits.ts

package billing

// Unlimited is the sentinel for future Enterprise per-agency overrides.
// No self-serve tier uses this value — invariant enforced by limits_test.go.
const Unlimited = -1

// Limits defines caps for a subscription tier.
// Monthly-rolling caps (SEOAudits/Crawls/AIGenerations/PDFExports) and one-shot
// caps (SocialProfiles/Forms) are enforced via app/pkg/usage. Hard ceilings
// (MaxClients/MaxMembers) are enforced at creation/invite time in the TS layer.
// Storage is cumulative bytes, enforced on upload.
type Limits struct {
	SEOAudits       int
	Crawls          int
	AIGenerations   int
	PDFExports      int
	SocialProfiles  int
	Forms           int
	MaxClients      int
	MaxMembers      int
	MaxStorageBytes int64
}

const (
	gb = int64(1024 * 1024 * 1024)
	mb = int64(1024 * 1024)
)

// TierLimits is the canonical source of truth for all tier caps.
// Generated into TypeScript by cmd/gentiers — see //go:generate directive above.
// Enterprise is intentionally absent (decision 10); sales-negotiated contracts
// get per-agency overrides when the first deal is signed.
var TierLimits = map[SubscriptionTier]Limits{
	TierFree: {
		SEOAudits:       2,
		Crawls:          2,
		AIGenerations:   5,
		PDFExports:      10,
		SocialProfiles:  0,
		Forms:           2,
		MaxClients:      3,
		MaxMembers:      1,
		MaxStorageBytes: 500 * mb,
	},
	TierStarter: {
		SEOAudits:       10,
		Crawls:          10,
		AIGenerations:   25,
		PDFExports:      50,
		SocialProfiles:  1,
		Forms:           10,
		MaxClients:      10,
		MaxMembers:      3,
		MaxStorageBytes: 5 * gb,
	},
	TierGrowth: {
		SEOAudits:       50,
		Crawls:          50,
		AIGenerations:   100,
		PDFExports:      500,
		SocialProfiles:  5,
		Forms:           50,
		MaxClients:      50,
		MaxMembers:      10,
		MaxStorageBytes: 20 * gb,
	},
	TierAgencyPro: {
		SEOAudits:       200,
		Crawls:          200,
		AIGenerations:   500,
		PDFExports:      2000,
		SocialProfiles:  20,
		Forms:           200,
		MaxClients:      200,
		MaxMembers:      25,
		MaxStorageBytes: 50 * gb,
	},
}

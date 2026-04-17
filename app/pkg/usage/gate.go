package usage

import "app/pkg/billing"

// FeatureGate maps a binary-gated feature to the tiers that have access.
// Metered features (with numeric caps) are NOT listed here — their access
// is implicit via TierLimits. Use HasFeature to check gated access.
var FeatureGate = map[Feature][]billing.SubscriptionTier{
	// Citation / NAP checks gated to Growth+ due to DataForSEO live-only cost
	// ($0.01 base + $0.0003/listing — see DataForSEO-BusinessDataAPI.md).
	FeatureCitationCheck: {
		billing.TierGrowth,
		billing.TierAgencyPro,
		billing.TierEnterprise,
	},
}

// HasFeature reports whether a tier has access to a gated feature.
// Returns true for features not in FeatureGate (i.e. all tiers have access by default).
func HasFeature(tier billing.SubscriptionTier, feature Feature) bool {
	allowed, gated := FeatureGate[feature]
	if !gated {
		return true
	}
	for _, t := range allowed {
		if t == tier {
			return true
		}
	}
	return false
}

// GetLimit returns the monthly cap for a metered feature on a given tier.
// Returns 0 for unknown tier/feature combinations (treated as "not available").
func GetLimit(tier billing.SubscriptionTier, feature Feature) int {
	limits, ok := billing.TierLimits[tier]
	if !ok {
		return 0
	}
	switch feature {
	case FeatureSEOAudit:
		return limits.SEOAudits
	case FeatureCrawl:
		return limits.Crawls
	case FeatureAIGeneration:
		return limits.AIGenerations
	case FeaturePDFExport:
		return limits.PDFExports
	case FeatureSocialProfile:
		return limits.SocialProfiles
	case FeatureForm:
		return limits.Forms
	default:
		return 0
	}
}

// Package usage defines trackable, rate-limited features and their access gates.
// Feature names are the string keys stored in the agency_usage.feature column —
// always use these constants, never raw strings, to avoid typos.
package usage

// Feature identifies a metered or gated operation.
type Feature string

const (
	FeatureSEOAudit      Feature = "seo_audit"
	FeatureCrawl         Feature = "crawl"
	FeatureAIGeneration  Feature = "ai_generation"
	FeaturePDFExport     Feature = "pdf_export"
	FeatureSocialProfile Feature = "social_profile"
	FeatureForm          Feature = "form"

	// FeatureCitationCheck is a binary access gate (Growth+ only), not a counter.
	// Not included in AllFeatures — consulted via HasFeature, not Consume.
	FeatureCitationCheck Feature = "citation_check"
)

// AllFeatures lists every metered feature. Used for Summary dashboards and
// admin top-consumer queries. Excludes binary gates (e.g. citation_check).
var AllFeatures = []Feature{
	FeatureSEOAudit,
	FeatureCrawl,
	FeatureAIGeneration,
	FeaturePDFExport,
	FeatureSocialProfile,
	FeatureForm,
}

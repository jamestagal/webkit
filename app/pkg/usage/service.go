package usage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"app/pkg/billing"
	"service-core/storage/query"
)

// Sentinel errors — check with errors.Is.
var (
	// ErrLimitExceeded means the agency has reached its monthly cap for this feature.
	ErrLimitExceeded = errors.New("usage: monthly limit exceeded")
	// ErrFeatureDisabled means the feature is not available on the agency's tier.
	ErrFeatureDisabled = errors.New("usage: feature not available on this plan")
)

// Status describes current consumption for a single feature.
type Status struct {
	Feature   Feature
	Current   int
	Limit     int
	Period    string
	Remaining int
	AtWarning bool
	AtLimit   bool
}

// Repo is the narrow set of sqlc-generated methods the service needs.
// Declared here (not imported from query.Querier) so tests can mock cleanly
// without implementing ~100 unrelated methods.
type Repo interface {
	ConsumeIfUnderLimit(ctx context.Context, arg query.ConsumeIfUnderLimitParams) (int32, error)
	GetUsageCount(ctx context.Context, arg query.GetUsageCountParams) (int32, error)
	GetUsageSummary(ctx context.Context, arg query.GetUsageSummaryParams) ([]query.GetUsageSummaryRow, error)
}

// TierLookup returns the current billing tier for an agency.
// Injected to avoid a circular import between billing service and usage.
type TierLookup func(ctx context.Context, agencyID uuid.UUID) (billing.SubscriptionTier, error)

// Service enforces per-tier usage limits.
type Service struct {
	repo        Repo
	tierLookup  TierLookup
	clock       func() time.Time
}

// NewService constructs a Service. clock is optional — defaults to time.Now.UTC.
func NewService(repo Repo, tierLookup TierLookup) *Service {
	return &Service{
		repo:       repo,
		tierLookup: tierLookup,
		clock:      func() time.Time { return time.Now().UTC() },
	}
}

// period formats the current billing period (YYYY-MM, UTC).
func (s *Service) period() string {
	return s.clock().Format("2006-01")
}

// Check returns the current Status without incrementing.
// Used for dashboard display and pre-flight UI hints.
// Returns ErrFeatureDisabled when the tier doesn't include the feature.
func (s *Service) Check(ctx context.Context, agencyID uuid.UUID, feature Feature) (*Status, error) {
	tier, err := s.tierLookup(ctx, agencyID)
	if err != nil {
		return nil, fmt.Errorf("usage.Check: lookup tier: %w", err)
	}

	limit := GetLimit(tier, feature)
	if limit == 0 {
		return nil, ErrFeatureDisabled
	}

	period := s.period()
	current, err := s.repo.GetUsageCount(ctx, query.GetUsageCountParams{
		AgencyID: agencyID,
		Feature:  string(feature),
		Period:   period,
	})
	if err != nil {
		return nil, fmt.Errorf("usage.Check: get count: %w", err)
	}

	return buildStatus(feature, int(current), limit, period), nil
}

// Consume atomically checks the limit and increments the counter in a single
// round-trip (sqlc: ConsumeIfUnderLimit). The underlying SQL uses an ON
// CONFLICT UPDATE WHERE count < limit clause — when the limit is reached the
// update touches no row, RETURNING is empty, and pgx surfaces sql.ErrNoRows
// (pgx/v5 aliases the two). The service maps that to ErrLimitExceeded.
//
// Race-safe: two concurrent requests competing for the last slot can't both
// succeed. Exactly one commits; the other gets ErrLimitExceeded.
func (s *Service) Consume(ctx context.Context, agencyID uuid.UUID, feature Feature) (*Status, error) {
	tier, err := s.tierLookup(ctx, agencyID)
	if err != nil {
		return nil, fmt.Errorf("usage.Consume: lookup tier: %w", err)
	}

	limit := GetLimit(tier, feature)
	if limit == 0 {
		return nil, ErrFeatureDisabled
	}

	period := s.period()
	newCount, err := s.repo.ConsumeIfUnderLimit(ctx, query.ConsumeIfUnderLimitParams{
		AgencyID: agencyID,
		Feature:  string(feature),
		Period:   period,
		MaxCount: int32(limit),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s (limit of %d reached this month)",
				ErrLimitExceeded, feature, limit)
		}
		return nil, fmt.Errorf("usage.Consume: %w", err)
	}

	return buildStatus(feature, int(newCount), limit, period), nil
}

// Summary returns the current Status for every metered feature on the agency's
// tier. Features not yet used this month return Current=0.
func (s *Service) Summary(ctx context.Context, agencyID uuid.UUID) ([]Status, error) {
	tier, err := s.tierLookup(ctx, agencyID)
	if err != nil {
		return nil, fmt.Errorf("usage.Summary: lookup tier: %w", err)
	}

	period := s.period()
	rows, err := s.repo.GetUsageSummary(ctx, query.GetUsageSummaryParams{
		AgencyID: agencyID,
		Period:   period,
	})
	if err != nil {
		return nil, fmt.Errorf("usage.Summary: query: %w", err)
	}

	counts := make(map[Feature]int, len(rows))
	for _, r := range rows {
		counts[Feature(r.Feature)] = int(r.Count)
	}

	out := make([]Status, 0, len(AllFeatures))
	for _, f := range AllFeatures {
		limit := GetLimit(tier, f)
		out = append(out, *buildStatus(f, counts[f], limit, period))
	}
	return out, nil
}

// buildStatus fills warning/limit flags consistently across Check/Consume/Summary.
// A limit of 0 means "not on plan" — warning/limit flags stay false because the
// caller has already short-circuited to ErrFeatureDisabled elsewhere.
func buildStatus(feature Feature, current, limit int, period string) *Status {
	s := &Status{
		Feature: feature,
		Current: current,
		Limit:   limit,
		Period:  period,
	}
	if limit <= 0 {
		return s
	}
	s.Remaining = limit - current
	s.AtWarning = float64(current)/float64(limit) >= 0.80
	s.AtLimit = current >= limit
	return s
}

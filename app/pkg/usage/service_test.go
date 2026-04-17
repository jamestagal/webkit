package usage

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"app/pkg/billing"
	"service-core/storage/query"
)

// fakeRepo is a hand-rolled mock of Repo. Kept minimal — just enough to drive
// the behaviours the service promises. No external mock library.
type fakeRepo struct {
	consumeFn  func(query.ConsumeIfUnderLimitParams) (int32, error)
	countFn    func(query.GetUsageCountParams) (int32, error)
	summaryFn  func(query.GetUsageSummaryParams) ([]query.GetUsageSummaryRow, error)
	lastParams any
}

func (f *fakeRepo) ConsumeIfUnderLimit(_ context.Context, p query.ConsumeIfUnderLimitParams) (int32, error) {
	f.lastParams = p
	return f.consumeFn(p)
}
func (f *fakeRepo) GetUsageCount(_ context.Context, p query.GetUsageCountParams) (int32, error) {
	f.lastParams = p
	return f.countFn(p)
}
func (f *fakeRepo) GetUsageSummary(_ context.Context, p query.GetUsageSummaryParams) ([]query.GetUsageSummaryRow, error) {
	f.lastParams = p
	return f.summaryFn(p)
}

func fixedClock(t time.Time) func() time.Time {
	return func() time.Time { return t }
}

// starterLookup always returns Starter tier. Kept as a helper so each test
// can focus on behaviour rather than tier-lookup plumbing.
func starterLookup(_ context.Context, _ uuid.UUID) (billing.SubscriptionTier, error) {
	return billing.TierStarter, nil
}

func newService(repo Repo) *Service {
	s := NewService(repo, starterLookup)
	s.clock = fixedClock(time.Date(2026, 4, 17, 0, 0, 0, 0, time.UTC))
	return s
}

func TestConsume_FirstUseInsertSucceeds(t *testing.T) {
	repo := &fakeRepo{
		consumeFn: func(p query.ConsumeIfUnderLimitParams) (int32, error) {
			// Insert path — sqlc returns count=1 after first increment.
			if p.MaxCount != 10 {
				t.Errorf("expected MaxCount=10 (Starter SEOAudits), got %d", p.MaxCount)
			}
			if p.Period != "2026-04" {
				t.Errorf("expected Period=2026-04, got %s", p.Period)
			}
			return 1, nil
		},
	}
	status, err := newService(repo).Consume(context.Background(), uuid.New(), FeatureSEOAudit)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Current != 1 || status.Remaining != 9 || status.AtLimit || status.AtWarning {
		t.Errorf("unexpected status: %+v", status)
	}
}

func TestConsume_AtLimitReturnsErrLimitExceeded(t *testing.T) {
	repo := &fakeRepo{
		consumeFn: func(query.ConsumeIfUnderLimitParams) (int32, error) {
			// sql.ErrNoRows is what pgx returns when the ON CONFLICT UPDATE's
			// WHERE clause rejects (count >= limit). The service must map it.
			return 0, sql.ErrNoRows
		},
	}
	_, err := newService(repo).Consume(context.Background(), uuid.New(), FeatureSEOAudit)
	if !errors.Is(err, ErrLimitExceeded) {
		t.Fatalf("expected ErrLimitExceeded, got: %v", err)
	}
}

func TestConsume_UnrelatedDBErrorBubblesUp(t *testing.T) {
	boom := errors.New("database exploded")
	repo := &fakeRepo{
		consumeFn: func(query.ConsumeIfUnderLimitParams) (int32, error) {
			return 0, boom
		},
	}
	_, err := newService(repo).Consume(context.Background(), uuid.New(), FeatureSEOAudit)
	if !errors.Is(err, boom) {
		t.Fatalf("expected underlying error to bubble, got: %v", err)
	}
	if errors.Is(err, ErrLimitExceeded) {
		t.Fatalf("unrelated error must not be coerced into ErrLimitExceeded")
	}
}

func TestConsume_FeatureDisabledOnTier(t *testing.T) {
	// Free tier: SocialProfiles limit is 0 → ErrFeatureDisabled.
	repo := &fakeRepo{
		consumeFn: func(query.ConsumeIfUnderLimitParams) (int32, error) {
			t.Fatal("repo must not be called when feature is disabled")
			return 0, nil
		},
	}
	svc := &Service{
		repo: repo,
		tierLookup: func(context.Context, uuid.UUID) (billing.SubscriptionTier, error) {
			return billing.TierFree, nil
		},
		clock: fixedClock(time.Now()),
	}
	_, err := svc.Consume(context.Background(), uuid.New(), FeatureSocialProfile)
	if !errors.Is(err, ErrFeatureDisabled) {
		t.Fatalf("expected ErrFeatureDisabled, got: %v", err)
	}
}

func TestCheck_ComputesWarningAndLimitFlags(t *testing.T) {
	cases := []struct {
		count              int32
		wantAtWarning      bool
		wantAtLimit        bool
		wantRemaining      int
	}{
		{0, false, false, 10}, // Starter SEOAudits = 10
		{7, false, false, 3},  // 70% — below warning threshold
		{8, true, false, 2},   // 80% — at warning
		{9, true, false, 1},   // 90% — at warning, not limit
		{10, true, true, 0},   // 100% — at limit
	}
	for _, tc := range cases {
		repo := &fakeRepo{
			countFn: func(query.GetUsageCountParams) (int32, error) {
				return tc.count, nil
			},
		}
		status, err := newService(repo).Check(context.Background(), uuid.New(), FeatureSEOAudit)
		if err != nil {
			t.Fatalf("count=%d: unexpected error: %v", tc.count, err)
		}
		if status.AtWarning != tc.wantAtWarning {
			t.Errorf("count=%d: AtWarning=%v, want %v", tc.count, status.AtWarning, tc.wantAtWarning)
		}
		if status.AtLimit != tc.wantAtLimit {
			t.Errorf("count=%d: AtLimit=%v, want %v", tc.count, status.AtLimit, tc.wantAtLimit)
		}
		if status.Remaining != tc.wantRemaining {
			t.Errorf("count=%d: Remaining=%d, want %d", tc.count, status.Remaining, tc.wantRemaining)
		}
	}
}

func TestSummary_ReturnsAllFeaturesWithZeroesForUnused(t *testing.T) {
	// Repo returns only a partial list (seo_audit used, others not).
	repo := &fakeRepo{
		summaryFn: func(query.GetUsageSummaryParams) ([]query.GetUsageSummaryRow, error) {
			return []query.GetUsageSummaryRow{
				{Feature: string(FeatureSEOAudit), Count: 3},
			}, nil
		},
	}
	summaries, err := newService(repo).Summary(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(summaries) != len(AllFeatures) {
		t.Fatalf("expected %d statuses, got %d", len(AllFeatures), len(summaries))
	}
	byFeature := make(map[Feature]Status, len(summaries))
	for _, s := range summaries {
		byFeature[s.Feature] = s
	}
	if byFeature[FeatureSEOAudit].Current != 3 {
		t.Errorf("seo_audit Current=%d, want 3", byFeature[FeatureSEOAudit].Current)
	}
	// A feature never used this month must render as 0, not missing.
	if byFeature[FeatureCrawl].Current != 0 {
		t.Errorf("crawl Current=%d, want 0 (unused)", byFeature[FeatureCrawl].Current)
	}
}

func TestPeriod_FormatsCurrentMonth(t *testing.T) {
	svc := NewService(&fakeRepo{}, starterLookup)
	svc.clock = fixedClock(time.Date(2026, 11, 30, 23, 59, 59, 0, time.UTC))
	if got := svc.period(); got != "2026-11" {
		t.Errorf("period=%q, want 2026-11", got)
	}
}

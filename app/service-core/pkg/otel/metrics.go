package otel

import (
	"context"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	apiMetric "go.opentelemetry.io/otel/metric"
)

type metrics struct {
	authRefreshTotal        apiMetric.Int64Counter
	authorizeDeniedTotal    apiMetric.Int64Counter
	dbQueryDuration         apiMetric.Float64Histogram
	externalRequestDuration apiMetric.Float64Histogram
}

var (
	metricsOnce sync.Once
	appMetrics  metrics
)

const (
	AuthRefreshResultSuccess = "success"
	AuthRefreshResultError   = "error"
	AuthRefreshResultSkipped = "skipped"

	AuthRefreshReasonRefreshed             = "refreshed"
	AuthRefreshReasonNotNeeded             = "not_needed"
	AuthRefreshReasonInvalidOrExpiredToken = "invalid_or_expired_tokens"
	AuthRefreshReasonMissingAccessToken    = "missing_access_token"
	AuthRefreshReasonMissingRefreshToken   = "missing_refresh_token"
)

func setupMetrics() error {
	var err error
	metricsOnce.Do(func() {
		meter := otel.Meter("gofast")

		appMetrics.authRefreshTotal, err = meter.Int64Counter(
			"gofast_auth_refresh_total",
			apiMetric.WithDescription("Authentication refresh outcomes."),
		)
		if err != nil {
			return
		}

		appMetrics.authorizeDeniedTotal, err = meter.Int64Counter(
			"gofast_authorize_denied_total",
			apiMetric.WithDescription("Authorization denials by required access and reason."),
		)
		if err != nil {
			return
		}

		appMetrics.dbQueryDuration, err = meter.Float64Histogram(
			"gofast_db_query_duration_seconds",
			apiMetric.WithDescription("Database query durations."),
			apiMetric.WithUnit("s"),
		)
		if err != nil {
			return
		}

		appMetrics.externalRequestDuration, err = meter.Float64Histogram(
			"gofast_external_request_duration_seconds",
			apiMetric.WithDescription("External dependency request durations."),
			apiMetric.WithUnit("s"),
		)
	})

	return err
}

// AuthRefresh records an authentication refresh outcome.
//
// Webkit's auth flow does not have a discrete refresh handler — this metric
// may report zero in production. Future workstream [webkit-auth-refresh-design]
// (if filed) would close this gap. Per Cowork verdict 2026-05-04 on the
// [gofast-otel-instrumentation] plan: degenerate-empty case is acceptable
// when documented; do NOT manufacture instrumentation sites.
func AuthRefresh(ctx context.Context, result string, reason string) {
	_ = setupMetrics()
	if appMetrics.authRefreshTotal == nil {
		return
	}

	appMetrics.authRefreshTotal.Add(ctx, 1, apiMetric.WithAttributes(
		attribute.String("result", result),
		attribute.String("reason", reason),
	))
}

func AuthorizeDenied(ctx context.Context, access string, reason string) {
	_ = setupMetrics()
	if appMetrics.authorizeDeniedTotal == nil {
		return
	}

	appMetrics.authorizeDeniedTotal.Add(ctx, 1, apiMetric.WithAttributes(
		attribute.String("access", access),
		attribute.String("reason", reason),
	))
}

func StartDBQuery(ctx context.Context, query string) func(err error) {
	_ = setupMetrics()
	start := time.Now()

	return func(err error) {
		if appMetrics.dbQueryDuration == nil {
			return
		}

		appMetrics.dbQueryDuration.Record(ctx, time.Since(start).Seconds(), apiMetric.WithAttributes(
			attribute.String("query", query),
			attribute.String("result", metricResult(err)),
		))
	}
}

func StartExternalCall(ctx context.Context, provider string, operation string) func(err error) {
	_ = setupMetrics()
	start := time.Now()

	return func(err error) {
		if appMetrics.externalRequestDuration == nil {
			return
		}

		appMetrics.externalRequestDuration.Record(ctx, time.Since(start).Seconds(), apiMetric.WithAttributes(
			attribute.String("provider", provider),
			attribute.String("operation", operation),
			attribute.String("result", metricResult(err)),
		))
	}
}

func metricResult(err error) string {
	if err != nil {
		return "error"
	}

	return "success"
}

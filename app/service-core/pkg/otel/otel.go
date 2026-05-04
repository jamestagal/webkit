// Package otel wires the OpenTelemetry SDK for service-core.
//
// SDK pin: go.opentelemetry.io/otel v1.38.0; otelgrpc/otelhttp contrib v0.59.0
// (resolved by `go mod tidy` against existing v1.34.0 indirect deps; compatible
// with the v1.38.0 SDK pin per the gofast-otel-instrumentation Phase 1 work).
package otel

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	span "go.opentelemetry.io/otel/trace"
)

// parseOTLPEndpoint extracts host:port from an OTLP endpoint configuration value.
// Accepts either:
//   - A URL form (per OTel spec): "http://otel-collector:4317" or "https://..."
//   - A bare host:port form: "otel-collector:4317"
//
// Returns the form expected by otlpgrpc.WithEndpoint().
// Returns empty string unchanged (caller is responsible for fail-soft).
// On URL parse failure, returns the raw string so the SDK surfaces its own error.
func parseOTLPEndpoint(raw string) string {
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		u, err := url.Parse(raw)
		if err != nil {
			return raw
		}
		return u.Host
	}
	return raw
}

// StartSpan starts a new span and returns a cleanup function that handles
// error recording and status setting. Use with named return values:
//
//	func Foo(ctx context.Context) (result T, err error) {
//	    ctx, span, done := ot.StartSpan(ctx, "operation.name")
//	    defer func() { done(err) }()
//	    // ... your logic
//	}
func StartSpan(ctx context.Context, name string) (context.Context, span.Span, func(err error)) {
	ctx, s := otel.Tracer("gofast").Start(ctx, name)
	return ctx, s, func(err error) {
		if err != nil {
			s.RecordError(err)
			s.SetStatus(codes.Error, err.Error())
		} else {
			s.SetStatus(codes.Ok, "")
		}
		s.End()
	}
}

func SetupOTelSDK(ctx context.Context, endpoint string, serviceName string) (func(context.Context) error, error) {
	// If no endpoint is configured, disable OTel completely
	if endpoint == "" {
		return func(context.Context) error { return nil }, nil
	}

	var shutdownFuncs []func(context.Context) error
	var err error

	shutdown := func(ctx context.Context) error {
		var err error
		for _, fn := range shutdownFuncs {
			err = errors.Join(err, fn(ctx))
		}
		shutdownFuncs = nil
		return err
	}

	handleErr := func(inErr error) {
		err = errors.Join(inErr, shutdown(ctx))
	}

	// Set up propagator.
	prop := newPropagator()
	otel.SetTextMapPropagator(prop)

	// Set up resource describing this service.
	res, err := newResource(ctx, serviceName)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}

	// Set up trace provider.
	tracerProvider, err := newTracerProvider(ctx, res, endpoint)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, tracerProvider.Shutdown)
	otel.SetTracerProvider(tracerProvider)

	// Set up meter provider.
	meterProvider, err := newMeterProvider(ctx, res, endpoint)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, meterProvider.Shutdown)
	otel.SetMeterProvider(meterProvider)

	err = setupMetrics()
	if err != nil {
		handleErr(err)
		return shutdown, err
	}

	// Set up logger provider.
	loggerProvider, err := newLoggerProvider(ctx, res, endpoint)
	if err != nil {
		handleErr(err)
		return shutdown, err
	}
	shutdownFuncs = append(shutdownFuncs, loggerProvider.Shutdown)
	global.SetLoggerProvider(loggerProvider)

	return shutdown, err
}

func newPropagator() propagation.TextMapPropagator {
	return propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	)
}

func newResource(ctx context.Context, serviceName string) (*resource.Resource, error) {
	attrs := []attribute.KeyValue{
		semconv.ServiceName(serviceName),
	}

	return resource.New(ctx,
		resource.WithFromEnv(),
		resource.WithTelemetrySDK(),
		resource.WithProcess(),
		resource.WithHost(),
		resource.WithAttributes(attrs...),
	)
}

func newTracerProvider(ctx context.Context, res *resource.Resource, endpoint string) (*trace.TracerProvider, error) {
	traceExporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(parseOTLPEndpoint(endpoint)),
	)
	if err != nil {
		return nil, err
	}

	tracerProvider := trace.NewTracerProvider(
		trace.WithBatcher(traceExporter,
			trace.WithBatchTimeout(time.Second)),
		trace.WithResource(res),
	)
	return tracerProvider, nil
}

func newMeterProvider(ctx context.Context, res *resource.Resource, endpoint string) (*metric.MeterProvider, error) {
	metricExporter, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithInsecure(),
		otlpmetricgrpc.WithEndpoint(parseOTLPEndpoint(endpoint)),
	)
	if err != nil {
		return nil, err
	}

	meterProvider := metric.NewMeterProvider(
		metric.WithReader(metric.NewPeriodicReader(metricExporter,
			metric.WithInterval(3*time.Second))),
		metric.WithResource(res),
	)
	return meterProvider, nil
}

func newLoggerProvider(ctx context.Context, res *resource.Resource, endpoint string) (*log.LoggerProvider, error) {
	logExporter, err := otlploggrpc.New(ctx,
		otlploggrpc.WithInsecure(),
		otlploggrpc.WithEndpoint(parseOTLPEndpoint(endpoint)),
	)
	if err != nil {
		return nil, err
	}

	loggerProvider := log.NewLoggerProvider(
		log.WithProcessor(log.NewBatchProcessor(logExporter)),
		log.WithResource(res),
	)
	return loggerProvider, nil
}

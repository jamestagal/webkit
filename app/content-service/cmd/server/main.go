package main

import (
	"app/pkg"
	"app/pkg/auth"
	"app/pkg/billing"
	"app/pkg/cfbrowser"
	"app/pkg/dataforseo"
	"app/pkg/jina"
	"app/pkg/otel"
	"app/pkg/usage"
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"content-service/config"
	"content-service/internal/embeddings"
	"content-service/internal/jobs"
	"content-service/rest"
	"service-core/storage/query"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/nats-io/nats.go"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Set up the logger
	pkg.InitLogger(cfg.LogLevel)

	// Set up OpenTelemetry. Fail-soft on empty endpoint: SetupOTelSDK returns a
	// no-op shutdown when OTEL_EXPORTER_OTLP_ENDPOINT is unset so the service
	// boots in degraded mode without panicking. Mirrors service-core's pattern
	// (commit 873e819) using the now-shared app/pkg/otel helper.
	ctx := context.Background()
	otelShutdown, err := otel.SetupOTelSDK(ctx, cfg.OTLPEndpoint, cfg.ServiceName)
	if err != nil {
		slog.ErrorContext(ctx, "Error setting up OpenTelemetry", "error", err)
		panic(err)
	}
	if cfg.OTLPEndpoint == "" {
		slog.InfoContext(ctx, "OpenTelemetry not configured (OTEL_EXPORTER_OTLP_ENDPOINT empty); continuing in degraded mode")
	} else {
		slog.InfoContext(ctx, "OpenTelemetry initialized", "endpoint", cfg.OTLPEndpoint, "service", cfg.ServiceName)
		// Emit a one-shot bootstrap span so the service registers in
		// VictoriaTraces' services list immediately. content-service has no
		// inbound HTTP/gRPC OTel middleware (out of this workstream's scope),
		// so without this the trace pipeline stays silent until Phase 3
		// instrumentation fires. Span is cheap and proves SDK→exporter→
		// collector→VictoriaTraces is healthy end-to-end.
		_, _, done := otel.StartSpan(ctx, "boot")
		done(nil)
	}

	// Connect to PostgreSQL
	db, dbClean, err := openPostgres(cfg)
	if err != nil {
		slog.Error("Error opening database", "error", err)
		panic(err)
	}
	defer dbClean()

	err = db.PingContext(context.Background())
	if err != nil {
		slog.Error("Error connecting to database", "error", err)
		panic(err)
	}
	slog.Info("Database connected")

	// Connect to NATS
	nc, err := nats.Connect(cfg.NATSURL,
		nats.Name("content-service"),
		nats.ReconnectWait(2*time.Second),
		nats.MaxReconnects(5),
	)
	if err != nil {
		slog.Error("Error connecting to NATS", "error", err)
		panic(err)
	}
	defer nc.Close()
	slog.Info("NATS connected")

	// Create auth service
	authService := auth.NewService()

	// Build the usage service. TierLookup reads subscription_tier from
	// the agencies table via a narrow raw query — no need to depend on
	// service-core's billing service here, which would introduce an extra
	// HTTP hop per Consume() call.
	usageRepo := query.New(db)
	tierLookup := func(ctx context.Context, agencyID uuid.UUID) (billing.SubscriptionTier, error) {
		var tier string
		err := db.QueryRowContext(ctx,
			"SELECT subscription_tier FROM agencies WHERE id = $1",
			agencyID,
		).Scan(&tier)
		if err != nil {
			return "", fmt.Errorf("lookup tier for agency %s: %w", agencyID, err)
		}
		return billing.SubscriptionTier(tier), nil
	}
	usageService := usage.NewService(usageRepo, tierLookup)

	// Create API clients
	var cfClient *cfbrowser.Client
	if cfg.CFBrowserWorkerURL != "" {
		cfClient = cfbrowser.NewClient(cfg.CFBrowserWorkerURL)
	}
	jinaClient := jina.NewClient()
	var embedClient *embeddings.Client
	if cfg.CFAccountID != "" && cfg.CFAPIToken != "" {
		embedClient = embeddings.NewClient(cfg.CFAccountID, cfg.CFAPIToken)
	}
	var dfsClient *dataforseo.Client
	if cfg.DataForSEOLogin != "" && cfg.DataForSEOPassword != "" {
		dfsClient = dataforseo.NewClient(cfg.DataForSEOLogin, cfg.DataForSEOPassword)
	}

	// Start job manager
	jobMgr := jobs.NewManager(db, nc, cfg, cfClient, jinaClient, embedClient, dfsClient)
	if err := jobMgr.Start(); err != nil {
		slog.Error("Error starting job manager", "error", err)
		panic(err)
	}
	defer jobMgr.Stop()

	// Create REST handler
	handler := rest.NewHandler(cfg, db, nc, authService, usageService)

	// Run HTTP server
	server := rest.Run(handler)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down content service...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server forced to shutdown", "error", err)
	}

	// Flush pending OTel spans/metrics/logs before exit. Mirrors service-core's
	// shutdown ordering (commit 873e819): server stops first, then OTel flushes.
	if err := otelShutdown(shutdownCtx); err != nil {
		slog.Error("Error shutting down OpenTelemetry", "error", err)
	}

	slog.Info("Content service stopped gracefully")
}

func openPostgres(cfg *config.Config) (*sql.DB, func(), error) {
	host := net.JoinHostPort(cfg.PostgresHost, cfg.PostgresPort)
	url := fmt.Sprintf(
		"postgres://%s:%s@%s/%s?sslmode=disable",
		cfg.PostgresUser,
		cfg.PostgresPassword,
		host,
		cfg.PostgresDB,
	)

	dbpool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return nil, nil, fmt.Errorf("error opening connection: %w", err)
	}

	clean := func() {
		dbpool.Close()
	}

	db := stdlib.OpenDBFromPool(dbpool)
	return db, clean, nil
}

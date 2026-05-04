package main

import (
	"app/pkg"
	"app/pkg/auth"
	pkgbilling "app/pkg/billing"
	"app/pkg/usage"
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"

	"service-core/config"
	"service-core/domain/billing"
	"service-core/domain/email"
	"service-core/domain/file"
	"service-core/domain/login"
	"service-core/domain/note"
	"service-core/domain/user"
	"service-core/grpc"
	"service-core/pkg/otel"
	"service-core/rest"
	"service-core/storage"
	"service-core/storage/query"
)

func main() {
	ctx := context.Background()

	// Load the configuration
	cfg := config.LoadConfig()

	// Set up the logger
	pkg.InitLogger(cfg.LogLevel)

	// Set up OpenTelemetry. Fail-soft on empty endpoint: SetupOTelSDK returns a
	// no-op shutdown when OTEL_EXPORTER_OTLP_ENDPOINT is unset so the service
	// boots in degraded mode without panicking.
	otelShutdown, err := otel.SetupOTelSDK(ctx, cfg.OTLPEndpoint, cfg.ServiceName)
	if err != nil {
		slog.ErrorContext(ctx, "Error setting up OpenTelemetry", "error", err)
		panic(err)
	}
	if cfg.OTLPEndpoint == "" {
		slog.InfoContext(ctx, "OpenTelemetry not configured (OTEL_EXPORTER_OTLP_ENDPOINT empty); continuing in degraded mode")
	} else {
		slog.InfoContext(ctx, "OpenTelemetry initialized", "endpoint", cfg.OTLPEndpoint, "service", cfg.ServiceName)
	}

	// Connect to the database
	s, clean, err := storage.NewStorage(cfg)
	defer clean()
	if err != nil {
		slog.Error("Error opening database", "error", err)
		panic(err)
	}
	err = s.Conn.PingContext(context.Background())
	if err != nil {
		slog.Error("Error connecting to database", "error", err)
		panic(err)
	}
	slog.Info("Database connected")

	// Set up the REST handlers
	restHandler := setupRESTHandlers(cfg, s)
	// Run the REST server
	restServer := rest.Run(restHandler)

	// Set up the gRPC handlers
	grpcHandler := setupGRPCHandlers(cfg, s)
	// Run the gRPC server
	grpcServer := grpc.Run(grpcHandler)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down servers...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := restServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("REST server forced to shutdown", "error", err)
	}

	grpcServer.GracefulStop()

	// Flush pending OTel spans/metrics/logs before exit.
	if err := otelShutdown(shutdownCtx); err != nil {
		slog.Error("Error shutting down OpenTelemetry", "error", err)
	}

	slog.Info("Servers stopped gracefully")
}

func setupRESTHandlers(cfg *config.Config, storage *storage.Storage) *rest.Handler {
	store := query.New(storage.Conn)
	authService := auth.NewService()
	fileProvider := file.NewProvider(cfg)
	fileService := file.NewService(cfg, store, fileProvider)
	emailProvider := email.NewProvider(cfg)
	emailService := email.NewService(cfg, store, emailProvider, fileService)
	loginService := login.NewService(cfg, store, authService, emailService)
	billingService := billing.NewService(cfg, store)
	noteService := note.NewService(store)

	// Usage service: TierLookup reuses the existing GetAgencyBillingInfo
	// sqlc query (single-row SELECT) so the hot path stays one DB round-trip.
	tierLookup := func(ctx context.Context, agencyID uuid.UUID) (pkgbilling.SubscriptionTier, error) {
		info, err := store.GetAgencyBillingInfo(ctx, agencyID)
		if err != nil {
			return "", fmt.Errorf("lookup tier for agency %s: %w", agencyID, err)
		}
		return pkgbilling.SubscriptionTier(info.SubscriptionTier), nil
	}
	usageService := usage.NewService(store, tierLookup)

	apiHandler := rest.NewHandler(
		cfg,
		storage,
		authService,
		loginService,
		billingService,
		emailService,
		fileService,
		noteService,
		usageService,
	)
	return apiHandler
}

func setupGRPCHandlers(cfg *config.Config, storage *storage.Storage) *grpc.Handler {
	store := query.New(storage.Conn)
	authService := auth.NewService()
	loginService := login.NewService(cfg, store, authService, nil) // Email service is not used in gRPC
	userService := user.NewService(cfg, store)
	noteService := note.NewService(store)
	grpcHandler := grpc.NewHandler(
		cfg,
		authService,
		loginService,
		userService,
		noteService,
	)
	return grpcHandler
}

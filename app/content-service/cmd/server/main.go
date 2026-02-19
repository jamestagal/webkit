package main

import (
	"app/pkg"
	"app/pkg/auth"
	"app/pkg/cfbrowser"
	"app/pkg/dataforseo"
	"app/pkg/jina"
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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/nats-io/nats.go"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Set up the logger
	pkg.InitLogger(cfg.LogLevel)

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
	handler := rest.NewHandler(cfg, db, nc, authService)

	// Run HTTP server
	server := rest.Run(handler)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down content service...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("HTTP server forced to shutdown", "error", err)
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

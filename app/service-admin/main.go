package main

import (
	"app/pkg"
	"log/slog"
	"service-admin/auth"
	"service-admin/config"
	"service-admin/grpc"
	"service-admin/pubsub"
	"service-admin/rest"
	"service-admin/sse"
)

func main() {
	// Load the configuration
	cfg := config.LoadConfig()

	// Set up the logger
	pkg.InitLogger(cfg.LogLevel)

	// Connect to NATS
	nc := pubsub.ConnectNATS(cfg.NATSURL)
	// Create Event Broker
	broker, err := pubsub.NewEventBroker(nc, "notifications")
	if err != nil {
		panic(err)
	}
	slog.Info("NATS connection established", "url", cfg.NATSURL)

	// Create gRPC connection
	conn, err := grpc.NewConn(cfg)
	if err != nil {
		panic(err)
	}
	defer conn.Close()
	slog.Info("gRPC connection established", "address", cfg.CoreURI)

	// Set up REST handlers
	restHandler := setupRESTHandlers(cfg, conn, broker)
	// Run the REST server
	rest.Run(restHandler)

	// Set up SSE handler
	sseHandler := setupSSEHandler(cfg, broker)
	// Run the SSE server
	sse.Run(sseHandler)

	select {}
}

func setupRESTHandlers(cfg *config.Config, conn *grpc.Conn, broker *pubsub.EventBroker) *rest.Handler {
	authService := auth.NewService(cfg)
	handler := rest.NewHandler(cfg, conn, broker, authService)
	return handler
}

func setupSSEHandler(cfg *config.Config, broker *pubsub.EventBroker) *sse.Handler {
	authService := auth.NewService(cfg)
	handler := sse.NewHandler(cfg, broker, authService)
	return handler
}

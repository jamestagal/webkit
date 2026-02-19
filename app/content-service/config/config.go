package config

import (
	"os"
	"time"
)

type Config struct {
	// General
	LogLevel  string
	HTTPPort  string
	Domain    string
	ClientURL string

	// Database
	PostgresHost     string
	PostgresPort     string
	PostgresDB       string
	PostgresUser     string
	PostgresPassword string

	// NATS
	NATSURL string

	// External APIs (empty string = disabled)
	CFBrowserWorkerURL string
	DataForSEOLogin    string
	DataForSEOPassword string
	AnthropicAPIKey    string

	// Cloudflare Workers AI
	CFAccountID string
	CFAPIToken  string

	// Timeouts
	HTTPTimeout    time.Duration
	ContextTimeout time.Duration
}

func mustEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic("Missing required environment variable: " + key)
	}
	return value
}

func LoadConfig() *Config {
	const (
		HTTPTimeout    = 30 * time.Second
		ContextTimeout = 30 * time.Second
	)

	return &Config{
		LogLevel:  getEnvOrDefault("LOG_LEVEL", "info"),
		HTTPPort:  mustEnv("HTTP_PORT"),
		Domain:    getEnvOrDefault("DOMAIN", "localhost"),
		ClientURL: getEnvOrDefault("CLIENT_URL", "http://localhost:3000"),

		PostgresHost:     mustEnv("POSTGRES_HOST"),
		PostgresPort:     getEnvOrDefault("POSTGRES_PORT", "5432"),
		PostgresDB:       mustEnv("POSTGRES_DB"),
		PostgresUser:     mustEnv("POSTGRES_USER"),
		PostgresPassword: mustEnv("POSTGRES_PASSWORD"),

		NATSURL: getEnvOrDefault("NATS_URL", "nats://localhost:4222"),

		CFBrowserWorkerURL: os.Getenv("CF_BROWSER_WORKER_URL"),
		DataForSEOLogin:    os.Getenv("DATAFORSEO_LOGIN"),
		DataForSEOPassword: os.Getenv("DATAFORSEO_PASSWORD"),
		AnthropicAPIKey:    os.Getenv("ANTHROPIC_API_KEY"),
		CFAccountID:        os.Getenv("CF_ACCOUNT_ID"),
		CFAPIToken:         os.Getenv("CF_API_TOKEN"),

		HTTPTimeout:    HTTPTimeout,
		ContextTimeout: ContextTimeout,
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

package rest

import (
	"app/pkg/auth"
	"app/pkg/usage"
	"content-service/config"
	"database/sql"

	"github.com/nats-io/nats.go"
)

type Handler struct {
	cfg         *config.Config
	db          *sql.DB
	natsConn    *nats.Conn
	authService *auth.Service
	usage       *usage.Service
}

func NewHandler(
	cfg *config.Config,
	db *sql.DB,
	natsConn *nats.Conn,
	authService *auth.Service,
	usageService *usage.Service,
) *Handler {
	return &Handler{
		cfg:         cfg,
		db:          db,
		natsConn:    natsConn,
		authService: authService,
		usage:       usageService,
	}
}

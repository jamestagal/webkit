package rest

import (
	"app/pkg/auth"
	"content-service/config"
	"database/sql"

	"github.com/nats-io/nats.go"
)

type Handler struct {
	cfg         *config.Config
	db          *sql.DB
	natsConn    *nats.Conn
	authService *auth.Service
}

func NewHandler(
	cfg *config.Config,
	db *sql.DB,
	natsConn *nats.Conn,
	authService *auth.Service,
) *Handler {
	return &Handler{
		cfg:         cfg,
		db:          db,
		natsConn:    natsConn,
		authService: authService,
	}
}

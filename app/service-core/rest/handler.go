package rest

import (
	"app/pkg/auth"
	"service-core/domain/email"
	"service-core/domain/file"
	"service-core/domain/login"
	"service-core/domain/note"
	"service-core/domain/payment"
	"service-core/storage"
	"service-core/config"
)

type Handler struct {
	cfg            *config.Config
	storage        *storage.Storage
	authService    *auth.Service
	loginService   *login.Service
	paymentService *payment.Service
	emailService   *email.Service
	fileService    *file.Service
	noteService    *note.Service
}

func NewHandler(
	config *config.Config,
	storage *storage.Storage,
	authService *auth.Service,
	loginService *login.Service,
	paymentService *payment.Service,
	emailService *email.Service,
	fileService *file.Service,
	noteService *note.Service,
) *Handler {
	return &Handler{
		cfg:            config,
		storage:        storage,
		authService:    authService,
		loginService:   loginService,
		paymentService: paymentService,
		emailService:   emailService,
		fileService:    fileService,
		noteService:    noteService,
	}
}

package rest

import (
	"app/pkg"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"service-core/config"
)

func Run(apiHandler *Handler) {
	cfg := apiHandler.cfg
	mux := http.NewServeMux()

	// Login and authentication
	mux.HandleFunc("/refresh", apiHandler.handleRefresh)
	mux.HandleFunc("/logout", apiHandler.handleLogout)
	mux.HandleFunc("/login", apiHandler.handleLogin)
	mux.HandleFunc("/login-callback/{provider}", apiHandler.handleLoginCallback)
	mux.HandleFunc("/login-phone", apiHandler.handleLoginPhone)
	mux.HandleFunc("/login-verify", apiHandler.handleLoginVerify)

	// API v1 routes (what the frontend expects)
	mux.HandleFunc("/api/v1/refresh", apiHandler.handleRefresh)
	mux.HandleFunc("/api/v1/logout", apiHandler.handleLogout)
	mux.HandleFunc("/api/v1/login", apiHandler.handleLogin)
	mux.HandleFunc("/api/v1/login-callback/{provider}", apiHandler.handleLoginCallback)
	mux.HandleFunc("/api/v1/login-phone", apiHandler.handleLoginPhone)
	mux.HandleFunc("/api/v1/login-verify", apiHandler.handleLoginVerify)

	// Payments
	mux.HandleFunc("/payments-portal", apiHandler.handlePaymentsPortal)
	mux.HandleFunc("/payments-checkout", apiHandler.handlePaymentsCheckout)
	mux.HandleFunc("/payments-update", apiHandler.handlePaymentsUpdate)
	mux.HandleFunc("/payments-webhook", apiHandler.handlePaymentsWebhook)
	mux.HandleFunc("/api/v1/payments-portal", apiHandler.handlePaymentsPortal)
	mux.HandleFunc("/api/v1/payments-checkout", apiHandler.handlePaymentsCheckout)
	mux.HandleFunc("/api/v1/payments-update", apiHandler.handlePaymentsUpdate)
	mux.HandleFunc("/api/v1/payments-webhook", apiHandler.handlePaymentsWebhook)

	// Emails
	mux.HandleFunc("/emails", apiHandler.handleEmails)
	mux.HandleFunc("/api/v1/emails", apiHandler.handleEmails)

	// Files
	mux.HandleFunc("/files", apiHandler.handleFilesCollection)
	mux.HandleFunc("/files/{id}", apiHandler.handleFileResource)
	mux.HandleFunc("/api/v1/files", apiHandler.handleFilesCollection)
	mux.HandleFunc("/api/v1/files/{id}", apiHandler.handleFileResource)

	// Notes
	mux.HandleFunc("/notes", apiHandler.handleNotesCollection)
	mux.HandleFunc("/notes/{id}", apiHandler.handleNoteResource)
	mux.HandleFunc("/api/v1/notes", apiHandler.handleNotesCollection)
	mux.HandleFunc("/api/v1/notes/{id}", apiHandler.handleNoteResource)

	// Consultations - Core CRUD operations (both legacy and API v1 paths)
	mux.HandleFunc("/consultations", apiHandler.handleConsultationsCollection)
	mux.HandleFunc("/consultations/{id}", apiHandler.handleConsultationResource)
	mux.HandleFunc("/api/v1/consultations", apiHandler.handleConsultationsCollection)
	mux.HandleFunc("/api/v1/consultations/{id}", apiHandler.handleConsultationResource)

	// Consultations - Draft management
	mux.HandleFunc("/consultations/{id}/drafts", apiHandler.handleConsultationDrafts)
	mux.HandleFunc("/api/v1/consultations/{id}/drafts", apiHandler.handleConsultationDrafts)

	// Consultations - Version history
	mux.HandleFunc("/consultations/{id}/versions", apiHandler.handleConsultationVersions)
	mux.HandleFunc("/consultations/{id}/versions/{version}", apiHandler.handleConsultationVersions)
	mux.HandleFunc("/api/v1/consultations/{id}/versions", apiHandler.handleConsultationVersions)
	mux.HandleFunc("/api/v1/consultations/{id}/versions/{version}", apiHandler.handleConsultationVersions)

	// Consultations - Lifecycle operations
	mux.HandleFunc("/consultations/{id}/complete", apiHandler.handleConsultationComplete)
	mux.HandleFunc("/consultations/{id}/archive", apiHandler.handleConsultationArchive)
	mux.HandleFunc("/consultations/{id}/restore", apiHandler.handleConsultationRestore)
	mux.HandleFunc("/api/v1/consultations/{id}/complete", apiHandler.handleConsultationComplete)
	mux.HandleFunc("/api/v1/consultations/{id}/archive", apiHandler.handleConsultationArchive)
	mux.HandleFunc("/api/v1/consultations/{id}/restore", apiHandler.handleConsultationRestore)

	// Cron jobs
	mux.HandleFunc("/tasks/delete-tokens", apiHandler.handleTasksDeleteTokens)

	// Health checks
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		err := apiHandler.storage.Conn.PingContext(r.Context())
		if err != nil {
			slog.Error("Error pinging database", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, err = w.Write([]byte("OK"))
		if err != nil {
			panic(err)
		}
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		err := apiHandler.storage.Conn.PingContext(r.Context())
		if err != nil {
			slog.Error("Error pinging database", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, err = w.Write([]byte("OK"))
		if err != nil {
			panic(err)
		}
	})

	handler := loggingMiddleware(mux)
	go func() {
		slog.Info("HTTP server listening on", "port", cfg.HTTPPort)
		server := &http.Server{Addr: ":" + cfg.HTTPPort, Handler: handler, ReadHeaderTimeout: cfg.HTTPTimeout, WriteTimeout: cfg.HTTPTimeout}
		err := server.ListenAndServe()
		if err != nil {
			slog.Error("Error serving HTTP", "error", err)
			panic(err)
		}
	}()
}

func extractAccessToken(r *http.Request) string {
	token, err := r.Cookie("access_token")
	if err != nil {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			return authHeader[7:]
		}
		return authHeader
	}
	return token.Value
}

func writeResponse(cfg *config.Config, w http.ResponseWriter, r *http.Request, data any, err error) {
	w.Header().Set("Access-Control-Allow-Origin", cfg.ClientURL)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

	if err != nil {
		var unauthorizedError pkg.UnauthorizedError
		var internalError pkg.InternalError
		var badRequestError pkg.BadRequestError
		var notFoundError pkg.NotFoundError
		var validationErrors pkg.ValidationErrors
		switch {
		case errors.As(err, &unauthorizedError):
			slog.Error("Unauthorized", "error", err)
			returnURL := r.FormValue("return_url")
			if returnURL == "" {
				// Return JSON error for API requests
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"message": "Unauthorized",
					"code":    401,
				})
			} else {
				http.Redirect(w, r, returnURL+"/login?error=unauthorized", http.StatusSeeOther)
			}
			return
		case errors.As(err, &internalError):
			slog.Error("Internal error", "error", internalError)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": internalError.Message,
				"code":    500,
			})
			return
		case errors.As(err, &badRequestError):
			slog.Error("Bad request error", "error", badRequestError)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": badRequestError.Message,
				"code":    400,
			})
			return
		case errors.As(err, &notFoundError):
			slog.Error("Not found error", "error", notFoundError)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": notFoundError.Message,
				"code":    404,
			})
			return
		case errors.As(err, &validationErrors):
			slog.Error("Validation error", "error", validationErrors)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnprocessableEntity)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": validationErrors.Error(),
				"code":    422,
			})
			return
		default:
			slog.Error("Error", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": err.Error(),
				"code":    500,
			})
			return
		}
	}
	if data == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Wrap successful responses in Safe<T> format expected by frontend
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	safeResponse := map[string]interface{}{
		"success": true,
		"data":    data,
		"message": "Operation completed successfully",
	}
	err = json.NewEncoder(w).Encode(safeResponse)
	if err != nil {
		slog.Error("Error writing response", "error", err)
		http.Error(w, "Error writing response", http.StatusInternalServerError)
		return
	}
}
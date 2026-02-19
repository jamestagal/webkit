package rest

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type contextKey string

const (
	ctxUserID   contextKey = "user_id"
	ctxAgencyID contextKey = "agency_id"
)

// authMiddleware validates JWT from Authorization header and checks agency membership.
func (h *Handler) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract JWT from Authorization: Bearer ... header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			writeJSON(w, http.StatusUnauthorized, errorResponse("missing or invalid authorization header"))
			return
		}
		token := authHeader[7:]

		// Validate the access token
		claims, err := h.authService.ValidateAccessToken(token)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, errorResponse("invalid access token"))
			return
		}

		// Read X-Agency-ID header (required, set by SvelteKit)
		agencyIDStr := r.Header.Get("X-Agency-ID")
		if agencyIDStr == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("missing X-Agency-ID header"))
			return
		}

		agencyID, err := uuid.Parse(agencyIDStr)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse("invalid agency ID format"))
			return
		}

		// Verify active agency membership
		var exists bool
		err = h.db.QueryRowContext(r.Context(),
			"SELECT EXISTS(SELECT 1 FROM agency_memberships WHERE user_id = $1 AND agency_id = $2 AND status = 'active')",
			claims.ID, agencyID,
		).Scan(&exists)
		if err != nil {
			slog.Error("Error checking agency membership", "error", err)
			writeJSON(w, http.StatusInternalServerError, errorResponse("internal error"))
			return
		}
		if !exists {
			writeJSON(w, http.StatusForbidden, errorResponse("not a member of this agency"))
			return
		}

		// Store user_id and agency_id in context
		ctx := context.WithValue(r.Context(), ctxUserID, claims.ID)
		ctx = context.WithValue(ctx, ctxAgencyID, agencyID)
		next(w, r.WithContext(ctx))
	}
}

// getUserID extracts the authenticated user ID from request context.
func getUserID(r *http.Request) uuid.UUID {
	return r.Context().Value(ctxUserID).(uuid.UUID)
}

// getAgencyID extracts the agency ID from request context.
func getAgencyID(r *http.Request) uuid.UUID {
	return r.Context().Value(ctxAgencyID).(uuid.UUID)
}

// loggingMiddleware logs HTTP requests.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		next.ServeHTTP(w, r)

		if r.URL.Path == "/ready" || r.URL.Path == "/health" {
			return
		}

		slog.Info("HTTP call",
			slog.String("http_method", r.Method),
			slog.String("http_path", r.URL.Path),
			slog.String("duration", time.Since(start).String()),
			slog.String("remote_addr", r.RemoteAddr),
			slog.String("user_agent", r.UserAgent()),
		)
	})
}

// corsMiddleware handles CORS headers globally.
func corsMiddleware(clientURL string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", clientURL)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Agency-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

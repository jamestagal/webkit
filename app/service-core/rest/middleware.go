package rest

import (
	"app/pkg"
	"app/pkg/auth"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// Middleware types
type Middleware func(http.HandlerFunc) http.HandlerFunc

// AuthMiddleware adds authentication to requests
func AuthMiddleware(authService *auth.Service, requiredAccess int64) Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			accessToken := extractAccessToken(r)

			user, err := authService.Auth(accessToken, requiredAccess)
			if err != nil {
				writeResponse(nil, w, r, nil, err)
				return
			}

			// Add user to context
			ctx := context.WithValue(r.Context(), "user", user)
			r = r.WithContext(ctx)

			next(w, r)
		}
	}
}

// ValidationMiddleware validates JSON input for consultation endpoints
func ValidationMiddleware() Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Only validate requests with JSON body
			if r.Method == http.MethodPost || r.Method == http.MethodPut {
				contentType := r.Header.Get("Content-Type")
				if strings.Contains(contentType, "application/json") {
					if err := validateJSONInput(r); err != nil {
						writeResponse(nil, w, r, nil, pkg.BadRequestError{
							Message: "Invalid JSON format",
							Err:     err,
						})
						return
					}
				}
			}

			next(w, r)
		}
	}
}

// RateLimitMiddleware implements basic rate limiting
func RateLimitMiddleware(requestsPerMinute int) Middleware {
	// Simple in-memory rate limiter
	// In production, this would use Redis or similar distributed cache
	clients := make(map[string][]time.Time)

	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			clientIP := getClientIP(r)
			now := time.Now()

			// Clean old entries
			if requests, exists := clients[clientIP]; exists {
				var validRequests []time.Time
				for _, reqTime := range requests {
					if now.Sub(reqTime) < time.Minute {
						validRequests = append(validRequests, reqTime)
					}
				}
				clients[clientIP] = validRequests
			}

			// Check rate limit
			if len(clients[clientIP]) >= requestsPerMinute {
				writeResponse(nil, w, r, nil, pkg.BadRequestError{
					Message: "Rate limit exceeded",
					Err:     fmt.Errorf("too many requests from %s", clientIP),
				})
				return
			}

			// Add current request
			clients[clientIP] = append(clients[clientIP], now)

			next(w, r)
		}
	}
}

// CORSMiddleware handles CORS headers
func CORSMiddleware(allowedOrigins []string) Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, allowedOrigin := range allowedOrigins {
				if allowedOrigin == "*" || allowedOrigin == origin {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "86400")

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next(w, r)
		}
	}
}

// LoggingMiddleware logs HTTP requests
func LoggingMiddleware() Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Create a response writer that captures status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			next(wrapped, r)

			duration := time.Since(start)

			slog.Info("HTTP request",
				"method", r.Method,
				"path", r.URL.Path,
				"query", r.URL.RawQuery,
				"status", wrapped.statusCode,
				"duration", duration,
				"user_agent", r.Header.Get("User-Agent"),
				"remote_addr", getClientIP(r),
			)
		}
	}
}

// ContentTypeMiddleware validates and sets content type
func ContentTypeMiddleware() Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// For POST/PUT requests, require JSON content type
			if r.Method == http.MethodPost || r.Method == http.MethodPut {
				contentType := r.Header.Get("Content-Type")
				if !strings.Contains(contentType, "application/json") {
					writeResponse(nil, w, r, nil, pkg.BadRequestError{
						Message: "Content-Type must be application/json",
						Err:     fmt.Errorf("invalid content type: %s", contentType),
					})
					return
				}
			}

			next(w, r)
		}
	}
}

// SecurityHeadersMiddleware adds security headers
func SecurityHeadersMiddleware() Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

			next(w, r)
		}
	}
}

// Chain combines multiple middlewares
func Chain(middlewares ...Middleware) Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		for i := len(middlewares) - 1; i >= 0; i-- {
			next = middlewares[i](next)
		}
		return next
	}
}

// Helper functions

// validateJSONInput validates that the request body contains valid JSON
func validateJSONInput(r *http.Request) error {
	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return fmt.Errorf("error reading request body: %w", err)
	}

	// Restore body for next handler
	r.Body = io.NopCloser(strings.NewReader(string(body)))

	// Validate JSON
	var data interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	return nil
}

// getClientIP extracts the real client IP from request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP in the list
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// GetUserFromContext extracts the authenticated user from request context
func GetUserFromContext(r *http.Request) (*auth.AccessTokenClaims, bool) {
	user, ok := r.Context().Value("user").(*auth.AccessTokenClaims)
	return user, ok
}

// RequireAuth is a helper that ensures a user is authenticated
func RequireAuth(w http.ResponseWriter, r *http.Request) (*auth.AccessTokenClaims, bool) {
	user, ok := GetUserFromContext(r)
	if !ok {
		writeResponse(nil, w, r, nil, pkg.UnauthorizedError{
			Err: fmt.Errorf("authentication required"),
		})
		return nil, false
	}
	return user, true
}

// Validation helper functions for consultation-specific validation

// ValidateConsultationCreate validates consultation creation request
func ValidateConsultationCreate(data map[string]interface{}) []pkg.ValidationError {
	var errors []pkg.ValidationError

	// Check required fields or business rules
	if contactInfo, ok := data["contactInfo"].(map[string]interface{}); ok {
		if businessName, ok := contactInfo["businessName"].(string); !ok || strings.TrimSpace(businessName) == "" {
			errors = append(errors, pkg.ValidationError{
				Field:   "contactInfo.businessName",
				Tag:     "required",
				Message: "Business name is required",
			})
		}

		if email, ok := contactInfo["email"].(string); ok && email != "" {
			if !isValidEmail(email) {
				errors = append(errors, pkg.ValidationError{
					Field:   "contactInfo.email",
					Tag:     "email",
					Message: "Invalid email format",
				})
			}
		}
	}

	// Validate pain points if provided
	if painPoints, ok := data["painPoints"].(map[string]interface{}); ok {
		if urgencyLevel, ok := painPoints["urgencyLevel"].(string); ok && urgencyLevel != "" {
			validUrgencies := []string{"low", "medium", "high", "critical"}
			if !contains(validUrgencies, urgencyLevel) {
				errors = append(errors, pkg.ValidationError{
					Field:   "painPoints.urgencyLevel",
					Tag:     "oneof",
					Message: "Urgency level must be one of: low, medium, high, critical",
				})
			}
		}
	}

	return errors
}

// ValidateConsultationUpdate validates consultation update request
func ValidateConsultationUpdate(data map[string]interface{}) []pkg.ValidationError {
	var errors []pkg.ValidationError

	// Similar validation to create but all fields are optional
	if contactInfo, ok := data["contactInfo"].(map[string]interface{}); ok {
		if email, ok := contactInfo["email"].(string); ok && email != "" {
			if !isValidEmail(email) {
				errors = append(errors, pkg.ValidationError{
					Field:   "contactInfo.email",
					Tag:     "email",
					Message: "Invalid email format",
				})
			}
		}
	}

	// Validate status transition if provided
	if status, ok := data["status"].(string); ok && status != "" {
		validStatuses := []string{"draft", "completed", "archived"}
		if !contains(validStatuses, status) {
			errors = append(errors, pkg.ValidationError{
				Field:   "status",
				Tag:     "oneof",
				Message: "Status must be one of: draft, completed, archived",
			})
		}
	}

	return errors
}

// Helper validation functions
func isValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
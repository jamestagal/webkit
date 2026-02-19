package rest

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type apiResponse struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("Error writing JSON response", "error", err)
	}
}

func successResponse(data any) apiResponse {
	return apiResponse{
		Success: true,
		Data:    data,
		Message: "OK",
	}
}

func errorResponse(msg string) apiResponse {
	return apiResponse{
		Success: false,
		Message: msg,
	}
}
